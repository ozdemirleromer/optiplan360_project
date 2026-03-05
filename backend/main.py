from app.main import app


if __name__ == "__main__":
    import os
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8080"))
    reload_enabled = os.getenv("UVICORN_RELOAD", "0").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    uvicorn.run("main:app", host=host, port=port, reload=reload_enabled)
