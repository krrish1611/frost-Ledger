# AiDatabaseClient

> 55 nodes

## Key Concepts

- **AiDatabaseClient** (37 connections) — `ai-service/db.py`
- **AiService** (17 connections) — `ai-service/service.py`
- **NotificationService** (13 connections) — `ai-service/notifier.py`
- **Any** (12 connections)
- **OfflineMlEvaluator** (11 connections) — `ai-service/evaluator.py`
- **._verify_query_safety()** (10 connections) — `ai-service/db.py`
- **.process_shipment()** (9 connections) — `ai-service/service.py`
- **.dispatch_notification()** (8 connections) — `ai-service/notifier.py`
- **.get_or_load_learner()** (7 connections) — `ai-service/service.py`
- **test_checkpoint_and_restart_resumption_no_duplicates()** (7 connections) — `ai-service/test_ai_core.py`
- **.run_evaluation()** (6 connections) — `ai-service/evaluator.py`
- **.calculate_current_risk()** (6 connections) — `ai-service/service.py`
- **test_two_simultaneous_shipments_maintain_isolated_states()** (6 connections) — `ai-service/test_ai_core.py`
- **.generate_benchmark_dataset()** (5 connections) — `ai-service/evaluator.py`
- **test_database_client_enforces_read_only_on_official_tables()** (5 connections) — `ai-service/test_ai_core.py`
- **test_run_offline_evaluation_benchmarks()** (5 connections) — `ai-service/test_evaluation.py`
- **test_notification_dispatched_when_email_enabled()** (5 connections) — `ai-service/test_risk_notifications.py`
- **.get_evaluations()** (4 connections) — `ai-service/db.py`
- **.get_model_state()** (4 connections) — `ai-service/db.py`
- **.get_notifications()** (4 connections) — `ai-service/db.py`
- **test_notification_debouncing_quiet_period()** (4 connections) — `ai-service/test_risk_notifications.py`
- **test_notification_hourly_rate_limit()** (4 connections) — `ai-service/test_risk_notifications.py`
- **test_notification_suppressed_when_email_disabled()** (4 connections) — `ai-service/test_risk_notifications.py`
- **Any** (4 connections)
- **.get_active_shipments()** (3 connections) — `ai-service/db.py`
- *... and 30 more nodes in this community*

## Relationships

- [test_ai_core.py](test_ai_core.py.md) (25 shared connections)
- [ShipmentLearner](ShipmentLearner.md) (7 shared connections)
- [main.py](main.py.md) (3 shared connections)
- [CompositeRiskScorer](CompositeRiskScorer.md) (2 shared connections)

## Source Files

- `ai-service/db.py`
- `ai-service/evaluator.py`
- `ai-service/notifier.py`
- `ai-service/service.py`
- `ai-service/test_ai_core.py`
- `ai-service/test_evaluation.py`
- `ai-service/test_risk_notifications.py`

## Audit Trail

- EXTRACTED: 124 (86%)
- INFERRED: 20 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*