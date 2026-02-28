"""
Base Service Pattern for OptiPlan 360
Provides abstract CRUD interface for all business logic services
"""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, List, Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.exceptions import AuthorizationError
import logging

# Generic type for model classes
T = TypeVar('T')


class BaseService(ABC, Generic[T]):
    """
    Abstract base service for CRUD operations on database models.
    
    All business logic services should inherit from this class to ensure
    consistency in error handling, logging, and database operations.
    
    Example:
        class OrderService(BaseService[Order]):
            def get_by_id(self, id: int) -> Order | None:
                return self.db.query(self.model).filter(self.model.id == id).first()
    """
    
    def __init__(self, db: Session, model: type[T]):
        """
        Initialize base service.
        
        Args:
            db: SQLAlchemy database session
            model: SQLAlchemy model class
        """
        self.db = db
        self.model = model
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[T]:
        """
        Retrieve a single record by ID.
        
        Args:
            id: Primary key value
            
        Returns:
            Model instance or None if not found
            
        Raises:
            SQLAlchemyError: On database error
        """
        pass
    
    @abstractmethod
    def create(self, data: Dict[str, Any]) -> T:
        """
        Create a new record.
        
        Args:
            data: Dictionary with model fields
            
        Returns:
            Created model instance
            
        Raises:
            ValueError: If data validation fails
            SQLAlchemyError: On database error
        """
        pass
    
    @abstractmethod
    def update(self, id: int, data: Dict[str, Any]) -> Optional[T]:
        """
        Update an existing record.
        
        Args:
            id: Primary key value
            data: Dictionary with fields to update
            
        Returns:
            Updated model instance or None if not found
            
        Raises:
            ValueError: If data validation fails
            SQLAlchemyError: On database error
        """
        pass
    
    @abstractmethod
    def delete(self, id: int) -> bool:
        """
        Delete a record (or soft-delete if model supports it).
        
        Args:
            id: Primary key value
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            SQLAlchemyError: On database error
        """
        pass
    
    @abstractmethod
    def list(self, skip: int = 0, limit: int = 100) -> List[T]:
        """
        List records with pagination.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return (max 1000)
            
        Returns:
            List of model instances
            
        Raises:
            SQLAlchemyError: On database error
        """
        pass
    
    # ── Yetki & sahiplik kontrolü ──────────────────────────────────
    @staticmethod
    def _assert_can_modify(resource: Any, user: Any) -> None:
        """
        Write operasyonlarında sahiplik ve rol kontrolü.
        ADMIN her şeyi değiştirebilir.
        OPERATOR sadece kendi oluşturduğu kaydı değiştirebilir.
        Diğer roller yazma işlemi yapamaz.

        Args:
            resource: Kontrol edilecek kaynak (created_by alanı olmalı, yoksa atlanır)
            user: Mevcut kullanıcı (role, id alanları olmalı)
        """
        if user is None:
            return  # Sistem düzeyinde işlem, kullanıcı yoksa atla
        role = getattr(user, "role", None)
        if role is None:
            role = ""
        role = role.upper()
        if role == "ADMIN":
            return
        if role in ("OPERATOR", "SALES"):
            created_by = getattr(resource, "created_by", None) or getattr(resource, "created_by_id", None)
            user_id = getattr(user, "id", None)
            if created_by is not None and user_id is not None and str(created_by) != str(user_id):
                raise AuthorizationError(
                    "Yalnızca kendi oluşturduğunuz kaydı değiştirebilirsiniz"
                )
            return
        raise AuthorizationError("Bu işlem için yetersiz rol")

    @staticmethod
    def _assert_write_role(user: Any, admin_only: bool = False) -> None:
        """
        Yeni kayıt oluşturmada rol kontrolü (sahiplik kontrolü gerekmez).
        admin_only=True ise sadece ADMIN izinli.

        Args:
            user: Mevcut kullanıcı
            admin_only: True ise sadece ADMIN
        """
        if user is None:
            return
        role = (getattr(user, "role", None) or "").upper()
        if role == "ADMIN":
            return
        if admin_only:
            raise AuthorizationError("Bu işlem yalnızca yöneticiler tarafından yapılabilir")
        if role in ("OPERATOR", "SALES"):
            return
        raise AuthorizationError("Bu işlem için yetersiz rol")

    def list_all(self) -> List[T]:
        """
        Retrieve all records without pagination.
        
        Use with caution on large tables!
        
        Returns:            List of all model instances
            
        Raises:
            SQLAlchemyError: On database error
        """
        try:
            return self.db.query(self.model).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Failed to list all {self.model.__name__}: {str(e)}")
            raise
    
    def exists(self, id: int) -> bool:
        """
        Check if a record exists by ID.
        
        Args:
            id: Primary key value
            
        Returns:
            True if exists, False otherwise
            
        Raises:
            SQLAlchemyError: On database error
        """
        try:
            return self.db.query(self.model).filter(self.model.id == id).first() is not None
        except SQLAlchemyError as e:
            self.logger.error(f"Failed to check existence of {self.model.__name__} {id}: {str(e)}")
            raise
    
    def count(self) -> int:
        """
        Get total count of records.
        
        Returns:
            Total number of records in table
            
        Raises:
            SQLAlchemyError: On database error
        """
        try:
            return self.db.query(self.model).count()
        except SQLAlchemyError as e:
            self.logger.error(f"Failed to count {self.model.__name__}: {str(e)}")
            raise
    
    def _handle_error(self, operation: str, error: Exception, **context) -> None:
        """
        Centralized error handling and logging.
        
        Args:
            operation: Name of operation (e.g., "create", "update")
            error: Exception that occurred
            **context: Additional context for logging
        """
        error_msg = f"Service {self.__class__.__name__} - {operation} failed"
        if context:
            error_msg += f" | Context: {context}"
        
        self.logger.error(f"{error_msg}: {str(error)}", exc_info=True)


class CRUDService(BaseService[T]):
    """
    Generic CRUD service implementation.
    
    Can be used directly for simple models or extended for complex logic.
    
    Example:
        user_service = CRUDService(db, User)
        user = user_service.create({"username": "john", "email": "john@example.com"})
    """
    
    def get_by_id(self, id: int) -> Optional[T]:
        """Get single record by ID."""
        try:
            return self.db.query(self.model).filter(self.model.id == id).first()
        except SQLAlchemyError as e:
            self._handle_error("get_by_id", e, id=id)
            raise
    
    def create(self, data: Dict[str, Any]) -> T:
        """Create new record."""
        try:
            instance = self.model(**data)
            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)
            self.logger.info(f"Created {self.model.__name__} with id={instance.id}")
            return instance
        except SQLAlchemyError as e:
            self.db.rollback()
            self._handle_error("create", e, data=data)
            raise
    
    def update(self, id: int, data: Dict[str, Any]) -> Optional[T]:
        """Update existing record."""
        try:
            instance = self.db.query(self.model).filter(self.model.id == id).first()
            if not instance:
                self.logger.warning(f"{self.model.__name__} {id} not found for update")
                return None
            
            for key, value in data.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)
            
            self.db.commit()
            self.db.refresh(instance)
            self.logger.info(f"Updated {self.model.__name__} {id}")
            return instance
        except SQLAlchemyError as e:
            self.db.rollback()
            self._handle_error("update", e, id=id, data=data)
            raise
    
    def delete(self, id: int) -> bool:
        """Delete record (hard delete)."""
        try:
            instance = self.db.query(self.model).filter(self.model.id == id).first()
            if not instance:
                self.logger.warning(f"{self.model.__name__} {id} not found for deletion")
                return False
            
            self.db.delete(instance)
            self.db.commit()
            self.logger.info(f"Deleted {self.model.__name__} {id}")
            return True
        except SQLAlchemyError as e:
            self.db.rollback()
            self._handle_error("delete", e, id=id)
            raise
    
    def list(self, skip: int = 0, limit: int = 100) -> List[T]:
        """List records with pagination."""
        try:
            # Ensure limit is reasonable
            limit = min(limit, 1000)
            skip = max(skip, 0)
            
            return self.db.query(self.model).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            self._handle_error("list", e, skip=skip, limit=limit)
            raise


class SoftDeleteService(CRUDService[T]):
    """
    CRUD service with soft-delete support.
    
    Assumes model has a 'deleted_at' column for soft deletes.
    """
    
    def get_by_id(self, id: int) -> Optional[T]:
        """Get single active record by ID."""
        try:
            return (
                self.db.query(self.model)
                .filter(self.model.id == id, self.model.deleted_at.is_(None))
                .first()
            )
        except SQLAlchemyError as e:
            self._handle_error("get_by_id", e, id=id)
            raise
    
    def list(self, skip: int = 0, limit: int = 100) -> List[T]:
        """List active records with pagination."""
        try:
            limit = min(limit, 1000)
            skip = max(skip, 0)
            
            return (
                self.db.query(self.model)
                .filter(self.model.deleted_at.is_(None))
                .offset(skip)
                .limit(limit)
                .all()
            )
        except SQLAlchemyError as e:
            self._handle_error("list", e, skip=skip, limit=limit)
            raise
    
    def delete(self, id: int) -> bool:
        """Soft delete a record."""
        try:
            from datetime import datetime
            
            instance = (
                self.db.query(self.model)
                .filter(self.model.id == id, self.model.deleted_at.is_(None))
                .first()
            )
            if not instance:
                self.logger.warning(f"{self.model.__name__} {id} not found for soft deletion")
                return False
            
            instance.deleted_at = datetime.utcnow()
            self.db.commit()
            self.logger.info(f"Soft deleted {self.model.__name__} {id}")
            return True
        except SQLAlchemyError as e:
            self.db.rollback()
            self._handle_error("delete", e, id=id)
            raise
    
    def restore(self, id: int) -> Optional[T]:
        """Restore a soft-deleted record."""
        try:
            instance = self.db.query(self.model).filter(self.model.id == id).first()
            if not instance or instance.deleted_at is None:
                self.logger.warning(f"{self.model.__name__} {id} not found or not deleted")
                return None
            
            instance.deleted_at = None
            self.db.commit()
            self.db.refresh(instance)
            self.logger.info(f"Restored {self.model.__name__} {id}")
            return instance
        except SQLAlchemyError as e:
            self.db.rollback()
            self._handle_error("restore", e, id=id)
            raise
