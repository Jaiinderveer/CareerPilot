"""Network-free regression tests for P3 interview state transitions.

These tests exercise orchestration with AsyncMock collaborators. They validate no
external AI provider or Supabase deployment.
"""

from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.core.security import AuthenticatedUser
from app.routers.interviews import finish_interview, get_report, submit_answer
from app.schemas.interview import AnswerSubmit


INTERVIEW_ID = UUID('10000000-0000-4000-8000-000000000001')
MAIN_TURN_ID = UUID('20000000-0000-4000-8000-000000000001')
FOLLOW_UP_ID = UUID('20000000-0000-4000-8000-000000000002')
NESTED_FOLLOW_UP_ID = UUID('20000000-0000-4000-8000-000000000003')
NEXT_TURN_ID = UUID('20000000-0000-4000-8000-000000000004')
ANSWER_ID = UUID('30000000-0000-4000-8000-000000000001')
EVALUATION_ID = UUID('40000000-0000-4000-8000-000000000001')
FIRST_QUESTION_ID = UUID('50000000-0000-4000-8000-000000000001')
NEXT_QUESTION_ID = UUID('50000000-0000-4000-8000-000000000002')
RUBRIC_ID = UUID('60000000-0000-4000-8000-000000000001')
REPORT_ID = UUID('70000000-0000-4000-8000-000000000001')
CANDIDATE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
TIMESTAMP = '2026-01-01T00:00:00Z'


@pytest.fixture
def current_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        id=CANDIDATE_ID,
        email='student@example.com',
        full_name='Test Student',
        access_token='test-access-token',
        raw_user={},
    )


@pytest.fixture
def interview_row() -> dict:
    return {
        'id': str(INTERVIEW_ID),
        'candidate_id': CANDIDATE_ID,
        'status': 'active',
        'role': 'Software Engineer',
        'round': 'Technical',
        'company_id': None,
        'job_description': None,
        'resume_url': None,
    }


@pytest.fixture
def rubric_snapshot() -> dict:
    return {
        'rubric_id': str(RUBRIC_ID),
        'version': 1,
        'expected_concepts': {},
        'skill_id': None,
        'criteria': [
            {
                'criterion_id': 'technical_depth',
                'description': 'Shows technical depth',
                'importance': 'critical',
                'weight': 1.0,
                'skill_id': None,
            }
        ],
    }


def make_turn(
    turn_id: UUID,
    sequence_num: int,
    rubric_snapshot: dict,
    *,
    is_follow_up: bool = False,
    parent_turn_id: UUID | None = None,
) -> dict:
    return {
        'id': str(turn_id),
        'interview_id': str(INTERVIEW_ID),
        'sequence_num': sequence_num,
        'question_id': None if is_follow_up else str(FIRST_QUESTION_ID),
        'question_text': 'Explain your design choices.',
        'rubric_snapshot': rubric_snapshot,
        'is_follow_up': is_follow_up,
        'parent_turn_id': str(parent_turn_id) if parent_turn_id else None,
        'target_criterion_id': 'technical_depth' if is_follow_up else None,
        'asked_at': TIMESTAMP,
    }


def make_question() -> dict:
    return {
        'id': str(NEXT_QUESTION_ID),
        'question_text': 'How would you improve this design?',
        'role': None,
        'round': None,
        'company_id': None,
        'difficulty': 2,
        'rubric_version': 1,
        'review_status': 'reviewed',
        'created_at': TIMESTAMP,
    }


def make_submit_supabase(
    interview: dict,
    turns: list[dict],
    *,
    next_question: dict | None = None,
) -> AsyncMock:
    supabase = AsyncMock()

    async def get(path, *, params=None):
        if path == 'interviews':
            return [interview]
        if path == 'interview_turns' and params and 'id' in params:
            turn_id = params['id'].removeprefix('eq.')
            return [turn for turn in turns if str(turn['id']) == turn_id]
        if path == 'interview_turns':
            return turns
        if path == 'answers':
            return []
        if path == 'question_bank' and params and 'id' in params:
            return [next_question] if next_question else []
        if path == 'question_bank':
            return [next_question] if next_question else []
        if path == 'question_rubrics':
            return [{
                'id': str(RUBRIC_ID),
                'question_id': str(NEXT_QUESTION_ID),
                'version': 1,
                'expected_concepts': {},
            }]
        if path == 'rubric_criteria':
            return [{
                'criterion_id': 'technical_depth',
                'description': 'Shows technical depth',
                'importance': 'critical',
                'weight': 1.0,
            }]
        raise AssertionError(f'Unexpected GET {path!r} with params {params!r}')

    async def post(path, data):
        if path == 'answers':
            return [{
                'id': str(ANSWER_ID),
                **data,
                'submitted_at': TIMESTAMP,
            }]
        if path == 'interview_turns':
            return [{
                'id': str(NEXT_TURN_ID),
                **data,
                'asked_at': TIMESTAMP,
            }]
        raise AssertionError(f'Unexpected POST {path!r}')

    supabase.get.side_effect = get
    supabase.post.side_effect = post
    return supabase


def make_admin() -> AsyncMock:
    admin = AsyncMock()

    async def post(path, data):
        if path == 'evaluations':
            return [{
                'id': str(EVALUATION_ID),
                **data,
            }]
        if path == 'evaluation_criterion_results':
            return [data]
        raise AssertionError(f'Unexpected admin POST {path!r}')

    admin.post.side_effect = post
    return admin


def make_ai(status: str = 'not_demonstrated') -> AsyncMock:
    ai = AsyncMock()
    ai.evaluate_answer.return_value = {
        'gemini_model': 'mock-evaluator',
        'prompt_version': 'test-v1',
        'overall_score': 0.25,
        'criterion_results': [{
            'criterion_id': 'technical_depth',
            'status': status,
            'score': 1,
            'evidence_quote': 'mock evidence',
            'explanation': 'mock evaluation',
        }],
    }
    ai.generate_followup.return_value = {
        'question_text': 'What trade-off mattered most?'
    }
    return ai


async def run_submit(
    *,
    current_user: AuthenticatedUser,
    turn_id: UUID,
    transcript: str,
    supabase: AsyncMock,
    admin: AsyncMock | None,
    ai: AsyncMock,
):
    return await submit_answer(
        interview_id=INTERVIEW_ID,
        turn_id=turn_id,
        answer=AnswerSubmit(transcript_text=transcript),
        current_user=current_user,
        supabase=supabase,
        admin=admin,
        ai=ai,
    )


@pytest.mark.asyncio
async def test_probe_is_attached_to_main_question_parent(
    current_user, interview_row, rubric_snapshot
):
    main_turn = make_turn(MAIN_TURN_ID, 1, rubric_snapshot)
    supabase = make_submit_supabase(interview_row, [main_turn])
    admin = make_admin()
    ai = make_ai()

    result = await run_submit(
        current_user=current_user,
        turn_id=MAIN_TURN_ID,
        transcript='A detailed answer that still misses one criterion.',
        supabase=supabase,
        admin=admin,
        ai=ai,
    )

    assert result.next_action == 'probe'
    assert result.next_turn is not None
    assert result.next_turn.parent_turn_id == MAIN_TURN_ID
    turn_post = next(call for call in supabase.post.await_args_list if call.args[0] == 'interview_turns')
    assert turn_post.args[1]['parent_turn_id'] == str(MAIN_TURN_ID)
    ai.generate_followup.assert_awaited_once()


@pytest.mark.asyncio
async def test_legacy_nested_follow_up_chain_uses_root_limit_and_selects_next_question(
    current_user, interview_row, rubric_snapshot
):
    main_turn = make_turn(MAIN_TURN_ID, 1, rubric_snapshot)
    follow_up = make_turn(
        FOLLOW_UP_ID,
        2,
        rubric_snapshot,
        is_follow_up=True,
        parent_turn_id=MAIN_TURN_ID,
    )
    nested_follow_up = make_turn(
        NESTED_FOLLOW_UP_ID,
        3,
        rubric_snapshot,
        is_follow_up=True,
        parent_turn_id=FOLLOW_UP_ID,
    )
    supabase = make_submit_supabase(
        interview_row,
        [main_turn, follow_up, nested_follow_up],
        next_question=make_question(),
    )
    admin = make_admin()
    ai = make_ai()

    result = await run_submit(
        current_user=current_user,
        turn_id=NESTED_FOLLOW_UP_ID,
        transcript='A detailed answer that still lacks technical depth.',
        supabase=supabase,
        admin=admin,
        ai=ai,
    )

    assert result.next_action == 'select_question'
    assert result.next_turn is not None
    assert result.next_turn.is_follow_up is False
    assert result.next_turn.parent_turn_id is None
    ai.generate_followup.assert_not_awaited()
    selection_calls = [
        call
        for call in supabase.get.await_args_list
        if call.args[0] == 'question_bank' and 'id' not in call.kwargs['params']
    ]
    assert len(selection_calls) == 1
    turn_post = next(call for call in supabase.post.await_args_list if call.args[0] == 'interview_turns')
    assert turn_post.args[1]['question_id'] == str(NEXT_QUESTION_ID)


@pytest.mark.asyncio
async def test_clarification_creates_a_fresh_answerable_turn(
    current_user, interview_row, rubric_snapshot
):
    main_turn = make_turn(MAIN_TURN_ID, 1, rubric_snapshot)
    supabase = make_submit_supabase(interview_row, [main_turn])
    admin = make_admin()
    ai = make_ai(status='uncertain')

    result = await run_submit(
        current_user=current_user,
        turn_id=MAIN_TURN_ID,
        transcript='ok',
        supabase=supabase,
        admin=admin,
        ai=ai,
    )

    assert result.next_action == 'clarify'
    assert result.next_turn is not None
    assert result.next_turn.id == NEXT_TURN_ID
    assert result.next_turn.id != MAIN_TURN_ID
    assert result.next_turn.parent_turn_id == MAIN_TURN_ID
    turn_post = next(call for call in supabase.post.await_args_list if call.args[0] == 'interview_turns')
    assert turn_post.args[1]['sequence_num'] == 2
    assert turn_post.args[1]['is_follow_up'] is True


@pytest.mark.asyncio
async def test_missing_admin_configuration_fails_before_answer_or_provider_write(
    current_user, interview_row
):
    supabase = AsyncMock()
    supabase.get.return_value = [interview_row]
    ai = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await run_submit(
            current_user=current_user,
            turn_id=MAIN_TURN_ID,
            transcript='A valid answer.',
            supabase=supabase,
            admin=None,
            ai=ai,
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == 'Backend persistence service is unavailable'
    supabase.post.assert_not_awaited()
    ai.evaluate_answer.assert_not_awaited()


@pytest.mark.asyncio
async def test_finish_persists_report_and_completes_interview(current_user, interview_row):
    supabase = AsyncMock()

    async def get(path, *, params=None):
        if path == 'interviews':
            return [interview_row]
        if path == 'interview_reports':
            return []
        if path == 'interview_turns':
            return []
        raise AssertionError(f'Unexpected GET {path!r}')

    supabase.get.side_effect = get
    supabase.patch.return_value = [{'id': str(INTERVIEW_ID), 'status': 'finalizing'}]

    ai = AsyncMock()
    ai.generate_report.return_value = {
        'overall_summary': 'Mock interview summary.',
        'overall_score': 0.75,
        'topic_results': {
            'backend': {
                'questions_asked': 1,
                'average_score': 0.75,
                'demonstrated_criteria': ['technical_depth'],
                'missing_criteria': [],
            }
        },
        'strengths': ['Clear trade-offs'],
        'weaknesses': [],
        'recommendations': ['Add metrics'],
        'gemini_model': 'mock-reporter',
    }

    admin = AsyncMock()

    async def admin_post(path, data):
        assert path == 'interview_reports'
        return [{
            'id': str(REPORT_ID),
            **data,
            'generated_at': TIMESTAMP,
        }]

    admin.post.side_effect = admin_post
    admin.patch.return_value = [{'id': str(INTERVIEW_ID), 'status': 'completed'}]

    result = await finish_interview(
        interview_id=INTERVIEW_ID,
        current_user=current_user,
        supabase=supabase,
        admin=admin,
        ai=ai,
    )

    assert result.status == 'completed'
    assert result.report.id == REPORT_ID
    assert result.report.overall_summary == 'Mock interview summary.'
    supabase.patch.assert_awaited_once()
    admin.post.assert_awaited_once()
    completed_payload = admin.patch.await_args.args[1]
    assert completed_payload['status'] == 'completed'


@pytest.mark.asyncio
async def test_completed_report_can_be_retrieved(current_user, interview_row):
    completed_interview = {
        **interview_row,
        'status': 'completed',
        'ended_at': TIMESTAMP,
    }
    report_row = {
        'id': str(REPORT_ID),
        'interview_id': str(INTERVIEW_ID),
        'overall_summary': 'Stored summary.',
        'overall_score': 0.8,
        'topic_results': {},
        'strengths': ['Communication'],
        'weaknesses': [],
        'recommendations': ['Keep practicing'],
        'generated_at': TIMESTAMP,
    }
    supabase = AsyncMock()

    async def get(path, *, params=None):
        if path == 'interviews':
            return [completed_interview]
        if path == 'interview_reports':
            return [report_row]
        raise AssertionError(f'Unexpected GET {path!r}')

    supabase.get.side_effect = get

    result = await get_report(
        interview_id=INTERVIEW_ID,
        current_user=current_user,
        supabase=supabase,
    )

    assert result.id == REPORT_ID
    assert result.interview_id == INTERVIEW_ID
    assert result.overall_summary == 'Stored summary.'
