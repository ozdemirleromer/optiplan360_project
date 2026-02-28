# Enhance reminder logic for delivery follow-ups

from datetime import datetime, timedelta

from app.models import Order
from sqlalchemy.orm import Session

REMINDER_LIMIT = 5
REMINDER_INTERVAL = timedelta(days=2)


def check_and_send_reminders(db: Session):
    now = datetime.now()
    orders = (
        db.query(Order)
        .filter(
            Order.status == "DELIVERY_PENDING",
            Order.reminder_count < REMINDER_LIMIT,
            (Order.last_reminder_sent_at.is_(None))
            | (Order.last_reminder_sent_at < now - REMINDER_INTERVAL),
        )
        .all()
    )

    for order in orders:
        # Send reminder logic here
        print(f"Sending reminder for order {order.id}")

        # Update reminder fields
        order.last_reminder_sent_at = now
        order.reminder_count += 1
        db.commit()
