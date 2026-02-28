from typing import List, Literal, Optional

from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: Literal["access", "refresh"]
    scopes: Optional[List[str]] = None
