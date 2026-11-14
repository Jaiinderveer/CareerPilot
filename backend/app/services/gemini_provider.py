"""Gemini AI provider for interview evaluation and generation.

This module implements the AI content generation for CareerPilot interviews:
- plan_interview(): Select opening question from question bank
- evaluate_answer(): Score candidate response against rubric criteria
- generate_followup(): Create targeted follow-up questions
- generate_report(): Produce final interview summary

P3 owns interview state transitions. This provider only generates content.
"""

import json
import re
from typing import Any

import httpx

from app.core.config import Settings


GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

# Prompt version for tracking evaluation consistency
PROMPT_VERSION = 'v1.0.0'


def _gemini_url(settings: Settings, endpoint: str = 'generateContent') -> str:
    """Build the Gemini API URL."""
    return f'{GEMINI_API_BASE}/{settings.gemini_model}:{endpoint}?key={settings.gemini_api_key}'


def _extract_json(text: str) -> dict[str, Any]:
    """Extract JSON from Gemini response, handling markdown code blocks."""
    # Try to find JSON in code blocks first
    code_block_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if code_block_match:
        text = code_block_match.group(1)

    # Clean up common issues
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        return {}


async def _call_gemini(settings: Settings, prompt: str, system_instruction: str | None = None) -> str:
    """Make a request to Gemini API."""
    payload: dict[str, Any] = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.7,
            'topK': 40,
            'topP': 0.95,
            'maxOutputTokens': 2048,
        },
    }

    if system_instruction:
        payload['systemInstruction'] = {'parts': [{'text': system_instruction}]}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            _gemini_url(settings),
            json=payload,
            headers={'Content-Type': 'application/json'},
        )
        response.raise_for_status()
        result = response.json()

    # Extract text from response
    candidates = result.get('candidates', [])
    if not candidates:
        return ''

    content = candidates[0].get('content', {})
    parts = content.get('parts', [])
    if not parts:
        return ''

    return parts[0].get('text', '')


async def plan_interview(settings: Settings, context: dict[str, Any]) -> dict[str, Any]:
    """Select opening question based on interview context.

    P3 will validate the returned question_id against the question_bank table.
    This provider does NOT create turns or modify interview state.
    """
    role = context.get('role', 'Software Engineer')
    round_type = context.get('round', 'Technical')
    job_description = context.get('job_description', '')

    system_instruction = """You are an interview planning assistant. Your job is to select
the most appropriate opening question for a technical interview based on the role and context.

You must respond with valid JSON only, no additional text."""

    prompt = f"""Plan an interview session for the following context:

Role: {role}
Round Type: {round_type}
Job Description: {job_description[:500] if job_description else 'Not provided'}

Based on this context, suggest which topic areas should be covered and recommend
question selection strategy.

Respond with JSON in this exact format:
{{
    "recommended_topics": ["topic1", "topic2"],
    "difficulty_progression": "start_easy",
    "focus_areas": ["area1", "area2"],
    "first_question_id": null
}}

Note: first_question_id should be null - P3 will select from the question bank.
"""

    try:
        response_text = await _call_gemini(settings, prompt, system_instruction)
        result = _extract_json(response_text)

        # Ensure we have the required fields
        return {
            'recommended_topics': result.get('recommended_topics', [role, round_type]),
            'difficulty_progression': result.get('difficulty_progression', 'start_easy'),
            'focus_areas': result.get('focus_areas', []),
            'first_question_id': None,  # P3 selects from question_bank
            'question_ids': [],  # P3 manages the question sequence
            'gemini_model': settings.gemini_model,
        }
    except Exception:
        # Return minimal valid response on failure
        return {
            'recommended_topics': [role, round_type],
            'first_question_id': None,
            'question_ids': [],
            'gemini_model': settings.gemini_model,
        }


async def evaluate_answer(settings: Settings, context: dict[str, Any]) -> dict[str, Any]:
    """Evaluate candidate's answer against rubric criteria.

    Returns criterion-level scores and evidence. P3 persists the evaluation
    and uses it to decide the next action (probe/select_question/clarify/finish).
    """
    transcript_text = context.get('transcript_text', '')
    rubric_snapshot = context.get('rubric_snapshot', {})
    criteria = rubric_snapshot.get('criteria', [])

    if not criteria:
        # No rubric criteria - return minimal evaluation
        return {
            'overall_score': 0.5,
            'criterion_results': [],
            'gemini_model': settings.gemini_model,
            'prompt_version': PROMPT_VERSION,
        }

    criteria_descriptions = '\n'.join([
        f"- {c.get('criterion_id', 'unknown')}: {c.get('description', 'No description')}"
        for c in criteria
    ])

    system_instruction = """You are a technical interview evaluator. Assess the candidate's
response against specific rubric criteria. Be fair but rigorous.

Respond with valid JSON only, no additional text."""

    prompt = f"""Evaluate this interview answer against the rubric criteria:

CANDIDATE'S ANSWER:
{transcript_text}

RUBRIC CRITERIA TO EVALUATE:
{criteria_descriptions}

For each criterion, provide:
- criterion_id: The exact criterion ID from above
- status: One of "demonstrated", "partially_demonstrated", "not_demonstrated", "uncertain"
- score: Integer 0-4 (0=not demonstrated, 4=exceptional)
- evidence_quote: A brief quote from the answer that supports your assessment
- explanation: Why you gave this assessment

Respond with JSON in this exact format:
{{
    "overall_score": 0.75,
    "criterion_results": [
        {{
            "criterion_id": "criterion_id_here",
            "status": "demonstrated",
            "score": 3,
            "evidence_quote": "relevant quote",
            "explanation": "reasoning"
        }}
    ]
}}

The overall_score should be between 0.0 and 1.0.
"""

    try:
        response_text = await _call_gemini(settings, prompt, system_instruction)
        result = _extract_json(response_text)

        # Validate and normalize criterion results
        criterion_results = []
        for cr in result.get('criterion_results', []):
            criterion_id = cr.get('criterion_id')
            if not criterion_id:
                continue

            status = cr.get('status', 'uncertain')
            if status not in {'demonstrated', 'partially_demonstrated', 'not_demonstrated', 'contradicted', 'uncertain'}:
                status = 'uncertain'

            score = cr.get('score')
            if score is not None:
                score = max(0, min(4, int(score)))

            criterion_results.append({
                'criterion_id': criterion_id,
                'status': status,
                'score': score,
                'evidence_quote': cr.get('evidence_quote'),
                'explanation': cr.get('explanation'),
            })

        # Ensure all criteria are covered
        covered_ids = {cr['criterion_id'] for cr in criterion_results}
        for c in criteria:
            cid = c.get('criterion_id')
            if cid and cid not in covered_ids:
                criterion_results.append({
                    'criterion_id': cid,
                    'status': 'uncertain',
                    'score': None,
                    'evidence_quote': None,
                    'explanation': 'Not explicitly addressed in response',
                })

        overall_score = result.get('overall_score', 0.5)
        if not isinstance(overall_score, (int, float)):
            overall_score = 0.5
        overall_score = max(0.0, min(1.0, float(overall_score)))

        return {
            'overall_score': overall_score,
            'criterion_results': criterion_results,
            'gemini_model': settings.gemini_model,
            'prompt_version': PROMPT_VERSION,
        }

    except Exception:
        # Return uncertain evaluation on failure
        return {
            'overall_score': 0.5,
            'criterion_results': [
                {
                    'criterion_id': c.get('criterion_id', 'unknown'),
                    'status': 'uncertain',
                    'score': None,
                    'evidence_quote': None,
                    'explanation': 'Evaluation service error',
                }
                for c in criteria
            ],
            'gemini_model': settings.gemini_model,
            'prompt_version': PROMPT_VERSION,
        }


async def generate_followup(settings: Settings, context: dict[str, Any]) -> dict[str, Any]:
    """Generate a targeted follow-up question.

    P3 calls this when it decides action='probe' based on evaluation results.
    The follow-up targets a specific criterion that needs more evidence.
    """
    transcript_text = context.get('transcript_text', '')
    rubric_snapshot = context.get('rubric_snapshot', {})
    target_criterion_id = context.get('target_criterion_id')

    # Find the target criterion description
    target_description = 'the discussed topic'
    for c in rubric_snapshot.get('criteria', []):
        if c.get('criterion_id') == target_criterion_id:
            target_description = c.get('description', target_description)
            break

    system_instruction = """You are a technical interviewer conducting a follow-up question.
Your goal is to probe deeper on a specific aspect where the candidate's response was unclear
or incomplete. Be conversational but focused.

Respond with valid JSON only."""

    prompt = f"""The candidate just gave this answer:
"{transcript_text[:800]}"

I need to probe deeper on this specific criterion:
- Criterion: {target_criterion_id}
- Description: {target_description}

Generate a natural follow-up question that:
1. Acknowledges what they said
2. Asks them to elaborate on the specific aspect we need more evidence for
3. Is conversational, not robotic
4. Is one to two sentences maximum

Respond with JSON:
{{
    "question_text": "Your follow-up question here"
}}
"""

    try:
        response_text = await _call_gemini(settings, prompt, system_instruction)
        result = _extract_json(response_text)

        question_text = result.get('question_text', '').strip()
        if not question_text:
            question_text = f"Could you elaborate more on {target_description}? I'd like to understand your approach better."

        return {
            'question_text': question_text,
            'target_criterion_id': target_criterion_id,
            'gemini_model': settings.gemini_model,
        }

    except Exception:
        return {
            'question_text': f"Can you tell me more about {target_description}?",
            'target_criterion_id': target_criterion_id,
            'gemini_model': settings.gemini_model,
        }


async def generate_report(settings: Settings, context: dict[str, Any]) -> dict[str, Any]:
    """Generate the final interview report.

    Summarizes all turns and evaluations into actionable feedback.
    P3 calls this when finishing the interview.
    """
    interview = context.get('interview', {})
    evaluations = context.get('evaluations', [])

    role = interview.get('role', 'Software Engineer')
    round_type = interview.get('round', 'Technical')

    # Build evaluation summary
    eval_summary_parts = []
    total_score = 0.0
    score_count = 0

    for eval_data in evaluations:
        turn = eval_data.get('turn', {})
        evaluation = eval_data.get('evaluation', {})
        answer = eval_data.get('answer', {})

        question = turn.get('question_text', 'Unknown question')[:200]
        response = answer.get('transcript_text', '')[:300]
        score = evaluation.get('overall_score')

        if score is not None:
            total_score += score
            score_count += 1

        eval_summary_parts.append(f"""
Question: {question}
Response Summary: {response}
Score: {score if score is not None else 'N/A'}
""")

    eval_summary = '\n---\n'.join(eval_summary_parts) if eval_summary_parts else 'No evaluations available.'
    avg_score = total_score / score_count if score_count > 0 else 0.5

    system_instruction = """You are a career coach providing constructive interview feedback.
Be specific, actionable, and encouraging while being honest about areas for improvement.

Respond with valid JSON only."""

    prompt = f"""Generate a comprehensive interview report for this session:

Role: {role}
Round Type: {round_type}
Number of Questions: {len(evaluations)}
Average Score: {avg_score:.2f}

EVALUATION DETAILS:
{eval_summary}

Provide a report with:
1. An executive summary (2-3 sentences)
2. 2-4 specific strengths demonstrated
3. 2-3 areas for improvement
4. 2-3 actionable recommendations for the candidate

Respond with JSON:
{{
    "overall_summary": "Executive summary here",
    "overall_score": 0.75,
    "topic_results": {{}},
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["area1", "area2"],
    "recommendations": ["recommendation1", "recommendation2"]
}}
"""

    try:
        response_text = await _call_gemini(settings, prompt, system_instruction)
        result = _extract_json(response_text)

        overall_score = result.get('overall_score', avg_score)
        if not isinstance(overall_score, (int, float)):
            overall_score = avg_score
        overall_score = max(0.0, min(1.0, float(overall_score)))

        return {
            'overall_summary': result.get('overall_summary', f'Interview completed for {role} position.'),
            'overall_score': overall_score,
            'topic_results': result.get('topic_results', {}),
            'strengths': result.get('strengths', ['Completed the interview']),
            'weaknesses': result.get('weaknesses', []),
            'recommendations': result.get('recommendations', ['Continue practicing technical interviews']),
            'gemini_model': settings.gemini_model,
        }

    except Exception:
        return {
            'overall_summary': f'Interview completed for {role} ({round_type} round). {len(evaluations)} questions answered.',
            'overall_score': avg_score,
            'topic_results': {},
            'strengths': ['Completed the interview session'],
            'weaknesses': [],
            'recommendations': ['Continue practicing to improve performance'],
            'gemini_model': settings.gemini_model,
        }
