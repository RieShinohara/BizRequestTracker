from fastapi import FastAPI

from app.routers import categories, requesters

app = FastAPI(title="BizRequestTracker API")
app.include_router(requesters.router)
app.include_router(categories.router)


@app.get("/health")
def health() -> dict[str, str]:
    """動作確認用。サーバーが起きていれば ok を返す。"""
    return {"status": "ok"}
