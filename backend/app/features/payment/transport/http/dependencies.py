from typing import Annotated

from fastapi import Depends

from app.auth import require_permissions
from app.models import User
from app.permissions import Permission

PaymentCreateUser = Annotated[User, Depends(require_permissions(Permission.PAYMENT_CREATE))]
PaymentViewUser = Annotated[User, Depends(require_permissions(Permission.PAYMENT_VIEW))]
PaymentEditUser = Annotated[User, Depends(require_permissions(Permission.PAYMENT_EDIT))]

__all__ = ["PaymentCreateUser", "PaymentViewUser", "PaymentEditUser"]
