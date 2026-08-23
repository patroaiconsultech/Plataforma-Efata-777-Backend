import re
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import Base, engine
from .auth_routes import router as auth_router
from .routes import router
from .team_routes import router as team_router
from .realtime_routes import router as realtime_router
from .voice_routes import router as voice_router
from .tts_routes import router as tts_router
settings=get_settings()
app=FastAPI(title="ORKIO v2 Premium",docs_url="/docs" if settings.environment!="production" else None)
app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in settings.allowed_origins.split(",") if x.strip()],
                   allow_credentials=True,allow_methods=["GET","POST","PATCH","DELETE","OPTIONS"],allow_headers=["Authorization","Content-Type","X-Request-ID"])
app.include_router(auth_router)
app.include_router(router)
app.include_router(team_router)
app.include_router(realtime_router)
app.include_router(voice_router)
app.include_router(tts_router)
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    supplied = request.headers.get("X-Request-ID", "")
    request_id = supplied if _REQUEST_ID_RE.fullmatch(supplied) else str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "microphone=(self)"
    return response

@app.on_event("startup")
def startup():
    if settings.environment in {"development","test"}:
        Base.metadata.create_all(engine)
