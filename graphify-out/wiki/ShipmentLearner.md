# ShipmentLearner

> 42 nodes

## Key Concepts

- **ShipmentLearner** (28 connections) — `ai-service/learner.py`
- **.process_reading()** (14 connections) — `ai-service/learner.py`
- **EwmaCusumDetector** (10 connections) — `ai-service/models/ewma_cusum.py`
- **create_sample_reading()** (10 connections) — `ai-service/test_ai_core.py`
- **RateOfChangeDetector** (9 connections) — `ai-service/models/rate_of_change.py`
- **.__init__()** (8 connections) — `ai-service/learner.py`
- **.from_dict()** (7 connections) — `ai-service/learner.py`
- **.to_dict()** (6 connections) — `ai-service/learner.py`
- **test_flat_copied_readings_triggers_spoofing_warning()** (5 connections) — `ai-service/test_ai_core.py`
- **test_known_event_downweighting_door_open()** (5 connections) — `ai-service/test_ai_core.py`
- **test_normal_simulation_produces_no_warnings()** (5 connections) — `ai-service/test_ai_core.py`
- **test_slow_drift_triggers_cusum_drift_warning()** (5 connections) — `ai-service/test_ai_core.py`
- **test_temperature_spike_triggers_warning_with_explanation()** (5 connections) — `ai-service/test_ai_core.py`
- **test_warmup_phase_suppresses_alerts()** (5 connections) — `ai-service/test_ai_core.py`
- **Any** (4 connections)
- **.from_dict()** (3 connections) — `ai-service/models/ewma_cusum.py`
- **.to_dict()** (3 connections) — `ai-service/models/ewma_cusum.py`
- **.update()** (3 connections) — `ai-service/models/ewma_cusum.py`
- **.from_dict()** (3 connections) — `ai-service/models/rate_of_change.py`
- **.to_dict()** (3 connections) — `ai-service/models/rate_of_change.py`
- **.update()** (3 connections) — `ai-service/models/rate_of_change.py`
- **test_shipment_learner_specializes_by_cargo_type()** (3 connections) — `ai-service/test_cargo_models.py`
- **Any** (2 connections)
- **Any** (2 connections)
- **River Streaming HST & CUSUM Anomaly Detection** (2 connections) — `docs/ARCHITECTURE_AND_VERIFICATION.md`
- *... and 17 more nodes in this community*

## Relationships

- [test_ai_core.py](test_ai_core.py.md) (16 shared connections)
- [AiDatabaseClient](AiDatabaseClient.md) (7 shared connections)
- [test_cargo_models.py](test_cargo_models.py.md) (6 shared connections)
- [HalfSpaceTreesDetector](HalfSpaceTreesDetector.md) (6 shared connections)
- [RuleDetector](RuleDetector.md) (5 shared connections)

## Source Files

- `ai-service/learner.py`
- `ai-service/models/ewma_cusum.py`
- `ai-service/models/rate_of_change.py`
- `ai-service/test_ai_core.py`
- `ai-service/test_cargo_models.py`
- `docs/ARCHITECTURE_AND_VERIFICATION.md`

## Audit Trail

- EXTRACTED: 81 (77%)
- INFERRED: 24 (23%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*