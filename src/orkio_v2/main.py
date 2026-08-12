from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import Base, engine
from .routes import router
from .team_routes import router as team_router
from .realtime_routes import router as realtime_router
from .voice_routes import router as voice_router
from .tts_routes import router as tts_router

settings=get_settings()
app=FastAPI(title="ORKIO v2 Premium",docs_url="/docs" if settings.environment!="production" else None)
app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in settings.allowed_origins.split(",") if x.strip()],
                   allow_credentials=True,allow_methods=["GET","POST","PATCH","DELETE","OPTIONS"],allow_headers=["Authorization","Content-Type","X-Request-ID"])
app.include_router(router)
app.include_router(team_router)
app.include_router(realtime_router)
app.include_router(voice_router)
app.include_router(tts_router)

@app.on_event("startup")
def startup():
    if settings.environment in {"development","test"}:
        Base.metadata.create_all(engine)
