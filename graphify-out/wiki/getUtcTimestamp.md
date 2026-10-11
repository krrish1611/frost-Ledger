# getUtcTimestamp

> 44 nodes

## Key Concepts

- **getUtcTimestamp()** (32 connections) — `shared/src/index.ts`
- **stage3_deterministic.test.ts** (30 connections) — `backend/test/stage3_deterministic.test.ts`
- **deterministicCore.ts** (19 connections) — `backend/src/services/deterministicCore.ts`
- **processor.ts** (15 connections) — `worker/src/processor.ts`
- **kinetics.ts** (13 connections) — `shared/src/kinetics.ts`
- **backend/src/services/alertService.ts** (10 connections) — `backend/src/services/alertService.ts`
- **ref_vitest** (10 connections)
- **worker/src/index.ts** (9 connections) — `worker/src/index.ts`
- **ProfileParameters** (8 connections) — `shared/src/index.ts`
- **processBatchDeterministic()** (8 connections) — `backend/src/services/deterministicCore.ts`
- **calculateRemainingShelfLife()** (8 connections) — `shared/src/kinetics.ts`
- **worker.test.ts** (8 connections) — `worker/test/worker.test.ts`
- **createAlert()** (6 connections) — `backend/src/services/alertService.ts`
- **checkThresholds()** (6 connections) — `shared/src/kinetics.ts`
- **processBatchInWorker()** (6 connections) — `worker/src/processor.ts`
- **calculateMKT()** (5 connections) — `shared/src/kinetics.ts`
- **SensorReading** (4 connections) — `shared/src/index.ts`
- **dotenv** (4 connections) — `backend/package.json`
- **shared_src_index_calculateremainingshelflife** (4 connections)
- **AlertRecord** (3 connections) — `backend/src/services/alertService.ts`
- **TimedReading** (3 connections) — `shared/src/kinetics.ts`
- **createSecurityAlert()** (3 connections) — `backend/src/services/alertService.ts`
- **close()** (3 connections) — `backend/test/stage3_deterministic.test.ts`
- **exec()** (3 connections) — `backend/test/stage3_deterministic.test.ts`
- **query()** (3 connections) — `backend/test/stage3_deterministic.test.ts`
- *... and 19 more nodes in this community*

## Relationships

- [stage4_blockchain_verification.test.ts](stage4_blockchain_verification.test.ts.md) (27 shared connections)
- [app.ts](app.ts.md) (22 shared connections)
- [stage2_ingestion.test.ts](stage2_ingestion.test.ts.md) (10 shared connections)
- [shared/src/index.ts](shared-src-index.ts.md) (9 shared connections)
- [verificationService.ts](verificationService.ts.md) (5 shared connections)
- [worker/package.json](worker-package.json.md) (1 shared connections)
- [backend/package.json](backend-package.json.md) (1 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/services/alertService.ts`
- `backend/src/services/deterministicCore.ts`
- `backend/test/stage3_deterministic.test.ts`
- `backend/vitest.config.ts`
- `docs/ARCHITECTURE_AND_VERIFICATION.md`
- `shared/src/index.ts`
- `shared/src/kinetics.ts`
- `worker/src/index.ts`
- `worker/src/processor.ts`
- `worker/test/worker.test.ts`

## Audit Trail

- EXTRACTED: 163 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*