from fastapi import FastAPI

from app.routers import categories, confirm_targets, requesters, requests, summary

app = FastAPI(title="BizRequestTracker API")
app.include_router(requests.router)
app.include_router(summary.router)
app.include_router(confirm_targets.router)
app.include_router(requesters.router)
app.include_router(categories.router)


@app.get("/health")
def health() -> dict[str, str]:
    """動作確認用。サーバーが起きていれば ok を返す。"""
    return {"status": "ok"}
