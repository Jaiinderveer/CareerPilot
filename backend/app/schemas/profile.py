"""Pydantic contracts for profile APIs."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProfileResponse(BaseModel):
    """Public profile representation returned to its owner."""

    model_config = ConfigDict(extra='ignore')

    id: UUID
    full_name: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    location: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    career_interests: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    """Allowed partial profile update fields."""

    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)

    full_name: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    location: Optional[str] = None
    skills: Optional[list[str]] = None
    career_interests: Optional[list[str]] = None

    @field_validator('graduation_year')
    @classmethod
    def validate_graduation_year(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not 1900 <= value <= 2100:
            raise ValueError('graduation_year must be between 1900 and 2100')
        return value

    @field_validator('cgpa')
    @classmethod
    def validate_cgpa(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not 0 <= value <= 10:
            raise ValueError('cgpa must be between 0 and 10')
        return value


class MeResponse(BaseModel):
    """Verified current-user response."""

    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
