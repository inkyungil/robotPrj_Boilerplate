from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

from .models import AdminRole


class LoginRequest(BaseModel):
    username: str
    password: str


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: AdminRole
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


class AdminCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=128)
    role: AdminRole = AdminRole.admin
    is_active: bool = True


class AdminUpdate(BaseModel):
    password: str | None = Field(default=None, min_length=6, max_length=128)
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=128)
    role: AdminRole | None = None
    is_active: bool | None = None


class AdminListResponse(BaseModel):
    items: list[AdminOut]
    total: int


class DayCount(BaseModel):
    date: str
    count: int


class DashboardStats(BaseModel):
    total_admins: int
    active_admins: int
    total_conversations: int
    total_messages: int
    selected_model: str | None = None
    conversations_per_day: list[DayCount]
    recent_admins: list[AdminOut]


# --- Dev Center: schema introspection (camelCase JSON for the frontend) ---


class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class SchemaColumn(_CamelModel):
    name: str
    type: str
    key: str = ""  # "PK" | "FK" | "UQ" | ""
    nullable: bool
    default_value: str | None = None
    description: str = ""


class SchemaTable(_CamelModel):
    table_name: str
    description: str = ""
    columns: list[SchemaColumn]


class ErdRelation(_CamelModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str


class ErdResponse(_CamelModel):
    tables: list[SchemaTable]
    relations: list[ErdRelation]


# --- Mobile Member & Robot Task Schemas ---

class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None = None
    email: str | None = None
    is_active: bool
    created_at: datetime | None = None


class MemberTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut


class MemberCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=4, max_length=128)  # relax min_length to 4 for easier testing
    full_name: str | None = Field(default=None, max_length=128)
    email: EmailStr | None = Field(default=None)



class RobotTaskCreate(BaseModel):
    book_id: int


class RobotTaskOut(_CamelModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    book_id: int
    status: str
    zone: str
    shelf: str
    created_at: datetime
    updated_at: datetime
    book_title: str | None = None

