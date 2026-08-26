from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orkio_v2.auth import Principal
from orkio_v2.config import Settings
from orkio_v2.database import Base
from orkio_v2.models import Membership, Tenant, User
from orkio_v2.routes import agents_catalog
from orkio_v2.services.authorization import resolve_provisioned_roles
from orkio_v2.services.capability_plane import privileged_roles
from orkio_v2.services.hyper_cocreator import is_allowlisted_admin


def _db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def _settings() -> Settings:
    return Settings(
        PLATFORM_ENVIRONMENT="test",
        PLATFORM_AUTH_MODE="test",
        PLATFORM_INVITATION_TOKEN_SECRET="x" * 40,
        PLATFORM_ADMIN_EMAIL_ALLOWLIST="daniel@patroai.com",
        PLATFORM_OWNER_SUBJECT="native:daniel@patroai.com",
    )


def test_superadmin_is_canonical_admin_owner_and_platform_owner():
    db = _db()
    try:
        db.add(Tenant(id="patroai", name="PatroAI"))
        db.add(User(
            id="daniel",
            external_subject="native:daniel@patroai.com",
            email="daniel@patroai.com",
            display_name="Daniel",
        ))
        db.add(Membership(tenant_id="patroai", user_id="daniel", role="superadmin", active=True))
        db.commit()
        roles = resolve_provisioned_roles(
            db,
            tenant_id="patroai",
            user_id="daniel",
            external_subject="native:daniel@patroai.com",
            settings=_settings(),
        )
        assert roles == ("admin", "owner", "platform_owner", "superadmin")
        principal = Principal("daniel", "patroai", roles, "daniel@patroai.com", "native:daniel@patroai.com")
        assert privileged_roles(principal.roles)
        assert is_allowlisted_admin(principal, _settings())
        assert len(agents_catalog(p=principal, settings=_settings())) > 1
    finally:
        db.close()


def test_member_is_not_elevated_by_allowlisted_email_alone():
    principal = Principal(
        "member",
        "patroai",
        ("member",),
        "daniel@patroai.com",
        "native:member",
    )
    assert not privileged_roles(principal.roles)
    assert not is_allowlisted_admin(principal, _settings())
