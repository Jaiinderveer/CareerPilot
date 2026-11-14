"""Interview lifecycle and orchestration endpoints owned by P3."""

from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.adaptive import choose_next_action, rubric_snapshot_from_row
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.evaluation import CriterionResult, EvaluationResponse
from app.schemas.interview import (
    AnswerResponse,
    AnswerSubmit,
    InterviewCreate,
    InterviewDetailResponse,
    InterviewFinishResponse,
    InterviewReportResponse,
    InterviewResponse,
    InterviewStartResponse,
    SkillStateResponse,
    STTTokenResponse,
    TopicResult,
    TurnAnswerSummary,
    TurnDetailResponse,
    TurnResponse,
)
from app.services.interview_ai import (
    AIServiceUnavailable,
    InterviewAIService,
    get_interview_ai_service,
)
from app.services.supabase import (
    SupabaseAPIError,
    SupabaseService,
    get_service_role_supabase,
    get_supabase_service,
)

router = APIRouter(prefix='/interviews', tags=['interviews'])
skills_router = APIRouter(prefix='/skills', tags=['skills'])
skill_states_router = APIRouter(prefix='/me/skill-states', tags=['skills'])
voice_router = APIRouter(prefix='/stt', tags=['voice'])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _rows(value: Any) -> list[dict[str, Any]]:
    return value if isinstance(value, list) else []


def _one(value: Any) -> dict[str, Any] | None:
    rows = _rows(value)
    return rows[0] if rows else None


def _raise_database_error(error: SupabaseAPIError, resource: str = 'interview') -> None:
    if error.status_code == 401:
        raise HTTPException(status_code=401, detail=f'Unable to access {resource}') from error
    if error.status_code == 403:
        raise HTTPException(status_code=403, detail=f'Unable to access {resource}') from error
    if error.status_code == 404:
        raise HTTPException(status_code=404, detail=f'{resource.capitalize()} not found') from error
    if error.status_code == 409:
        raise HTTPException(status_code=409, detail=f'{resource.capitalize()} conflicts with existing data') from error
    if error.status_code == 503:
        raise HTTPException(status_code=503, detail=f'{resource.capitalize()} service unavailable') from error
    raise HTTPException(status_code=502, detail=f'{resource.capitalize()} service request failed') from error


def _require_admin(settings_service: SupabaseService | None) -> SupabaseService:
    if settings_service is None:
        raise HTTPException(status_code=503, detail='Backend persistence service is unavailable')
    return settings_service


async def _get_interview(
    interview_id: UUID,
    supabase: SupabaseService,
) -> dict[str, Any]:
    try:
        value = await supabase.get(
            'interviews',
            params={'id': f'eq.{interview_id}', 'limit': '1'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error)
    row = _one(value)
    if row is None:
        raise HTTPException(status_code=404, detail='Interview not found')
    return row


async def _get_owned_interview(
    interview_id: UUID,
    current_user: AuthenticatedUser,
    supabase: SupabaseService,
) -> dict[str, Any]:
    interview = await _get_interview(interview_id, supabase)
    if str(interview.get('candidate_id')) != current_user.id:
        raise HTTPException(status_code=403, detail='Interview belongs to another user')
    return interview


async def _get_turn(
    interview_id: UUID,
    turn_id: UUID,
    supabase: SupabaseService,
) -> dict[str, Any]:
    try:
        value = await supabase.get(
            'interview_turns',
            params={
                'id': f'eq.{turn_id}',
                'interview_id': f'eq.{interview_id}',
                'limit': '1',
            },
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'turn')
    row = _one(value)
    if row is None:
        raise HTTPException(status_code=404, detail='Turn not found')
    return row


def _turn_response(row: dict[str, Any]) -> TurnResponse:
    return TurnResponse.model_validate(row)


def _interview_response(row: dict[str, Any]) -> InterviewResponse:
    return InterviewResponse.model_validate(row)


async def _question_with_rubric(question_id: UUID, supabase: SupabaseService) -> dict[str, Any]:
    try:
        value = await supabase.get(
            'question_bank',
            params={
                'id': f'eq.{question_id}',
                'review_status': 'eq.reviewed',
                'select': '*',
                'limit': '1',
            },
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'question bank')
    question = _one(value)
    if question is None:
        raise HTTPException(status_code=422, detail='Planner selected an unavailable question')

    try:
        rubrics = await supabase.get(
            'question_rubrics',
            params={
                'question_id': f'eq.{question_id}',
                'version': f'eq.{question.get("rubric_version", 1)}',
                'limit': '1',
            },
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'question rubric')
    rubric = _one(rubrics)
    if rubric is None:
        raise HTTPException(status_code=422, detail='Question has no rubric')

    try:
        criteria = await supabase.get(
            'rubric_criteria',
            params={'rubric_id': f'eq.{rubric["id"]}', 'order': 'criterion_id'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'rubric criteria')
    question['rubric'] = rubric
    question['criteria'] = _rows(criteria)
    return question


async def _create_turn(
    *,
    interview_id: UUID,
    sequence_num: int,
    question_text: str,
    rubric_snapshot: dict[str, Any],
    supabase: SupabaseService,
    question_id: UUID | None = None,
    is_follow_up: bool = False,
    parent_turn_id: UUID | None = None,
    target_criterion_id: str | None = None,
) -> TurnResponse:
    payload = {
        'interview_id': str(interview_id),
        'sequence_num': sequence_num,
        'question_id': str(question_id) if question_id else None,
        'question_text': question_text,
        'rubric_snapshot': rubric_snapshot,
        'is_follow_up': is_follow_up,
        'parent_turn_id': str(parent_turn_id) if parent_turn_id else None,
        'target_criterion_id': target_criterion_id,
    }
    try:
        value = await supabase.post('interview_turns', payload)
    except SupabaseAPIError as error:
        _raise_database_error(error, 'turn')
    row = _one(value)
    if row is None:
        raise HTTPException(status_code=502, detail='Turn was not returned by the database')
    return _turn_response(row)


def _question_is_eligible(question: dict[str, Any], interview: dict[str, Any]) -> bool:
    """Accept generic bank rows or rows matching this interview's context."""

    def matches(field: str) -> bool:
        question_value = question.get(field)
        interview_value = interview.get(field)
        if question_value in (None, ''):
            return True
        if interview_value in (None, ''):
            return False
        return str(question_value).strip().casefold() == str(interview_value).strip().casefold()

    return matches('company_id') and matches('role') and matches('round')


def _question_specificity(question: dict[str, Any], interview: dict[str, Any]) -> int:
    """Rank exact context matches ahead of otherwise eligible generic rows."""

    return sum(
        question.get(field) not in (None, '') and interview.get(field) not in (None, '')
        for field in ('company_id', 'role', 'round')
    )


def _main_parent_id(turn: dict[str, Any], turns: list[dict[str, Any]]) -> UUID:
    """Resolve legacy nested follow-ups to their root main-question turn."""

    turn_by_id = {str(row.get('id')): row for row in turns if row.get('id')}
    current = turn
    visited: set[str] = set()
    while current.get('is_follow_up') and current.get('parent_turn_id'):
        parent_id = str(current['parent_turn_id'])
        if parent_id in visited:
            break
        visited.add(parent_id)
        parent = turn_by_id.get(parent_id)
        if parent is None:
            return UUID(parent_id)
        current = parent
    return UUID(str(current['id']))


def _is_follow_up_for_parent(
    turn: dict[str, Any],
    parent_turn_id: UUID,
    turns: list[dict[str, Any]],
) -> bool:
    if not turn.get('is_follow_up') or not turn.get('parent_turn_id'):
        return False
    return _main_parent_id(turn, turns) == parent_turn_id


async def _next_question(
    interview: dict[str, Any],
    turns: list[dict[str, Any]],
    supabase: SupabaseService,
) -> dict[str, Any] | None:
    params: dict[str, Any] = {
        'review_status': 'eq.reviewed',
        'order': 'difficulty.asc,created_at.asc,id.asc',
    }
    try:
        value = await supabase.get('question_bank', params=params)
    except SupabaseAPIError as error:
        _raise_database_error(error, 'question bank')

    asked_ids = {str(turn.get('question_id')) for turn in turns if turn.get('question_id')}
    candidates = [
        row
        for row in _rows(value)
        if row.get('id')
        and str(row['id']) not in asked_ids
        and _question_is_eligible(row, interview)
    ]
    candidates.sort(key=lambda row: _question_specificity(row, interview), reverse=True)
    for candidate in candidates:
        try:
            return await _question_with_rubric(UUID(str(candidate['id'])), supabase)
        except HTTPException as error:
            if error.status_code == 422:
                continue
            raise
    return None


async def _persist_evaluation(
    *,
    answer_id: UUID,
    evaluation_data: dict[str, Any],
    rubric_snapshot: dict[str, Any],
    admin: SupabaseService,
) -> EvaluationResponse:
    criterion_values = evaluation_data.get('criterion_results') or evaluation_data.get('criteria') or []
    criteria = [CriterionResult.model_validate(value) for value in criterion_values]
    expected = {
        str(value.get('criterion_id'))
        for value in rubric_snapshot.get('criteria', [])
        if value.get('criterion_id') is not None
    }
    actual = {value.criterion_id for value in criteria}
    if expected and actual != expected:
        raise HTTPException(status_code=422, detail='Evaluation criteria do not match the rubric snapshot')

    overall_score = evaluation_data.get('overall_score')
    if overall_score is not None and not 0 <= float(overall_score) <= 1:
        raise HTTPException(status_code=422, detail='Evaluation overall_score must be between 0 and 1')

    evaluation_payload = {
        'answer_id': str(answer_id),
        'gemini_model': str(evaluation_data.get('gemini_model', 'unknown')),
        'prompt_version': str(evaluation_data.get('prompt_version', 'unknown')),
        'rubric_version': rubric_snapshot.get('version', 1),
        'overall_score': overall_score,
        'raw_response': evaluation_data,
    }
    try:
        evaluation_row = _one(await admin.post('evaluations', evaluation_payload))
    except SupabaseAPIError as error:
        _raise_database_error(error, 'evaluation')
    if evaluation_row is None:
        raise HTTPException(status_code=502, detail='Evaluation was not returned by the database')

    stored_criteria: list[dict[str, Any]] = []
    for criterion in criteria:
        try:
            rows = await admin.post(
                'evaluation_criterion_results',
                {
                    'evaluation_id': str(evaluation_row['id']),
                    **criterion.model_dump(),
                },
            )
        except SupabaseAPIError as error:
            _raise_database_error(error, 'criterion evaluation')
        row = _one(rows)
        if row:
            stored_criteria.append(row)

    return EvaluationResponse(
        id=evaluation_row['id'],
        overall_score=overall_score,
        criterion_results=[CriterionResult.model_validate(row) for row in stored_criteria] or criteria,
    )


async def _update_skill_evidence(
    *,
    turn: dict[str, Any],
    evaluation: EvaluationResponse,
    candidate_id: str,
    admin: SupabaseService,
) -> None:
    """Update skill evidence only for main-question turns."""

    if turn.get('is_follow_up'):
        return
    snapshot = turn.get('rubric_snapshot') or {}
    skill_id = snapshot.get('skill_id')
    if not skill_id:
        skill_id = next(
            (criterion.get('skill_id') for criterion in snapshot.get('criteria', []) if criterion.get('skill_id')),
            None,
        )
    if not skill_id:
        return
    demonstrated = sum(result.status == 'demonstrated' for result in evaluation.criterion_results)
    not_demonstrated = sum(result.status in {'not_demonstrated', 'contradicted'} for result in evaluation.criterion_results)
    try:
        existing = _one(await admin.get('candidate_skill_states', params={
            'candidate_id': f'eq.{candidate_id}',
            'skill_id': f'eq.{skill_id}',
            'limit': '1',
        }))
        if existing:
            difficulty = min(5, max(1, int(existing.get('current_difficulty', 2)) + (1 if demonstrated > not_demonstrated else -1 if not_demonstrated > demonstrated else 0)))
            await admin.patch(
                f'candidate_skill_states?id=eq.{existing["id"]}',
                {
                    'current_difficulty': difficulty,
                    'main_question_attempts': int(existing.get('main_question_attempts', 0)) + 1,
                    'demonstrated_count': int(existing.get('demonstrated_count', 0)) + demonstrated,
                    'not_demonstrated_count': int(existing.get('not_demonstrated_count', 0)) + not_demonstrated,
                    'last_updated': _now().isoformat(),
                },
            )
        else:
            await admin.post('candidate_skill_states', {
                'candidate_id': candidate_id,
                'skill_id': skill_id,
                'current_difficulty': 2,
                'main_question_attempts': 1,
                'demonstrated_count': demonstrated,
                'not_demonstrated_count': not_demonstrated,
                'last_updated': _now().isoformat(),
            })
    except SupabaseAPIError as error:
        _raise_database_error(error, 'skill state')


async def _get_evaluation(
    answer_id: UUID,
    supabase: SupabaseService,
) -> EvaluationResponse | None:
    try:
        rows = await supabase.get(
            'evaluations',
            params={'answer_id': f'eq.{answer_id}', 'limit': '1'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'evaluation')
    evaluation = _one(rows)
    if evaluation is None:
        return None
    try:
        criteria = await supabase.get(
            'evaluation_criterion_results',
            params={'evaluation_id': f'eq.{evaluation["id"]}', 'order': 'criterion_id'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'criterion evaluation')
    return EvaluationResponse(
        id=evaluation['id'],
        overall_score=evaluation.get('overall_score'),
        criterion_results=[CriterionResult.model_validate(row) for row in _rows(criteria)],
    )


@router.post('', response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    interview: InterviewCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> InterviewResponse:
    if interview.company_id:
        try:
            company = await supabase.get(
                'recruiters',
                params={'id': f'eq.{interview.company_id}', 'limit': '1'},
            )
        except SupabaseAPIError as error:
            _raise_database_error(error, 'company')
        if not _one(company):
            raise HTTPException(status_code=422, detail='company_id does not identify an existing company')

    payload = interview.model_dump(mode='json')
    payload['candidate_id'] = current_user.id
    payload['status'] = 'planned'
    try:
        value = await supabase.post('interviews', payload)
    except SupabaseAPIError as error:
        _raise_database_error(error)
    row = _one(value)
    if row is None:
        raise HTTPException(status_code=502, detail='Interview was not returned by the database')
    return _interview_response(row)


@router.get('', response_model=list[InterviewResponse])
async def list_interviews(
    interview_status: str | None = Query(default=None, alias='status'),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[InterviewResponse]:
    params: dict[str, Any] = {
        'candidate_id': f'eq.{current_user.id}',
        'limit': str(limit),
        'offset': str(offset),
        'order': 'created_at.desc',
    }
    if interview_status:
        params['status'] = f'eq.{interview_status}'
    try:
        rows = await supabase.get('interviews', params=params)
    except SupabaseAPIError as error:
        _raise_database_error(error)
    return [_interview_response(row) for row in _rows(rows)]


@router.get('/{interview_id}', response_model=InterviewDetailResponse)
async def get_interview(
    interview_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> InterviewDetailResponse:
    interview = await _get_owned_interview(interview_id, current_user, supabase)
    try:
        turns = await supabase.get(
            'interview_turns',
            params={'interview_id': f'eq.{interview_id}', 'order': 'sequence_num.asc'},
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'turn')
    turn_rows = _rows(turns)
    company = None
    if interview.get('company_id'):
        try:
            company = _one(await supabase.get(
                'recruiters',
                params={'id': f'eq.{interview["company_id"]}', 'limit': '1'},
            ))
        except SupabaseAPIError as error:
            _raise_database_error(error, 'company')
    return InterviewDetailResponse(
        **interview,
        company=company,
        current_turn=_turn_response(turn_rows[-1]) if turn_rows else None,
        total_turns=len(turn_rows),
        total_main_questions=sum(not row.get('is_follow_up', False) for row in turn_rows),
        total_follow_ups=sum(bool(row.get('is_follow_up', False)) for row in turn_rows),
    )


@router.post('/{interview_id}/start', response_model=InterviewStartResponse)
async def start_interview(
    interview_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
    ai: InterviewAIService = Depends(get_interview_ai_service),
) -> InterviewStartResponse:
    interview = await _get_owned_interview(interview_id, current_user, supabase)
    if interview.get('status') != 'planned':
        raise HTTPException(status_code=409, detail='Interview has already started')
    try:
        plan = await ai.plan_interview({
            'candidate_id': current_user.id,
            'company_id': interview.get('company_id'),
            'role': interview.get('role'),
            'round': interview.get('round'),
            'job_description': interview.get('job_description'),
            'resume_url': interview.get('resume_url'),
        })
    except AIServiceUnavailable as error:
        raise HTTPException(status_code=503, detail='AI service unavailable') from error

    if not isinstance(plan, dict):
        plan = {}
    raw_question_ids = plan.get('question_ids')
    question_ids = raw_question_ids if isinstance(raw_question_ids, list) else []
    planner_ids = [plan.get('first_question_id'), *question_ids]

    question = None
    for raw_question_id in planner_ids:
        if not raw_question_id:
            continue
        try:
            candidate_id = UUID(str(raw_question_id))
        except (TypeError, ValueError, AttributeError):
            continue
        try:
            question = await _question_with_rubric(candidate_id, supabase)
        except HTTPException as error:
            if error.status_code == 422:
                continue
            raise
        if not _question_is_eligible(question, interview):
            question = None
            continue
        break

    if question is None:
        question = await _next_question(interview, [], supabase)
        if question is None:
            raise HTTPException(
                status_code=503,
                detail='No eligible reviewed questions with rubrics are available in the question bank for this interview',
            )

    try:
        existing_turns = await supabase.get(
            'interview_turns', params={'interview_id': f'eq.{interview_id}', 'limit': '1'}
        )
        if _rows(existing_turns):
            raise HTTPException(status_code=409, detail='Interview already has a first turn')
        turn = await _create_turn(
            interview_id=interview_id,
            sequence_num=1,
            question_id=UUID(str(question['id'])),
            question_text=question['question_text'],
            rubric_snapshot=rubric_snapshot_from_row(question),
            supabase=supabase,
        )
        started_at = _now()
        updated = _one(await supabase.patch(
            f'interviews?id=eq.{interview_id}&status=eq.planned',
            {'status': 'active', 'started_at': started_at.isoformat()},
        ))
    except SupabaseAPIError as error:
        _raise_database_error(error)
    if updated is None:
        raise HTTPException(status_code=409, detail='Interview state changed while starting')
    return InterviewStartResponse(
        interview_id=interview_id,
        status='active',
        started_at=started_at,
        first_turn=turn,
        tts_audio_url=f'/api/interviews/{interview_id}/turns/{turn.id}/audio',
    )


@router.get('/{interview_id}/turns/{turn_id}', response_model=TurnDetailResponse)
async def get_turn_detail(
    interview_id: UUID,
    turn_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> TurnDetailResponse:
    await _get_owned_interview(interview_id, current_user, supabase)
    turn = await _get_turn(interview_id, turn_id, supabase)
    try:
        answer = _one(await supabase.get('answers', params={'turn_id': f'eq.{turn_id}', 'limit': '1'}))
    except SupabaseAPIError as error:
        _raise_database_error(error, 'answer')
    evaluation = await _get_evaluation(UUID(str(answer['id'])), supabase) if answer else None
    return TurnDetailResponse(
        **{**turn, 'interview_id': interview_id},
        answer=TurnAnswerSummary.model_validate(answer) if answer else None,
        evaluation=evaluation,
    )


@router.post('/{interview_id}/turns/{turn_id}/answer', response_model=AnswerResponse)
async def submit_answer(
    interview_id: UUID,
    turn_id: UUID,
    answer: AnswerSubmit,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
    admin: SupabaseService | None = Depends(get_service_role_supabase),
    ai: InterviewAIService = Depends(get_interview_ai_service),
) -> AnswerResponse:
    interview = await _get_owned_interview(interview_id, current_user, supabase)
    if interview.get('status') != 'active':
        raise HTTPException(status_code=409, detail='Interview is not active')
    admin_service = _require_admin(admin)
    turn = await _get_turn(interview_id, turn_id, supabase)

    try:
        existing_answer = _one(await supabase.get('answers', params={'turn_id': f'eq.{turn_id}', 'limit': '1'}))
    except SupabaseAPIError as error:
        _raise_database_error(error, 'answer')
    if existing_answer:
        existing_evaluation = await _get_evaluation(UUID(str(existing_answer['id'])), supabase)
        if existing_evaluation:
            raise HTTPException(status_code=409, detail='Answer already submitted for this turn')
        # A previous provider failure left the answer durable; retry only the
        # missing evaluation rather than creating a second answer row.
        answer_id = UUID(str(existing_answer['id']))
    else:
        try:
            created = await supabase.post(
                'answers',
                {
                    'turn_id': str(turn_id),
                    'transcript_text': answer.transcript_text,
                    'audio_duration_seconds': answer.audio_duration_seconds,
                },
            )
        except SupabaseAPIError as error:
            _raise_database_error(error, 'answer')
        stored_answer = _one(created)
        if stored_answer is None:
            raise HTTPException(status_code=502, detail='Answer was not returned by the database')
        answer_id = UUID(str(stored_answer['id']))

    try:
        evaluation_data = await ai.evaluate_answer({
            'transcript_text': answer.transcript_text,
            'rubric_snapshot': turn.get('rubric_snapshot') or {},
            'interview_id': str(interview_id),
            'turn_id': str(turn_id),
        })
    except AIServiceUnavailable as error:
        raise HTTPException(status_code=503, detail='AI service unavailable') from error
    evaluation = await _persist_evaluation(
        answer_id=answer_id,
        evaluation_data=evaluation_data,
        rubric_snapshot=turn.get('rubric_snapshot') or {},
        admin=admin_service,
    )
    await _update_skill_evidence(
        turn=turn,
        evaluation=evaluation,
        candidate_id=current_user.id,
        admin=admin_service,
    )

    try:
        turns = _rows(await supabase.get(
            'interview_turns', params={'interview_id': f'eq.{interview_id}', 'order': 'sequence_num.asc'}
        ))
    except SupabaseAPIError as error:
        _raise_database_error(error, 'turn')
    main_parent_id = _main_parent_id(turn, turns)
    follow_up_count = sum(
        _is_follow_up_for_parent(row, main_parent_id, turns)
        for row in turns
    )
    next_question = await _next_question(interview, turns, supabase)
    action = choose_next_action(
        transcript_text=answer.transcript_text,
        criterion_results=evaluation.criterion_results,
        follow_ups_for_parent=follow_up_count,
        remaining_main_questions=next_question is not None,
    )
    next_turn: TurnResponse | None = None
    if action.action == 'probe':
        try:
            generated = await ai.generate_followup({
                'transcript_text': answer.transcript_text,
                'rubric_snapshot': turn.get('rubric_snapshot') or {},
                'target_criterion_id': action.target_criterion_id,
            })
        except AIServiceUnavailable as error:
            raise HTTPException(status_code=503, detail='AI service unavailable') from error
        text = str(generated.get('question_text', '')).strip()
        if not text:
            raise HTTPException(status_code=503, detail='AI follow-up service returned no question')
        next_turn = await _create_turn(
            interview_id=interview_id,
            sequence_num=len(turns) + 1,
            question_text=text,
            rubric_snapshot=turn.get('rubric_snapshot') or {},
            supabase=supabase,
            is_follow_up=True,
            parent_turn_id=main_parent_id,
            target_criterion_id=action.target_criterion_id,
        )
    elif action.action == 'select_question':
        if next_question is None:
            action = action.__class__(action='finish')
        else:
            next_turn = await _create_turn(
                interview_id=interview_id,
                sequence_num=len(turns) + 1,
                question_id=UUID(str(next_question['id'])),
                question_text=next_question['question_text'],
                rubric_snapshot=rubric_snapshot_from_row(next_question),
                supabase=supabase,
            )
    if action.action == 'clarify':
        next_turn = await _create_turn(
            interview_id=interview_id,
            sequence_num=len(turns) + 1,
            question_text='Could you add a little more detail to your previous answer?',
            rubric_snapshot=turn.get('rubric_snapshot') or {},
            supabase=supabase,
            is_follow_up=True,
            parent_turn_id=main_parent_id,
            target_criterion_id=action.target_criterion_id,
        )
    if action.action == 'finish':
        return AnswerResponse(
            answer_id=answer_id,
            evaluation=evaluation,
            next_action='finish',
            next_turn=None,
            tts_audio_url=None,
        )
    return AnswerResponse(
        answer_id=answer_id,
        evaluation=evaluation,
        next_action=action.action,
        next_turn=next_turn,
        tts_audio_url=(
            f'/api/interviews/{interview_id}/turns/{next_turn.id}/audio'
            if next_turn else None
        ),
    )


@router.get('/{interview_id}/turns/{turn_id}/audio')
async def get_turn_audio(
    interview_id: UUID,
    turn_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
    ai: InterviewAIService = Depends(get_interview_ai_service),
) -> StreamingResponse:
    await _get_owned_interview(interview_id, current_user, supabase)
    turn = await _get_turn(interview_id, turn_id, supabase)
    try:
        stream = ai.stream_tts(turn['question_text'])
        first_chunk = await anext(stream)
    except (AIServiceUnavailable, StopAsyncIteration) as error:
        raise HTTPException(status_code=503, detail='TTS service unavailable') from error

    async def content() -> AsyncIterator[bytes]:
        yield first_chunk
        async for chunk in stream:
            yield chunk

    return StreamingResponse(content(), media_type='audio/mpeg')


@router.post('/{interview_id}/finish', response_model=InterviewFinishResponse)
async def finish_interview(
    interview_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
    admin: SupabaseService | None = Depends(get_service_role_supabase),
    ai: InterviewAIService = Depends(get_interview_ai_service),
) -> InterviewFinishResponse:
    interview = await _get_owned_interview(interview_id, current_user, supabase)
    if interview.get('status') not in {'active', 'paused', 'finalizing'}:
        raise HTTPException(status_code=409, detail='Interview is not active or paused')
    admin_service = _require_admin(admin)
    try:
        existing_report = _one(await supabase.get(
            'interview_reports',
            params={'interview_id': f'eq.{interview_id}', 'limit': '1'},
        ))
        if existing_report:
            ended_at = interview.get('ended_at') or _now()
            return InterviewFinishResponse(
                interview_id=interview_id,
                status='completed',
                ended_at=ended_at,
                report=InterviewReportResponse(
                    id=existing_report['id'],
                    interview_id=interview_id,
                    overall_summary=existing_report['overall_summary'],
                    overall_score=existing_report.get('overall_score'),
                    topic_results={
                        key: TopicResult.model_validate(value)
                        for key, value in (existing_report.get('topic_results') or {}).items()
                    },
                    strengths=existing_report.get('strengths') or [],
                    weaknesses=existing_report.get('weaknesses') or [],
                    recommendations=existing_report.get('recommendations') or [],
                    generated_at=existing_report['generated_at'],
                ),
            )
        if interview.get('status') in {'active', 'paused'}:
            transitioned = _rows(await supabase.patch(
                f'interviews?id=eq.{interview_id}&status=in.(active,paused)',
                {'status': 'finalizing'},
            ))
            if not transitioned:
                raise HTTPException(status_code=409, detail='Interview state changed while finishing')
        turns = _rows(await supabase.get(
            'interview_turns', params={'interview_id': f'eq.{interview_id}', 'order': 'sequence_num.asc'}
        ))
        evaluations: list[dict[str, Any]] = []
        for turn in turns:
            answer = _one(await supabase.get('answers', params={'turn_id': f'eq.{turn["id"]}', 'limit': '1'}))
            if answer:
                evaluation = await _get_evaluation(UUID(str(answer['id'])), supabase)
                if evaluation:
                    evaluations.append({
                        'turn': turn,
                        'answer': answer,
                        'evaluation': evaluation.model_dump(mode='json'),
                    })
        report_data = await ai.generate_report({
            'interview': interview,
            'turns': turns,
            'evaluations': evaluations,
        })
        report_payload = {
            'interview_id': str(interview_id),
            'overall_summary': report_data.get('overall_summary', ''),
            'overall_score': report_data.get('overall_score'),
            'topic_results': report_data.get('topic_results', {}),
            'strengths': report_data.get('strengths', []),
            'weaknesses': report_data.get('weaknesses', []),
            'recommendations': report_data.get('recommendations', []),
            'gemini_model': report_data.get('gemini_model', 'unknown'),
        }
        report = _one(await admin_service.post('interview_reports', report_payload))
        ended_at = _now()
        await admin_service.patch(
            f'interviews?id=eq.{interview_id}',
            {'status': 'completed', 'ended_at': ended_at.isoformat()},
        )
    except AIServiceUnavailable as error:
        raise HTTPException(status_code=503, detail='AI service unavailable') from error
    except SupabaseAPIError as error:
        _raise_database_error(error, 'report')
    if report is None:
        raise HTTPException(status_code=502, detail='Report was not returned by the database')
    response_report = InterviewReportResponse(
        id=report['id'],
        interview_id=interview_id,
        overall_summary=report['overall_summary'],
        overall_score=report.get('overall_score'),
        topic_results={key: TopicResult.model_validate(value) for key, value in (report.get('topic_results') or {}).items()},
        strengths=report.get('strengths') or [],
        weaknesses=report.get('weaknesses') or [],
        recommendations=report.get('recommendations') or [],
        generated_at=report.get('generated_at') or ended_at,
    )
    return InterviewFinishResponse(
        interview_id=interview_id,
        status='completed',
        ended_at=ended_at,
        report=response_report,
    )


@skills_router.get('', response_model=list[dict[str, Any]])
async def list_skills(
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[dict[str, Any]]:
    try:
        rows = await supabase.get('skills', params={'order': 'name.asc'})
    except SupabaseAPIError as error:
        _raise_database_error(error, 'skill')
    return _rows(rows)


@skill_states_router.get('', response_model=list[SkillStateResponse])
async def list_skill_states(
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> list[SkillStateResponse]:
    try:
        rows = await supabase.get(
            'candidate_skill_states',
            params={
                'candidate_id': f'eq.{current_user.id}',
                'select': '*,skill:skills(name)',
                'order': 'last_updated.desc',
            },
        )
    except SupabaseAPIError as error:
        _raise_database_error(error, 'skill state')
    result = []
    for row in _rows(rows):
        skill = row.get('skill') or {}
        result.append(SkillStateResponse(
            skill_id=row['skill_id'],
            skill_name=row.get('skill_name') or skill.get('name', ''),
            current_difficulty=row['current_difficulty'],
            main_question_attempts=row['main_question_attempts'],
            demonstrated_count=row['demonstrated_count'],
            not_demonstrated_count=row['not_demonstrated_count'],
            last_updated=row['last_updated'],
        ))
    return result


@voice_router.get('/token', response_model=STTTokenResponse)
async def get_stt_token(
    current_user: AuthenticatedUser = Depends(get_current_user),
    ai: InterviewAIService = Depends(get_interview_ai_service),
) -> STTTokenResponse:
    try:
        token = await ai.create_stt_token()
    except AIServiceUnavailable as error:
        raise HTTPException(status_code=503, detail='ElevenLabs service unavailable') from error
    return STTTokenResponse.model_validate(token)


@router.get('/{interview_id}/report', response_model=InterviewReportResponse)
async def get_report(
    interview_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> InterviewReportResponse:
    interview = await _get_owned_interview(interview_id, current_user, supabase)
    if interview.get('status') != 'completed':
        raise HTTPException(status_code=409, detail='Interview is not yet completed')
    try:
        report = _one(await supabase.get('interview_reports', params={'interview_id': f'eq.{interview_id}', 'limit': '1'}))
    except SupabaseAPIError as error:
        _raise_database_error(error, 'report')
    if report is None:
        raise HTTPException(status_code=404, detail='Interview report not found')
    return InterviewReportResponse(
        id=report['id'],
        interview_id=interview_id,
        overall_summary=report['overall_summary'],
        overall_score=report.get('overall_score'),
        topic_results={key: TopicResult.model_validate(value) for key, value in (report.get('topic_results') or {}).items()},
        strengths=report.get('strengths') or [],
        weaknesses=report.get('weaknesses') or [],
        recommendations=report.get('recommendations') or [],
        generated_at=report['generated_at'],
    )
