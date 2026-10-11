import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from config import ADVISORY_LABEL
from db import AiDatabaseClient

logger = logging.getLogger("ai_notifier")

ADVISORY_DISCLAIMER = "AI-generated, advisory: This is an automated ML risk assessment and not an official regulatory alert."

class NotificationService:
    """
    AI Advisory Notification Service with debouncing, quiet periods, and rate limiting.
    Logs and persists notifications to the ai_notifications table.
    """

    def __init__(
        self,
        db: AiDatabaseClient,
        quiet_period_minutes: int = 15,
        max_per_hour: int = 4,
    ):
        self.db = db
        self.quiet_period_minutes = quiet_period_minutes
        self.max_per_hour = max_per_hour

    def dispatch_notification(
        self,
        insight: Dict[str, Any],
        shipment: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Evaluates delivery rules (email enabled, severity, quiet period, hourly cap)
        and logs notification attempt.
        """
        shipment_id = shipment.get("shipment_id") or insight.get("shipment_id")
        insight_id = insight["insight_id"]
        severity = insight.get("severity", "info")
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        notif_id = f"notif_{uuid.uuid4().hex[:16]}"

        # Rule 1: Non-critical/warning insights do not generate notifications
        if severity not in ["warning", "critical"]:
            record = {
                "notification_id": notif_id,
                "insight_id": insight_id,
                "shipment_id": shipment_id,
                "sent_at": now_iso,
                "status": "suppressed",
                "reason": "severity is info",
                "label": ADVISORY_LABEL,
            }
            self.db.insert_notification(record)
            return record

        # Rule 2: Respect shipment.ai_email_enabled flag
        ai_email_enabled = shipment.get("ai_email_enabled", False)
        if not ai_email_enabled:
            record = {
                "notification_id": notif_id,
                "insight_id": insight_id,
                "shipment_id": shipment_id,
                "sent_at": now_iso,
                "status": "suppressed",
                "reason": "ai_email_enabled is false",
                "label": ADVISORY_LABEL,
            }
            self.db.insert_notification(record)
            return record

        # Rule 3: Quiet period (debouncing) check
        if self.quiet_period_minutes > 0:
            quiet_cutoff = (now - timedelta(minutes=self.quiet_period_minutes)).isoformat()
            recent_notifs = self.db.get_recent_notifications(shipment_id, quiet_cutoff)
            sent_in_quiet_period = [n for n in recent_notifs if n["status"] == "sent"]

            if sent_in_quiet_period:
                record = {
                    "notification_id": notif_id,
                    "insight_id": insight_id,
                    "shipment_id": shipment_id,
                    "sent_at": now_iso,
                    "status": "suppressed",
                    "reason": f"quiet_period_active ({self.quiet_period_minutes}m debounce)",
                    "label": ADVISORY_LABEL,
                }
                self.db.insert_notification(record)
                return record

        # Rule 4: Rate limit check (hourly cap)
        hour_cutoff = (now - timedelta(hours=1)).isoformat()
        hourly_notifs = self.db.get_recent_notifications(shipment_id, hour_cutoff)
        sent_in_last_hour = [n for n in hourly_notifs if n["status"] == "sent"]

        if len(sent_in_last_hour) >= self.max_per_hour:
            record = {
                "notification_id": notif_id,
                "insight_id": insight_id,
                "shipment_id": shipment_id,
                "sent_at": now_iso,
                "status": "suppressed",
                "reason": f"rate_limit_exceeded (max {self.max_per_hour}/hour)",
                "label": ADVISORY_LABEL,
            }
            self.db.insert_notification(record)
            return record

        # Dispatch notification
        explanation = insight.get("explanation", "Anomalous temperature or risk condition detected")
        logger.warning(
            f"[AI ADVISORY NOTIFICATION SENT] Shipment: {shipment_id} | "
            f"Severity: {severity.upper()} | Explanation: {explanation} | Disclaimer: {ADVISORY_DISCLAIMER}"
        )

        record = {
            "notification_id": notif_id,
            "insight_id": insight_id,
            "shipment_id": shipment_id,
            "sent_at": now_iso,
            "status": "sent",
            "reason": "dispatched",
            "message": f"[{severity.upper()}] {explanation} — {ADVISORY_DISCLAIMER}",
            "label": ADVISORY_LABEL,
        }
        self.db.insert_notification(record)
        return record
