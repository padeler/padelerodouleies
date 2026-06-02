"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user_id: int
    pin: str = Field(min_length=4, max_length=4)


class LoginResponse(BaseModel):
    id: int
    name: str
    avatar_kind: str
    avatar_value: str
    role: str
    current_stars: int
    preferred_locale: str
    preferred_theme: str = "system"
    accent_color: str | None = None


class UserPublic(BaseModel):
    """Public-safe user info for the landing page."""
    id: int
    name: str
    avatar_kind: str
    avatar_value: str
    role: str


class ChangePinRequest(BaseModel):
    current_pin: str = Field(min_length=4, max_length=4)
    new_pin: str = Field(min_length=4, max_length=4)


class BootstrapSetupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    avatar_kind: str = "icon"
    avatar_value: str = "shield"
    pin: str = Field(min_length=4, max_length=4)
