from typing import Callable

from fastapi import Depends

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from jose import JWTError

from backend.app.core.security import decode_token

from backend.app.exceptions import AuthenticationError

from backend.app.schemas.token import TokenPayload

from backend.app.services.user_service import get_user_by_username



_bearer_scheme = HTTPBearer(auto_error=True)





def _verify_token(expected_type: str) -> Callable[[HTTPAuthorizationCredentials], TokenPayload]:

    def _inner(credentials: HTTPAuthorizationCredentials) -> TokenPayload:

        if not credentials or not credentials.credentials:

            raise AuthenticationError("Missing or invalid token")

        try:

            payload = decode_token(credentials.credentials)

            token_data = TokenPayload(**payload)

        except JWTError:

            raise AuthenticationError("Token validation failed")

        if token_data.type != expected_type:

            raise AuthenticationError(f"Expected {expected_type} token")

        return token_data

    return _inner





def get_access_token_payload(

    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),

) -> TokenPayload:

    return _verify_token("access")(credentials)





def get_refresh_token_payload(

    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),

) -> TokenPayload:

    return _verify_token("refresh")(credentials)





def get_current_user(token: TokenPayload = Depends(get_access_token_payload)) -> dict:

    user = get_user_by_username(token.sub)

    if not user:

        raise AuthenticationError("User not found")

    return {"username": user["username"], "scopes": user.get("scopes", [])}

