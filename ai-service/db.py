import json
import logging
import psycopg2
import psycopg2.extras
from typing import Dict, Any, List, Optional
from config import DATABASE_URL_AI, MODEL_VERSION

logger = logging.getLogger("ai_db")

OFFICIAL_TABLES = {
    "devices", "profiles", "shipments", "batches", "events",
    "anchors", "shelf_life_trail", "alerts", "audit_log", "users"
}

AI_WRITABLE_TABLES = {
    "ai_insights", "ai_model_state", "ai_notifications", "ai_evaluations"
}

class AiDatabaseClient:
    """
    Database adapter for the AI Service.
    Enforces that AI service role ONLY writes to AI tables and never touches official tables.
    Provides in-memory fallback for isolated testing when PostgreSQL is unavailable.
    """

    def __init__(self, db_url: str = DATABASE_URL_AI, use_mock: bool = False):
        self.db_url = db_url
        self.use_mock = use_mock
        self._conn = None

        # In-memory mock storage for testing
        self.mock_shipments: Dict[str, Dict[str, Any]] = {}
        self.mock_profiles: Dict[str, Dict[str, Any]] = {}
        self.mock_batches: List[Dict[str, Any]] = []
        self.mock_events: List[Dict[str, Any]] = []
        self.mock_ai_insights: List[Dict[str, Any]] = []
        self.mock_ai_model_state: Dict[str, Dict[str, Any]] = {}
        self.mock_ai_notifications: List[Dict[str, Any]] = []
        self.mock_ai_evaluations: List[Dict[str, Any]] = []

        if not self.use_mock:
            try:
                self._conn = psycopg2.connect(self.db_url)
                self._conn.autocommit = True
            except Exception as e:
                logger.warning(f"PostgreSQL connection failed ({e}). Falling back to in-memory mock client.")
                self.use_mock = True

    def _verify_query_safety(self, query: str):
        query_upper = query.upper()
        if any(keyword in query_upper for keyword in ["INSERT INTO", "UPDATE", "DELETE FROM", "DROP TABLE", "ALTER TABLE"]):
            for table in OFFICIAL_TABLES:
                if table.upper() in query_upper:
                    raise PermissionError(
                        f"AI service role violation: Attempted write operation on official immutable table '{table}'."
                    )

    def get_active_shipments(self) -> List[Dict[str, Any]]:
        if self.use_mock:
            results = []
            for s_id, s in self.mock_shipments.items():
                if s.get("ai_enabled", True) and s.get("status") in ["created", "in_transit"]:
                    prof = self.mock_profiles.get(s["profile_id"], {})
                    results.append({
                        "shipment_id": s_id,
                        "device_id": s["device_id"],
                        "profile_id": s["profile_id"],
                        "profile_version": s.get("profile_version", 1),
                        "status": s.get("status", "in_transit"),
                        "parameters": prof.get("parameters", {}),
                    })
            return results

        self._verify_query_safety("SELECT shipments")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT s.shipment_id, s.device_id, s.profile_id, s.profile_version, s.status, p.parameters
                FROM shipments s
                JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
                WHERE s.ai_enabled = TRUE AND s.status IN ('created', 'in_transit')
            """)
            return [dict(row) for row in cur.fetchall()]

    def get_shipment_batches(
        self,
        shipment_id: str,
        after_sequence_no: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        if self.use_mock:
            batches = [b for b in self.mock_batches if b["shipment_id"] == shipment_id]
            if after_sequence_no is not None:
                batches = [b for b in batches if b["sequence_no"] > after_sequence_no]
            return sorted(batches, key=lambda b: b["sequence_no"])

        self._verify_query_safety("SELECT batches")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if after_sequence_no is not None:
                cur.execute("""
                    SELECT batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, payload, received_at
                    FROM batches
                    WHERE shipment_id = %s AND sequence_no > %s
                    ORDER BY sequence_no ASC
                """, (shipment_id, after_sequence_no))
            else:
                cur.execute("""
                    SELECT batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, payload, received_at
                    FROM batches
                    WHERE shipment_id = %s
                    ORDER BY sequence_no ASC
                """, (shipment_id,))
            return [dict(row) for row in cur.fetchall()]

    def get_shipment_events(self, shipment_id: str) -> List[Dict[str, Any]]:
        if self.use_mock:
            return [e for e in self.mock_events if e["shipment_id"] == shipment_id]

        self._verify_query_safety("SELECT events")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT event_id, shipment_id, type, magnitude, timestamp
                FROM events
                WHERE shipment_id = %s
                ORDER BY timestamp ASC
            """, (shipment_id,))
            return [dict(row) for row in cur.fetchall()]

    def get_model_state(self, shipment_id: str, model_version: str = MODEL_VERSION) -> Optional[Dict[str, Any]]:
        if self.use_mock:
            key = f"{shipment_id}:{model_version}"
            return self.mock_ai_model_state.get(key)

        self._verify_query_safety("SELECT ai_model_state")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT shipment_id, model_version, state, last_batch_id, updated_at
                FROM ai_model_state
                WHERE shipment_id = %s AND model_version = %s
            """, (shipment_id, model_version))
            row = cur.fetchone()
            if row:
                return dict(row)
            return None

    def save_model_state(
        self,
        shipment_id: str,
        model_version: str,
        state_dict: Dict[str, Any],
        last_batch_id: Optional[str] = None,
    ):
        if self.use_mock:
            key = f"{shipment_id}:{model_version}"
            self.mock_ai_model_state[key] = {
                "shipment_id": shipment_id,
                "model_version": model_version,
                "state": state_dict,
                "last_batch_id": last_batch_id,
            }
            return

        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_model_state (shipment_id, model_version, state, last_batch_id, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (shipment_id, model_version)
                DO UPDATE SET
                    state = EXCLUDED.state,
                    last_batch_id = EXCLUDED.last_batch_id,
                    updated_at = NOW()
            """, (shipment_id, model_version, json.dumps(state_dict), last_batch_id))

    def insert_insight(self, insight: Dict[str, Any]):
        if self.use_mock:
            self.mock_ai_insights.append(insight)
            return

        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_insights (
                    insight_id, shipment_id, kind, score, severity,
                    explanation, input_ref, warmup_status, model_name,
                    model_version, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (insight_id) DO NOTHING
            """, (
                insight["insight_id"],
                insight["shipment_id"],
                insight["kind"],
                insight["score"],
                insight["severity"],
                insight["explanation"],
                insight["input_ref"],
                insight["warmup_status"],
                insight["model_name"],
                insight["model_version"],
                insight["created_at"],
            ))

    def get_insights(self, shipment_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        if self.use_mock:
            filtered = [i for i in self.mock_ai_insights if i["shipment_id"] == shipment_id]
            return sorted(filtered, key=lambda x: x["created_at"], reverse=True)[:limit]

        self._verify_query_safety("SELECT ai_insights")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT insight_id, shipment_id, kind, score, severity, explanation,
                       input_ref, warmup_status, model_name, model_version, created_at
                FROM ai_insights
                WHERE shipment_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (shipment_id, limit))
            rows = [dict(row) for row in cur.fetchall()]
            for r in rows:
                if "created_at" in r and hasattr(r["created_at"], "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows

    def insert_notification(self, notif: Dict[str, Any]):
        if self.use_mock:
            self.mock_ai_notifications.append(notif)
            return

        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_notifications (notification_id, insight_id, shipment_id, sent_at, status)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (notification_id) DO NOTHING
            """, (
                notif["notification_id"],
                notif["insight_id"],
                notif["shipment_id"],
                notif["sent_at"],
                notif["status"],
            ))

    def get_recent_notifications(self, shipment_id: str, since_dt_iso: str) -> List[Dict[str, Any]]:
        if self.use_mock:
            return [
                n for n in self.mock_ai_notifications
                if n["shipment_id"] == shipment_id and n["sent_at"] >= since_dt_iso
            ]

        self._verify_query_safety("SELECT ai_notifications")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT notification_id, insight_id, shipment_id, sent_at, status
                FROM ai_notifications
                WHERE shipment_id = %s AND sent_at >= %s
                ORDER BY sent_at DESC
            """, (shipment_id, since_dt_iso))
            rows = [dict(row) for row in cur.fetchall()]
            for r in rows:
                if "sent_at" in r and hasattr(r["sent_at"], "isoformat"):
                    r["sent_at"] = r["sent_at"].isoformat()
            return rows

    def get_notifications(self, shipment_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        if self.use_mock:
            filtered = [n for n in self.mock_ai_notifications if n["shipment_id"] == shipment_id]
            return sorted(filtered, key=lambda x: x["sent_at"], reverse=True)[:limit]

        self._verify_query_safety("SELECT ai_notifications")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT notification_id, insight_id, shipment_id, sent_at, status
                FROM ai_notifications
                WHERE shipment_id = %s
                ORDER BY sent_at DESC
                LIMIT %s
            """, (shipment_id, limit))
            rows = [dict(row) for row in cur.fetchall()]
            for r in rows:
                if "sent_at" in r and hasattr(r["sent_at"], "isoformat"):
                    r["sent_at"] = r["sent_at"].isoformat()
            return rows

    def insert_evaluation(self, eval_data: Dict[str, Any]):
        if self.use_mock:
            self.mock_ai_evaluations.append(eval_data)
            return

        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_evaluations (
                    evaluation_id, model_name, model_version, precision,
                    recall, false_alert_rate, avg_lead_time_seconds,
                    dataset_name, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (evaluation_id) DO NOTHING
            """, (
                eval_data["evaluation_id"],
                eval_data["model_name"],
                eval_data["model_version"],
                eval_data["precision"],
                eval_data["recall"],
                eval_data["false_alert_rate"],
                eval_data["avg_lead_time_seconds"],
                eval_data["dataset_name"],
                eval_data["created_at"],
            ))

    def get_evaluations(self, limit: int = 50) -> List[Dict[str, Any]]:
        if self.use_mock:
            return sorted(self.mock_ai_evaluations, key=lambda x: x["created_at"], reverse=True)[:limit]

        self._verify_query_safety("SELECT ai_evaluations")
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT evaluation_id, model_name, model_version, precision,
                       recall, false_alert_rate, avg_lead_time_seconds,
                       dataset_name, created_at
                FROM ai_evaluations
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            rows = [dict(row) for row in cur.fetchall()]
            for r in rows:
                if "created_at" in r and hasattr(r["created_at"], "isoformat"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows
