# CompositeRiskScorer

> 10 nodes

## Key Concepts

- **CompositeRiskScorer** (12 connections) — `ai-service/risk_scorer.py`
- **.calculate_risk()** (8 connections) — `ai-service/risk_scorer.py`
- **test_composite_risk_scorer_differentiates_domains()** (4 connections) — `ai-service/test_cargo_models.py`
- **test_composite_risk_freezing_hazard()** (3 connections) — `ai-service/test_risk_notifications.py`
- **test_composite_risk_high_thermal_excursion()** (3 connections) — `ai-service/test_risk_notifications.py`
- **test_composite_risk_normal_temperature()** (3 connections) — `ai-service/test_risk_notifications.py`
- **test_composite_risk_security_penalty()** (3 connections) — `ai-service/test_risk_notifications.py`
- **Any** (1 connections)
- **Computes a composite multi-dimensional risk score in [0, 100] for a shipment…** (1 connections) — `ai-service/risk_scorer.py`
- **Risk scoring applies different biology equations to produce (Q10,…** (1 connections) — `ai-service/test_cargo_models.py`

## Relationships

- [test_ai_core.py](test_ai_core.py.md) (7 shared connections)
- [test_cargo_models.py](test_cargo_models.py.md) (2 shared connections)
- [AiDatabaseClient](AiDatabaseClient.md) (2 shared connections)

## Source Files

- `ai-service/risk_scorer.py`
- `ai-service/test_cargo_models.py`
- `ai-service/test_risk_notifications.py`

## Audit Trail

- EXTRACTED: 19 (76%)
- INFERRED: 6 (24%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*