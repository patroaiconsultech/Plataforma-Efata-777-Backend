import os
os.environ.update({
 "PLATFORM_ENVIRONMENT":"test","PLATFORM_AUTH_MODE":"test",
 "PLATFORM_INVITATION_TOKEN_SECRET":"x"*40,"DATABASE_URL":"sqlite+pysqlite:///:memory:"
})
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from orkio_v2.main import app
from orkio_v2.database import Base,get_db
from orkio_v2.models import Tenant,User,Membership
engine=create_engine("sqlite+pysqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool)
Testing=sessionmaker(bind=engine,expire_on_commit=False)
Base.metadata.create_all(engine)
def override_db():
    db=Testing()
    try: yield db
    finally: db.close()
app.dependency_overrides[get_db]=override_db
@pytest.fixture()
def client():
    with Testing() as db:
      if not db.get(Tenant,"tenant-1"):
        db.add(Tenant(id="tenant-1",name="Test"))
        db.add(User(id="user-1",external_subject="sub-1",email="owner@example.com",display_name="Owner"))
        db.add(User(id="user-2",external_subject="sub-2",email="guest@example.com",display_name="Guest"))
        db.add(Membership(tenant_id="tenant-1",user_id="user-1",role="admin"))
        db.commit()
    return TestClient(app)
def headers(user="user-1",roles="admin",tenant="tenant-1"):
    email = "guest@example.com" if user == "user-2" else "owner@example.com"
    return {"X-Test-User":user,"X-Test-Tenant":tenant,"X-Test-Roles":roles,"X-Test-Email":email}
