"""Regression tests for deterministic interview opening-question selection."""

from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.core.security import AuthenticatedUser
from app.routers.interviews import start_interview


INTERVIEW_ID = UUID('11111111-1111-1111-1111-111111111111')
CANDIDATE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
QUESTION_ID = '22222222-2222-4222-8222-222222222222'
OTHER_QUESTION_ID = '33333333-3333-4333-8333-333333333333'
RUBRIC_ID = '44444444-4444-4444-8444-444444444444'
TURN_ID = '55555555-5555-4555-8555-555555555555'


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
        'status': 'planned',
        # Real setup values must still allow generic seed rows with null context.
        'role': 'Software Engineer',
        'round': 'Technical',
        'company_id': None,
        'job_description': None,
        'resume_url': None,
    }


@pytest.fixture
def question_row() -> dict:
    return {
        'id': QUESTION_ID,
        'question_text': 'Describe a challenging project you built.',
        'role': None,
        'round': None,
        'difficulty': 2,
        'rubric_version': 1,
        'review_status': 'reviewed',
        'created_at': '2026-01-01T00:00:00Z',
    }


@pytest.fixture
def rubric_row() -> dict:
    return {
        'id': RUBRIC_ID,
        'question_id': QUESTION_ID,
        'version': 1,
        'expected_concepts': {'critical': ['technical_depth']},
        'scoring_guidance': 'Assess technical depth and communication.',
    }


@pytest.fixture
def criteria_rows() -> list[dict]:
    return [
        {
            'criterion_id': 'technical_depth',
            'description': 'Shows technical depth',
            'importance': 'critical',
            'weight': 1.0,
        },
    ]


@pytest.fixture
def turn_row() -> dict:
    return {
        'id': TURN_ID,
        'interview_id': str(INTERVIEW_ID),
        'sequence_num': 1,
        'question_id': QUESTION_ID,
        'question_text': 'Describe a challenging project you built.',
        'rubric_snapshot': {},
        'is_follow_up': False,
        'parent_turn_id': None,
        'target_criterion_id': None,
        'asked_at': '2026-01-01T00:00:00Z',
    }


def make_ai(plan) -> AsyncMock:
    ai = AsyncMock()
    ai.plan_interview.return_value = plan
    return ai


def make_supabase(
    interview_row: dict,
    question_row: dict,
    rubric_row: dict,
    criteria_rows: list[dict],
    turn_row: dict,
    *,
    planner_question_result: list[dict] | None = None,
    fallback_rows: list[dict] | None = None,
) -> AsyncMock:
    supabase = AsyncMock()

    async def get(path, *, params=None):
        if path == 'interviews':
            return [interview_row]
        if path == 'question_bank' and params and 'id' in params:
            return [question_row]
        if path == 'question_bank':
            return [question_row] if fallback_rows is None else fallback_rows
        if path == 'question_rubrics':
            return [rubric_row]
        if path == 'rubric_criteria':
            return criteria_rows
        if path == 'interview_turns':
            return []
        raise AssertionError(f'Unexpected GET {path!r} with params {params!r}')

    # Mutable holder lets an invalid planner lookup differ from the subsequent
    # lookup of the deterministic fallback question.
    nonlocal_planner = [planner_question_result]

    async def get_with_one_time_planner_result(path, *, params=None):
        if path == 'question_bank' and params and 'id' in params and nonlocal_planner[0] is not None:
            result = nonlocal_planner[0]
            nonlocal_planner[0] = None
            return result
        return await get(path, params=params)

    supabase.get.side_effect = get_with_one_time_planner_result
    supabase.post.return_value = [turn_row]
    supabase.patch.return_value = [{'status': 'active'}]
    return supabase


async def run_start(current_user, ai, supabase):
    return await start_interview(
        interview_id=INTERVIEW_ID,
        current_user=current_user,
        supabase=supabase,
        ai=ai,
    )


@pytest.mark.asyncio
async def test_valid_gemini_response_uses_validated_question(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({
        'first_question_id': QUESTION_ID,
        'question_ids': [QUESTION_ID],
    })
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    assert result.first_turn.question_text == question_row['question_text']
    question_bank_calls = [
        call for call in supabase.get.await_args_list if call.args[0] == 'question_bank'
    ]
    assert len(question_bank_calls) == 1
    assert question_bank_calls[0].kwargs['params']['id'] == f'eq.{QUESTION_ID}'


@pytest.mark.asyncio
async def test_empty_question_ids_fall_back_to_question_bank(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    fallback_call = next(
        call
        for call in supabase.get.await_args_list
        if call.args[0] == 'question_bank' and 'id' not in call.kwargs['params']
    )
    assert fallback_call.kwargs['params']['order'] == 'difficulty.asc,created_at.asc,id.asc'
    assert fallback_call.kwargs['params']['review_status'] == 'eq.reviewed'
    assert 'role' not in fallback_call.kwargs['params']
    assert 'round' not in fallback_call.kwargs['params']


@pytest.mark.asyncio
async def test_valid_question_ids_list_is_used_when_first_id_is_empty(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({'first_question_id': None, 'question_ids': [QUESTION_ID]})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    question_bank_calls = [
        call for call in supabase.get.await_args_list if call.args[0] == 'question_bank'
    ]
    assert len(question_bank_calls) == 1
    assert question_bank_calls[0].kwargs['params']['id'] == f'eq.{QUESTION_ID}'


@pytest.mark.asyncio
async def test_invalid_question_ids_fall_back_without_inventing_an_id(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({
        'first_question_id': OTHER_QUESTION_ID,
        'question_ids': ['not-a-uuid'],
    })
    supabase = make_supabase(
        interview_row,
        question_row,
        rubric_row,
        criteria_rows,
        turn_row,
        planner_question_result=[],
    )

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    posted_payload = supabase.post.await_args.args[1]
    assert posted_payload['question_id'] == QUESTION_ID


@pytest.mark.asyncio
async def test_valid_but_ineligible_planner_id_falls_back(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    planner_question = {
        **question_row,
        'id': OTHER_QUESTION_ID,
        'role': 'Data Analyst',
    }
    ai = make_ai({'first_question_id': OTHER_QUESTION_ID, 'question_ids': []})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)
    original_get = supabase.get.side_effect

    async def get_with_ineligible_planner_question(path, *, params=None):
        if path == 'question_bank' and params and params.get('id') == f'eq.{OTHER_QUESTION_ID}':
            return [planner_question]
        return await original_get(path, params=params)

    supabase.get.side_effect = get_with_ineligible_planner_question

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    assert supabase.post.await_args.args[1]['question_id'] == QUESTION_ID


@pytest.mark.asyncio
async def test_malformed_planner_response_falls_back(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai('malformed planner response')
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    assert result.first_turn.question_text == question_row['question_text']


@pytest.mark.asyncio
async def test_empty_eligible_question_bank_returns_actionable_error(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(
        interview_row,
        question_row,
        rubric_row,
        criteria_rows,
        turn_row,
        fallback_rows=[],
    )

    with pytest.raises(HTTPException) as exc_info:
        await run_start(current_user, ai, supabase)

    assert exc_info.value.status_code == 503
    assert 'No eligible reviewed questions with rubrics' in exc_info.value.detail
    supabase.post.assert_not_awaited()
    supabase.patch.assert_not_awaited()


@pytest.mark.asyncio
async def test_opening_turn_is_persisted_exactly_once(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    result = await run_start(current_user, ai, supabase)

    assert result.first_turn.id == UUID(TURN_ID)
    supabase.post.assert_awaited_once()
    assert supabase.post.await_args.args[0] == 'interview_turns'
    payload = supabase.post.await_args.args[1]
    assert payload['interview_id'] == str(INTERVIEW_ID)
    assert payload['sequence_num'] == 1
    assert payload['question_id'] == QUESTION_ID
    assert payload['question_text'] == question_row['question_text']
    supabase.patch.assert_awaited_once()


@pytest.mark.asyncio
async def test_fallback_prefers_exact_context_over_easier_generic_question(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    generic_question = {
        **question_row,
        'id': OTHER_QUESTION_ID,
        'role': None,
        'round': None,
        'difficulty': 1,
        'created_at': '2025-01-01T00:00:00Z',
    }
    exact_question = {
        **question_row,
        'role': interview_row['role'],
        'round': interview_row['round'],
        'difficulty': 3,
    }
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(interview_row, exact_question, rubric_row, criteria_rows, turn_row)
    original_get = supabase.get.side_effect

    async def get_with_generic_first(path, *, params=None):
        if path == 'question_bank' and params and 'id' not in params:
            return [generic_question, exact_question]
        return await original_get(path, params=params)

    supabase.get.side_effect = get_with_generic_first

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    assert supabase.post.await_args.args[1]['question_id'] == QUESTION_ID


@pytest.mark.asyncio
async def test_fallback_skips_reviewed_question_without_rubric(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    first_question = {
        **question_row,
        'id': OTHER_QUESTION_ID,
        'difficulty': 1,
        'created_at': '2025-01-01T00:00:00Z',
    }
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)
    original_get = supabase.get.side_effect

    async def get_with_missing_first_rubric(path, *, params=None):
        if path == 'question_bank' and params and 'id' not in params:
            return [first_question, question_row]
        if path == 'question_bank' and params and params.get('id') == f'eq.{OTHER_QUESTION_ID}':
            return [first_question]
        if path == 'question_rubrics' and params and params.get('question_id') == f'eq.{OTHER_QUESTION_ID}':
            return []
        return await original_get(path, params=params)

    supabase.get.side_effect = get_with_missing_first_rubric

    result = await run_start(current_user, ai, supabase)

    assert result.status == 'active'
    assert supabase.post.await_args.args[1]['question_id'] == QUESTION_ID


@pytest.mark.asyncio
async def test_existing_first_turn_blocks_duplicate_persistence(
    current_user, interview_row, question_row, rubric_row, criteria_rows, turn_row
):
    ai = make_ai({'first_question_id': None, 'question_ids': []})
    supabase = make_supabase(interview_row, question_row, rubric_row, criteria_rows, turn_row)

    original_get = supabase.get.side_effect

    async def get_with_existing_turn(path, *, params=None):
        if path == 'interview_turns':
            return [turn_row]
        return await original_get(path, params=params)

    supabase.get.side_effect = get_with_existing_turn

    with pytest.raises(HTTPException) as exc_info:
        await run_start(current_user, ai, supabase)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == 'Interview already has a first turn'
    supabase.post.assert_not_awaited()
    supabase.patch.assert_not_awaited()
