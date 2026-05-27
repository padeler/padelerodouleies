"""Pydantic schemas for admin endpoints."""

from datetime import datetime, time as dtime

from pydantic import BaseModel, ConfigDict, Field


# -- Chore schemas --

class ChoreCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    icon_name: str
    scope: str = "individual"
    points_value: int = Field(gt=0)
    is_repeating: bool = True
    start_time: dtime | None = None
    window_hours: int | None = Field(default=None, ge=1, le=24)
    repeat_days: list[str] | None = None
    n_day_interval: int | None = Field(default=None, ge=1, le=30)


class ChoreUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    icon_name: str | None = None
    scope: str | None = None
    points_value: int | None = Field(default=None, gt=0)
    is_repeating: bool | None = None
    start_time: dtime | None = None
    window_hours: int | None = Field(default=None, ge=1, le=24)
    is_active: bool | None = None
    repeat_days: list[str] | None = None
    n_day_interval: int | None = None


class ChoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None
    icon_name: str
    scope: str
    points_value: int
    is_repeating: bool
    start_time: dtime | None
    window_hours: int | None
    is_active: bool
    repeat_days: list[str] | None
    n_day_interval: int | None
    created_at: datetime


# -- Reward schemas --

class RewardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    icon_name: str
    cost_stars: int = Field(gt=0)
    is_collaborative: bool = False


class RewardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    icon_name: str | None = None
    cost_stars: int | None = Field(default=None, gt=0)
    is_collaborative: bool | None = None
    is_enabled: bool | None = None


class RewardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None
    icon_name: str
    cost_stars: int
    is_collaborative: bool
    is_enabled: bool
    created_at: datetime


# -- User schemas --

class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    avatar_kind: str
    avatar_value: str
    role: str
    current_stars: int
    preferred_locale: str
    is_active: bool


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    avatar_kind: str = "icon"
    avatar_value: str = "fox"
    role: str = "user"
    pin: str = Field(min_length=4, max_length=4)


class AdminUserUpdate(BaseModel):
    name: str | None = None
    avatar_kind: str | None = None
    avatar_value: str | None = None
    role: str | None = None
    is_active: bool | None = None


class PinResetRequest(BaseModel):
    new_pin: str = Field(min_length=4, max_length=4)


class StarAdjustmentRequest(BaseModel):
    points_delta: int
    description: str = Field(min_length=3)


# -- Approval schemas --

class PendingClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    user_name: str
    user_avatar_kind: str
    user_avatar_value: str
    chore_id: int
    chore_icon: str
    chore_title: str
    points_value: int
    claimed_at: datetime


class DeclineRequest(BaseModel):
    admin_note: str | None = None


# -- Fulfillment schemas --

class FulfillmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reward_id: int
    reward_title: str
    reward_icon: str
    user_id: int
    user_name: str
    status: str
    claimed_at: datetime
    fulfilled_at: datetime | None
    stars_contributed: int


# -- History schemas --

class HistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    user_name: str
    action_type: str
    points_delta: int
    ref_table: str | None
    ref_id: int | None
    admin_note: str | None
    timestamp: datetime
    action_label: str | None = None
