from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from app.database import Base  # noqa: E402
from app.features.ocr.transport.http.router import OCRSummaryOut, get_ocr_summary  # noqa: E402
from app.models import OCRJob, User  # noqa: E402


def test_get_ocr_summary_returns_real_metrics_and_camel_case_contract():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = session_local()
    try:
        user = User(
            email="ocr@test.local",
            username="ocr_test",
            display_name="OCR Test",
            role="ADMIN",
            is_active=True,
        )
        db.add(user)
        db.flush()

        now = datetime.now(timezone.utc)
        db.add_all(
            [
                OCRJob(
                    id="job-1",
                    status="COMPLETED",
                    confidence=90,
                    order_id=1,
                    uploaded_by_id=user.id,
                    created_at=now - timedelta(hours=2),
                ),
                OCRJob(
                    id="job-2",
                    status="COMPLETED",
                    confidence=80,
                    uploaded_by_id=user.id,
                    created_at=now - timedelta(hours=10),
                ),
                OCRJob(
                    id="job-3",
                    status="FAILED",
                    confidence=40,
                    uploaded_by_id=user.id,
                    created_at=now - timedelta(days=2),
                ),
            ]
        )
        db.commit()

        payload = get_ocr_summary(db=db, _user=user)

        assert payload["totalJobs"] == 3
        assert payload["successfulJobs"] == 2
        assert payload["failedJobs"] == 1
        assert payload["averageConfidence"] == 70.0
        assert payload["last24hJobs"] == 2
        assert payload["totalPagesProcessed"] is None
        assert payload["topLanguages"] == []
        assert payload["engineBreakdown"] == []
        assert payload["ordersCreated"] == 1
        assert payload["conversionRate"] == 50.0
        assert len(payload["recentJobs"]) == 3
        summary = OCRSummaryOut.model_validate(payload)
        assert summary.totalJobs == 3
        assert summary.channelBreakdown[0].lastAttemptedAt is not None
        assert summary.recentJobs[0].id == "job-1"
    finally:
        db.close()
        engine.dispose()
