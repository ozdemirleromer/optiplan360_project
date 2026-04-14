"""
OptiPlan 360 - Database Migration Manager
Zero-downtime migration stratejileri ve versiyon kontrolü

Bu modül:
- Migration planlama ve yönetim
- Rollback stratejileri
- Online schema değişiklikleri
- Migration audit logging
"""

import logging
import time
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import sqlalchemy as sa
from sqlalchemy.orm import Session
from alembic import command
from alembic.config import Config
from alembic.runtime import migration

logger = logging.getLogger(__name__)


class MigrationType(Enum):
    """Migration tipi"""
    SCHEMA_CHANGE = "schema_change"
    DATA_MIGRATION = "data_migration"
    INDEX_CREATION = "index_creation"
    CONSTRAINT_ADDITION = "constraint_addition"
    BACKWARD_COMPATIBLE = "backward_compatible"
    BREAKING_CHANGE = "breaking_change"


class MigrationStatus(Enum):
    """Migration durumu"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class MigrationStep:
    """Migration adımı"""
    step_id: str
    description: str
    migration_type: MigrationType
    up_sql: str
    down_sql: str
    estimated_duration_seconds: int
    requires_downtime: bool = False
    check_sql: Optional[str] = None  # Validation SQL


@dataclass
class MigrationPlan:
    """Migration planı"""
    plan_id: str
    version: str
    description: str
    steps: List[MigrationStep]
    created_at: datetime
    created_by: str


@dataclass
class MigrationRecord:
    """Migration kaydı"""
    migration_id: str
    version: str
    revision: str
    started_at: datetime
    completed_at: Optional[datetime]
    status: MigrationStatus
    duration_seconds: float
    error_message: Optional[str] = None


class MigrationManager:
    """
    Database migration manager.
    """
    
    def __init__(self, alembic_config_path: str):
        self.alembic_cfg = Config(alembic_config_path)
        self.history: List[MigrationRecord] = []
        
    def get_current_revision(self, db_url: str) -> Optional[str]:
        """Mevcut database revision'ı al"""
        try:
            engine = sa.create_engine(db_url)
            with engine.connect() as conn:
                context = migration.MigrationContext.configure(conn)
                return context.get_current_revision()
        except Exception as e:
            logger.error(f"Failed to get current revision: {e}")
            return None
    
    def get_pending_migrations(self, db_url: str) -> List[Dict]:
        """Bekleyen migration'ları al"""
        try:
            engine = sa.create_engine(db_url)
            with engine.connect() as conn:
                context = migration.MigrationContext.configure(conn)
                current_rev = context.get_current_revision()
                
                # Get all revisions
                script = command.ScriptDirectory.from_config(self.alembic_cfg)
                all_revisions = list(script.walk_revisions())
                
                # Find pending revisions
                pending = []
                for rev in all_revisions:
                    if rev.revision == current_rev:
                        break
                    pending.append({
                        'revision': rev.revision,
                        'down_revision': rev.down_revision,
                        'description': rev.doc,
                        'path': rev.path
                    })
                
                return pending
        except Exception as e:
            logger.error(f"Failed to get pending migrations: {e}")
            return []
    
    def check_migration_safety(self, revision: str) -> Dict:
        """Migration güvenliğini kontrol et"""
        script = command.ScriptDirectory.from_config(self.alembic_cfg)
        rev = script.get_revision(revision)
        
        safety_checks = {
            'has_downtime': False,
            'breaking_change': False,
            'warnings': [],
            'recommendations': []
        }
        
        if rev:
            # Read migration file
            with open(rev.path, 'r') as f:
                content = f.read()
            
            # Check for potentially dangerous operations
            dangerous_ops = [
                'DROP TABLE', 'DROP COLUMN', 'RENAME',
                'ALTER COLUMN.*TYPE', 'DELETE FROM', 'TRUNCATE'
            ]
            
            for op in dangerous_ops:
                if op.upper() in content.upper():
                    safety_checks['has_downtime'] = True
                    safety_checks['warnings'].append(f"Contains: {op}")
            
            # Check for breaking changes
            breaking_patterns = [
                'NOT NULL', 'DROP CONSTRAINT', 'ALTER.*DROP'
            ]
            
            for pattern in breaking_patterns:
                if pattern.upper() in content.upper():
                    safety_checks['breaking_change'] = True
        
        return safety_checks
    
    def run_migration(
        self,
        db_url: str,
        target_revision: Optional[str] = None,
        dry_run: bool = False
    ) -> MigrationRecord:
        """
        Migration çalıştır.
        
        Args:
            db_url: Database URL
            target_revision: Hedef revision (None = en son)
            dry_run: Sadece simülasyon
            
        Returns:
            MigrationRecord
        """
        start_time = time.time()
        
        record = MigrationRecord(
            migration_id=f"{datetime.utcnow().isoformat()}_{target_revision or 'head'}",
            version=target_revision or "head",
            revision=target_revision or "",
            started_at=datetime.utcnow(),
            completed_at=None,
            status=MigrationStatus.IN_PROGRESS,
            duration_seconds=0.0
        )
        
        try:
            if dry_run:
                logger.info("Dry run mode - checking migration...")
                pending = self.get_pending_migrations(db_url)
                
                for p in pending:
                    safety = self.check_migration_safety(p['revision'])
                    logger.info(f"Migration {p['revision']}: {safety}")
                
                record.status = MigrationStatus.COMPLETED
                record.completed_at = datetime.utcnow()
                
            else:
                # Run actual migration
                self.alembic_cfg.set_main_option("sqlalchemy.url", db_url)
                
                if target_revision:
                    command.upgrade(self.alembic_cfg, target_revision)
                else:
                    command.upgrade(self.alembic_cfg, "head")
                
                record.status = MigrationStatus.COMPLETED
                record.completed_at = datetime.utcnow()
                
                duration = time.time() - start_time
                record.duration_seconds = duration
                
                logger.info(f"Migration completed in {duration:.2f} seconds")
        
        except Exception as e:
            record.status = MigrationStatus.FAILED
            record.error_message = str(e)
            logger.error(f"Migration failed: {e}")
            raise
        
        finally:
            if record.completed_at is None:
                record.completed_at = datetime.utcnow()
            record.duration_seconds = time.time() - start_time
            self.history.append(record)
        
        return record
    
    def rollback_migration(
        self,
        db_url: str,
        steps: int = 1
    ) -> MigrationRecord:
        """
        Migration'ı geri al.
        
        Args:
            db_url: Database URL
            steps: Kaç adım geri al
            
        Returns:
            MigrationRecord
        """
        start_time = time.time()
        
        record = MigrationRecord(
            migration_id=f"rollback_{datetime.utcnow().isoformat()}",
            version=f"-{steps}",
            revision="",
            started_at=datetime.utcnow(),
            completed_at=None,
            status=MigrationStatus.IN_PROGRESS,
            duration_seconds=0.0
        )
        
        try:
            self.alembic_cfg.set_main_option("sqlalchemy.url", db_url)
            command.downgrade(self.alembic_cfg, f"-{steps}")
            
            record.status = MigrationStatus.ROLLED_BACK
            record.completed_at = datetime.utcnow()
            
            duration = time.time() - start_time
            record.duration_seconds = duration
            
            logger.info(f"Rollback completed in {duration:.2f} seconds")
            
        except Exception as e:
            record.status = MigrationStatus.FAILED
            record.error_message = str(e)
            logger.error(f"Rollback failed: {e}")
            raise
        
        finally:
            if record.completed_at is None:
                record.completed_at = datetime.utcnow()
            record.duration_seconds = time.time() - start_time
            self.history.append(record)
        
        return record
    
    def create_zero_downtime_plan(
        self,
        table_name: str,
        operation: str,
        **kwargs
    ) -> MigrationPlan:
        """
        Zero-downtime migration planı oluştur.
        
        Bu method, online schema değişiklikleri için multi-step
        migration planı oluşturur.
        
        Example: Add column with zero downtime
        """
        steps = []
        
        if operation == "add_column":
            column_name = kwargs.get('column_name')
            column_type = kwargs.get('column_type')
            default_value = kwargs.get('default_value')
            
            steps = [
                MigrationStep(
                    step_id="1",
                    description=f"Add {column_name} as nullable",
                    migration_type=MigrationType.BACKWARD_COMPATIBLE,
                    up_sql=f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} NULL;",
                    down_sql=f"ALTER TABLE {table_name} DROP COLUMN {column_name};",
                    estimated_duration_seconds=30,
                    requires_downtime=False
                ),
                MigrationStep(
                    step_id="2",
                    description=f"Backfill {column_name}",
                    migration_type=MigrationType.DATA_MIGRATION,
                    up_sql=f"UPDATE {table_name} SET {column_name} = {default_value} WHERE {column_name} IS NULL;",
                    down_sql="",
                    estimated_duration_seconds=300,
                    requires_downtime=False
                ),
                MigrationStep(
                    step_id="3",
                    description=f"Make {column_name} NOT NULL",
                    migration_type=MigrationType.BREAKING_CHANGE,
                    up_sql=f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL;",
                    down_sql=f"ALTER TABLE {table_name} ALTER COLUMN {column_name} DROP NOT NULL;",
                    estimated_duration_seconds=10,
                    requires_downtime=True
                )
            ]
        
        elif operation == "rename_column":
            old_name = kwargs.get('old_name')
            new_name = kwargs.get('new_name')
            
            steps = [
                MigrationStep(
                    step_id="1",
                    description=f"Add {new_name} column",
                    migration_type=MigrationType.BACKWARD_COMPATIBLE,
                    up_sql=f"ALTER TABLE {table_name} ADD COLUMN {new_name} TYPE (SELECT {old_name} FROM {table_name} LIMIT 1);",
                    down_sql=f"ALTER TABLE {table_name} DROP COLUMN {new_name};",
                    estimated_duration_seconds=30,
                    requires_downtime=False
                ),
                MigrationStep(
                    step_id="2",
                    description=f"Sync {old_name} to {new_name}",
                    migration_type=MigrationType.DATA_MIGRATION,
                    up_sql=f"UPDATE {table_name} SET {new_name} = {old_name};",
                    down_sql="",
                    estimated_duration_seconds=300,
                    requires_downtime=False
                ),
                MigrationStep(
                    step_id="3",
                    description=f"Update application to use {new_name}",
                    migration_type=MigrationType.BACKWARD_COMPATIBLE,
                    up_sql="-- Application code changes only --",
                    down_sql="",
                    estimated_duration_seconds=60,
                    requires_downtime=False
                ),
                MigrationStep(
                    step_id="4",
                    description=f"Drop {old_name} column",
                    migration_type=MigrationType.BREAKING_CHANGE,
                    up_sql=f"ALTER TABLE {table_name} DROP COLUMN {old_name};",
                    down_sql=f"ALTER TABLE {table_name} ADD COLUMN {old_name} TYPE {new_name};",
                    estimated_duration_seconds=30,
                    requires_downtime=True
                )
            ]
        
        return MigrationPlan(
            plan_id=f"zdt_{table_name}_{operation}_{datetime.utcnow().isoformat()}",
            version="1.0",
            description=f"Zero-downtime {operation} on {table_name}",
            steps=steps,
            created_at=datetime.utcnow(),
            created_by="migration_system"
        )
    
    def validate_migration_chain(self) -> List[str]:
        """Migration chain'i doğrula"""
        errors = []
        
        try:
            script = command.ScriptDirectory.from_config(self.alembic_cfg)
            
            # Check for duplicate revisions
            revisions = {}
            for rev in script.walk_revisions():
                if rev.revision in revisions:
                    errors.append(f"Duplicate revision: {rev.revision}")
                revisions[rev.revision] = rev
            
            # Check for broken chain
            for rev in revisions.values():
                if rev.down_revision and rev.down_revision not in revisions:
                    errors.append(f"Broken chain: {rev.revision} references missing {rev.down_revision}")
            
        except Exception as e:
            errors.append(f"Validation error: {e}")
        
        return errors
    
    def generate_migration_report(self) -> Dict:
        """Migration raporu oluştur"""
        return {
            'total_migrations': len(self.history),
            'successful': len([r for r in self.history if r.status == MigrationStatus.COMPLETED]),
            'failed': len([r for r in self.history if r.status == MigrationStatus.FAILED]),
            'rolled_back': len([r for r in self.history if r.status == MigrationStatus.ROLLED_BACK]),
            'average_duration': (
                sum(r.duration_seconds for r in self.history) / len(self.history)
                if self.history else 0
            ),
            'recent_migrations': [
                {
                    'version': r.version,
                    'status': r.status.value,
                    'duration_seconds': r.duration_seconds,
                    'completed_at': r.completed_at.isoformat() if r.completed_at else None
                }
                for r in self.history[-10:]
            ]
        }


class OnlineSchemaChanger:
    """
    Online schema değişiklikleri (PostgreSQL).
    
    LOCK'tan kaçınarak schema değişiklikleri yap.
    """
    
    def __init__(self, db_session: Session):
        self.session = db_session
        
    def add_column_online(
        self,
        table_name: str,
        column_name: str,
        data_type: str,
        default_value: Optional[str] = None
    ) -> None:
        """
        Online column ekle.
        
        PostgreSQL'de ALTER TABLE ... ADD COLUMN lock gerektirmez,
        ancak DEFAULT değer ile birlikte table rewrite yapar.
        """
        # Add column without default (fast)
        self.session.execute(
            sa.text(f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name} {data_type} NULL
            """)
        )
        
        # Add default separately if needed
        if default_value:
            self.session.execute(
                sa.text(f"""
                    ALTER TABLE {table_name}
                    ALTER COLUMN {column_name} SET DEFAULT {default_value}
                """)
            )
            
            # Update existing rows in batches
            self._backfill_in_batches(table_name, column_name, default_value)
    
    def create_index_concurrently(
        self,
        index_name: str,
        table_name: str,
        columns: List[str],
        unique: bool = False
    ) -> None:
        """
        CONCURRENTLY index oluştur.
        
        Bu, table üzerinde lock almadan index oluşturur.
        """
        unique_str = "UNIQUE" if unique else ""
        columns_str = ", ".join(columns)
        
        # Note: This must run outside a transaction block
        self.session.execute(
            sa.text(f"""
                CREATE {unique_str} INDEX CONCURRENTLY {index_name}
                ON {table_name} ({columns_str})
            """)
        )
    
    def drop_column_safe(
        self,
        table_name: str,
        column_name: str,
        check_dependencies: bool = True
    ) -> None:
        """
        Güvenli column silme.
        
        Dependencies kontrolü yapar ve cascade ile siler.
        """
        if check_dependencies:
            # Check for dependencies
            result = self.session.execute(
                sa.text("""
                    SELECT dependent_ns.nspname as dependent_schema,
                           dependent_view.relname as dependent_view
                    FROM pg_depend
                    JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
                    JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
                    JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
                    JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid
                        AND pg_depend.refobjsubid = pg_attribute.attnum
                    JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
                    WHERE source_table.relname = :table
                      AND pg_attribute.attname = :column
                      AND pg_attribute.attnum > 0
                """),
                {"table": table_name, "column": column_name}
            )
            
            dependencies = result.fetchall()
            if dependencies:
                dep_list = ", ".join([f"{d[0]}.{d[1]}" for d in dependencies])
                raise ValueError(f"Column {column_name} has dependencies: {dep_list}")
        
        # Drop column
        self.session.execute(
            sa.text(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS {column_name}")
        )
    
    def _backfill_in_batches(
        self,
        table_name: str,
        column_name: str,
        default_value: str,
        batch_size: int = 1000
    ) -> None:
        """Batch'ler halinde backfill yap"""
        offset = 0
        while True:
            result = self.session.execute(
                sa.text(f"""
                    UPDATE {table_name}
                    SET {column_name} = {default_value}
                    WHERE {column_name} IS NULL
                    AND ctid IN (
                        SELECT ctid FROM {table_name}
                        WHERE {column_name} IS NULL
                        LIMIT {batch_size}
                    )
                """)
            )
            
            if result.rowcount == 0:
                break
            
            offset += result.rowcount
            self.session.commit()  # Commit each batch
            
            logger.info(f"Backfilled {offset} rows in {table_name}.{column_name}")


# Global migration manager instance
migration_manager: Optional[MigrationManager] = None

def init_migration_manager(alembic_config_path: str) -> MigrationManager:
    """Initialize global migration manager"""
    global migration_manager
    migration_manager = MigrationManager(alembic_config_path)
    return migration_manager

def get_migration_manager() -> MigrationManager:
    """Get global migration manager"""
    if migration_manager is None:
        raise RuntimeError("Migration manager not initialized")
    return migration_manager
