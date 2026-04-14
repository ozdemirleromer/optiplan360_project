"""Fix OCR router: add OCRSummaryOut + rewrite get_ocr_summary"""
path = r'backend\app\features\ocr\transport\http\router.py'
content = open(path, encoding='utf-8').read()

# Find the get_ocr_summary function
marker_start = '@router.get("/summary")'
start = content.find(marker_start)
assert start >= 0, "Marker not found"

# The function ends at the file end or before the next top-level statement
# Find the next non-indented line that starts with @router after the function
import re
# Start searching for the next @router after the function start
search_from = start + len(marker_start)
next_router_match = re.search(r'\n@router\.', content[search_from:])
if next_router_match:
    end = search_from + next_router_match.start() + 1  # +1 to include the \n
else:
    end = len(content)

print(f"Function span: [{start}, {end}]")
print(f"Current function:\n{repr(content[start:end])[:500]}")

# New implementation
new_function = '''@router.get("/summary")
def get_ocr_summary(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """OCR istatistik ozetini camelCase sozlesmesiyle doner"""
    from sqlalchemy import func
    from datetime import timedelta

    total_jobs = db.query(func.count(OCRJob.id)).scalar() or 0
    successful_jobs = db.query(func.count(OCRJob.id)).filter(OCRJob.status == "COMPLETED").scalar() or 0
    failed_jobs = db.query(func.count(OCRJob.id)).filter(OCRJob.status == "FAILED").scalar() or 0
    orders_created = db.query(func.count(OCRJob.id)).filter(OCRJob.order_id != None).scalar() or 0  # noqa: E711

    avg_conf_raw = db.query(func.avg(OCRJob.confidence)).scalar()
    average_confidence = float(avg_conf_raw) if avg_conf_raw is not None else 0.0

    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    last24h_jobs = db.query(func.count(OCRJob.id)).filter(OCRJob.created_at >= day_ago).scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent = (
        db.query(OCRJob)
        .filter(OCRJob.created_at >= week_ago)
        .order_by(OCRJob.created_at.desc())
        .limit(10)
        .all()
    )

    latest_job = db.query(OCRJob).order_by(OCRJob.created_at.desc()).first()
    channel_breakdown = (
        [
            {
                "channel": "DIRECT",
                "totalJobs": total_jobs,
                "successJobs": successful_jobs,
                "failedJobs": failed_jobs,
                "lastAttemptedAt": latest_job.created_at if latest_job else None,
            }
        ]
        if total_jobs > 0
        else []
    )

    conversion_rate = round((orders_created / successful_jobs * 100), 2) if successful_jobs > 0 else 0.0

    return {
        "totalJobs": total_jobs,
        "successfulJobs": successful_jobs,
        "failedJobs": failed_jobs,
        "averageConfidence": average_confidence,
        "last24hJobs": last24h_jobs,
        "totalPagesProcessed": None,
        "topLanguages": [],
        "engineBreakdown": [],
        "ordersCreated": orders_created,
        "conversionRate": conversion_rate,
        "recentJobs": [
            {
                "id": j.id,
                "status": j.status,
                "confidence": float(j.confidence) if j.confidence is not None else None,
                "createdAt": j.created_at.isoformat() if j.created_at else None,
            }
            for j in recent
        ],
        "channelBreakdown": channel_breakdown,
    }

'''

# Add OCRSummaryOut schemas before the function
summary_schemas = '''

# -- OCR Summary Schemas --

class RecentJobSummaryItem(BaseModel):
    id: str
    status: str
    confidence: Optional[float] = None
    createdAt: Optional[str] = None


class ChannelBreakdownItem(BaseModel):
    channel: str
    totalJobs: int
    successJobs: int
    failedJobs: int
    lastAttemptedAt: Optional[datetime] = None


class OCRSummaryOut(BaseModel):
    totalJobs: int
    successfulJobs: int
    failedJobs: int
    averageConfidence: float
    last24hJobs: int
    totalPagesProcessed: Optional[int] = None
    topLanguages: List[Any] = []
    engineBreakdown: List[Any] = []
    ordersCreated: int
    conversionRate: float
    recentJobs: List[RecentJobSummaryItem] = []
    channelBreakdown: List[ChannelBreakdownItem] = []


'''

new_content = content[:start] + summary_schemas + new_function + content[end:]
open(path, 'w', encoding='utf-8').write(new_content)
print("Done!")
