# AiDatabaseClient

> God node · 37 connections · `ai-service/db.py`

**Community:** [AiDatabaseClient](AiDatabaseClient.md)

## Connections by Relation

### calls
- test_checkpoint_and_restart_resumption_no_duplicates() `EXTRACTED`
- test_two_simultaneous_shipments_maintain_isolated_states() `EXTRACTED`
- test_database_client_enforces_read_only_on_official_tables() `EXTRACTED`
- test_run_offline_evaluation_benchmarks() `EXTRACTED`
- test_notification_dispatched_when_email_enabled() `EXTRACTED`
- test_notification_debouncing_quiet_period() `EXTRACTED`
- test_notification_hourly_rate_limit() `EXTRACTED`
- test_notification_suppressed_when_email_disabled() `EXTRACTED`

### contains
- db.py `EXTRACTED`

### imports
- [main.py](main.py.md) `EXTRACTED`
- [test_ai_core.py](test_ai_core.py.md) `EXTRACTED`
- test_risk_notifications.py `EXTRACTED`
- service.py `EXTRACTED`
- evaluator.py `EXTRACTED`
- test_evaluation.py `EXTRACTED`
- notifier.py `EXTRACTED`

### method
- ._verify_query_safety() `EXTRACTED`
- .get_model_state() `EXTRACTED`
- .get_notifications() `EXTRACTED`
- .get_evaluations() `EXTRACTED`
- .get_shipment_events() `EXTRACTED`
- .get_insights() `EXTRACTED`
- .get_recent_notifications() `EXTRACTED`
- .get_active_shipments() `EXTRACTED`
- .get_shipment_batches() `EXTRACTED`
- .save_model_state() `EXTRACTED`
- .insert_insight() `EXTRACTED`
- .insert_notification() `EXTRACTED`
- .insert_evaluation() `EXTRACTED`
- .__init__() `EXTRACTED`

### rationale_for
- Database adapter for the AI Service. Enforces that AI service role ONLY writes… `EXTRACTED`

### references
- .__init__() `EXTRACTED`
- .__init__() `EXTRACTED`
- .__init__() `EXTRACTED`

### uses
- AiService `INFERRED`
- NotificationService `INFERRED`
- OfflineMlEvaluator `INFERRED`

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*