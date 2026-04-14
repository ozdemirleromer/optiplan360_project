
# Alembic Migration Guidelines

## Manual Schema Fixes to Migrate

The following manual schema fix scripts need to be converted to proper Alembic migrations:

### 1. update_db_schema.py
- **Purpose**: Remove payment order columns, add payment reminder columns
- **Migration Type**: ALTER TABLE operations
- **Target Table**: invoices

### 2. migrate_stations.py
- **Purpose**: Station table migration
- **Migration Type**: Schema changes
- **Target Table**: stations

### 3. migrate_optiplanning_models.py
- **Purpose**: OptiPlanning model migration
- **Migration Type**: Model changes
- **Target Tables**: Multiple

### 4. migrate_token.py
- **Purpose**: Token table migration
- **Migration Type**: Schema changes
- **Target Table**: tokens

## Creating Proper Migrations

1. Generate new migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "remove_payment_order_add_reminders"
   ```

2. Review and edit the generated migration file
3. Test the migration:
   ```bash
   alembic upgrade head
   ```

4. Verify the changes:
   ```bash
   alembic current
   ```

## Migration Best Practices

1. **Always use Alembic** for schema changes
2. **Test migrations** on development first
3. **Backup database** before running migrations
4. **Review generated migrations** before applying
5. **Use descriptive migration names**
6. **Handle both upgrade and downgrade** paths

## Migration Commands

```bash
# Create new migration
alembic revision -m "description"

# Create with autogenerate
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Apply specific migration
alembic upgrade +1

# Rollback migration
alembic downgrade -1

# Check current version
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic show head
```
