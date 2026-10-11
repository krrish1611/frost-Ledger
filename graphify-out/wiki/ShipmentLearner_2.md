# ShipmentLearner

> God node · 28 connections · `ai-service/learner.py`

**Community:** [ShipmentLearner](ShipmentLearner.md)

## Connections by Relation

### calls
- .run_evaluation() `EXTRACTED`
- test_flat_copied_readings_triggers_spoofing_warning() `EXTRACTED`
- test_known_event_downweighting_door_open() `EXTRACTED`
- test_normal_simulation_produces_no_warnings() `EXTRACTED`
- test_slow_drift_triggers_cusum_drift_warning() `EXTRACTED`
- test_temperature_spike_triggers_warning_with_explanation() `EXTRACTED`
- test_warmup_phase_suppresses_alerts() `EXTRACTED`
- test_shipment_learner_specializes_by_cargo_type() `EXTRACTED`

### contains
- learner.py `EXTRACTED`

### imports
- [test_ai_core.py](test_ai_core.py.md) `EXTRACTED`
- [test_cargo_models.py](test_cargo_models.py.md) `EXTRACTED`
- service.py `EXTRACTED`
- evaluator.py `EXTRACTED`

### method
- .process_reading() `EXTRACTED`
- .__init__() `EXTRACTED`
- .from_dict() `EXTRACTED`
- .to_dict() `EXTRACTED`
- .warmup_status() `EXTRACTED`

### rationale_for
- Per-shipment online learning instance. Maintains isolated ML model state,… `EXTRACTED`

### references
- .get_or_load_learner() `EXTRACTED`

### uses
- AiService `INFERRED`
- ProduceColdChainModel `INFERRED`
- VaccineColdChainModel `INFERRED`
- OfflineMlEvaluator `INFERRED`
- EwmaCusumDetector `INFERRED`
- [HalfSpaceTreesDetector](HalfSpaceTreesDetector.md) `INFERRED`
- [RuleDetector](RuleDetector.md) `INFERRED`
- RateOfChangeDetector `INFERRED`

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*