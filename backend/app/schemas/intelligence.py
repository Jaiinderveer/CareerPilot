"""Pydantic contracts for career intelligence APIs."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RecruiterResponse(BaseModel):
    """Recruiter representation."""
    model_config = ConfigDict(extra='ignore')

    id: UUID
    name: str
    description: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    hiring_status: Optional[str] = None
    data_source: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: str
    created_at: datetime
    updated_at: datetime


class RoleResponse(BaseModel):
    """Role representation."""
    model_config = ConfigDict(extra='ignore')

    id: UUID
    recruiter_id: UUID
    title: str
    job_type: Optional[str] = None
    description: Optional[str] = None
    minimum_cgpa: Optional[float] = None
    eligible_branches: Optional[list[str]] = None
    eligible_graduation_years: Optional[list[int]] = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    location: Optional[str] = None
    application_url: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: str
    created_at: datetime
    updated_at: datetime
    recruiter: Optional[RecruiterResponse] = None


class QuestionResponse(BaseModel):
    """Interview question representation."""
    model_config = ConfigDict(extra='ignore')

    id: UUID
    experience_id: UUID
    question_text: str
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    question_type: Optional[str] = None
    created_at: datetime


class ExperienceResponse(BaseModel):
    """Interview experience representation."""
    model_config = ConfigDict(extra='ignore')

    id: UUID
    recruiter_id: UUID
    role_id: Optional[UUID] = None
    title: str
    interview_year: Optional[int] = None
    round_name: Optional[str] = None
    experience_text: Optional[str] = None
    source_type: str
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: str
    created_at: datetime
    questions: list[QuestionResponse] = Field(default_factory=list)
