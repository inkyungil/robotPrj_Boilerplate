from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import ADMIN_DATABASE_URL, ROBOT_DATABASE_URL

admin_engine = create_async_engine(ADMIN_DATABASE_URL, echo=False)
AdminSessionLocal = async_sessionmaker(admin_engine, expire_on_commit=False)

robot_engine = create_async_engine(ROBOT_DATABASE_URL, echo=False)
RobotSessionLocal = async_sessionmaker(robot_engine, expire_on_commit=False)


class AdminBase(DeclarativeBase):
    pass


class RobotBase(DeclarativeBase):
    pass


async def get_admin_db() -> AsyncSession:
    async with AdminSessionLocal() as session:
        yield session


async def get_robot_db() -> AsyncSession:
    async with RobotSessionLocal() as session:
        yield session


# Alias for compatibility
get_db = get_admin_db


def _add_missing_columns(conn) -> None:
    """기존 SQLite 테이블에 누락된 컬럼을 추가하는 간단한 마이그레이션.

    create_all 은 새 테이블만 생성하고 컬럼 추가는 하지 않으므로,
    모델에 컬럼을 더한 뒤에도 기존 DB에 반영되도록 ALTER TABLE 을 수행한다.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    wanted: dict[str, dict[str, str]] = {
        "robots": {
            "domain_id": "INTEGER",
            "ai_server_url": "VARCHAR(255)",
        },
    }

    for table, columns in wanted.items():
        if table not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns.items():
            if name not in present:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}'))


async def init_db():
    from app import models  # noqa: F401 — import triggers table registration

    async with admin_engine.begin() as conn:
        await conn.run_sync(AdminBase.metadata.create_all)
        await conn.run_sync(_add_missing_columns)

    async with robot_engine.begin() as conn:
        await conn.run_sync(RobotBase.metadata.create_all)
