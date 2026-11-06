from fastapi import FastAPI

app = FastAPI(title="BizRequestTracker API")


@app.get("/health")
def health() -> dict[str, str]:
    """動作確認用。サーバーが起きていれば ok を返す。"""
    return {"status": "ok"}
