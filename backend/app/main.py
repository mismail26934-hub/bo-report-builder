from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.bo_report import router as bo_router

app = FastAPI(title=settings.app_name)

allow_all = settings.cors_origin_list == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else settings.cors_origin_list,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bo_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BO Report API", "docs": "/docs"}
