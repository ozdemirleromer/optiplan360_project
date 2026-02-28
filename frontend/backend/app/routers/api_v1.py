from fastapi import APIRouter, Depends

from backend.app.dependencies import get_current_user

router = APIRouter()


@router.get("/status")
def read_status(current_user: dict = Depends(get_current_user)):
    return {
        "status": "ok",
        "user": current_user["username"],
        "scopes": current_user["scopes"],
    }
