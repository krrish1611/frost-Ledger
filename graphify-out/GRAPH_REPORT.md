# Graph Report - FROSTLEDGER  (2026-10-11)

## Corpus Check
- 149 files · ~127,523 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .example 8, .joblib 2, (none) 1)

## Summary
- 1392 nodes · 2472 edges · 72 communities (63 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a9fac3e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared/src/index.ts
- LandingView.tsx
- ColdChainTracker
- test_cargo_models.py
- frontend/package.json
- worker/package.json
- ShipmentLearner
- main.py
- ArrivalVerificationView.tsx
- contracts/package.json
- api.ts
- stage4_blockchain_verification.test.ts
- getUtcTimestamp
- App.tsx
- CompositeRiskScorer
- simulator/package.json
- AiDatabaseClient
- useTheme
- 001_initial_schema.sql
- backend/package.json
- Expo Animation Recipes
- compilerOptions
- scripts
- shared/package.json
- app.ts
- verificationService.ts
- Animation Recipes
- stage2_ingestion.test.ts
- compilerOptions
- CommandPalette.tsx
- Worst-Case Catalog
- Animation Standards Reference
- devDependencies
- Animation Audit Playbook
- compilerOptions
- compilerOptions
- compilerOptions
- dependencies
- Write Swift
- Apple Design
- compilerOptions
- RuleDetector
- The Fixes
- scripts
- Prototyping Variants
- FeatureDeepDive.tsx
- ci.js
- Sentry for AI Agents Aesthetic Archetype
- supabase.ts
- Glossary
- vite-env.d.ts
- Cryptographic Tamper Detection & Simulation
- Monorepo Service Commands & CI
- Finding Animation Opportunities
- Working With Sonner
- HalfSpaceTreesDetector
- The list
- Design Engineering
- Component Building Principles
- The Animation Decision Framework
- clip-path for Animation
- Performance Rules
- Gesture and Drag Interactions
- CSS Transform Mastery
- The Sonner Principles (Building Loved Components)
- Spring Animations
- Core Philosophy
- Debugging Animations
- copilot-instructions.md

## God Nodes (most connected - your core abstractions)
1. `AiDatabaseClient` - 37 edges
2. `useTheme()` - 33 edges
3. `react` - 32 edges
4. `getUtcTimestamp()` - 32 edges
5. `ShipmentLearner` - 28 edges
6. `getDbClient()` - 23 edges
7. `ColdChainTracker` - 21 edges
8. `createErrorResponse()` - 21 edges
9. `Apple Design` - 21 edges
10. `framer-motion` - 20 edges

## Surprising Connections (you probably didn't know these)
- `River Streaming HST & CUSUM Anomaly Detection` --implements--> `HalfSpaceTreesDetector`  [INFERRED]
  docs/ARCHITECTURE_AND_VERIFICATION.md → ai-service/models/hst_detector.py
- `5-Point Arrival Verification Proof` --references--> `WindowAnchored`  [INFERRED]
  docs/ARCHITECTURE_AND_VERIFICATION.md → contracts/contracts/ColdChainTracker.sol
- `Terminal-Adjacent Design Tokens & Tailwind v4 Theme` --conceptually_related_to--> `ArrivalVerificationView()`  [INFERRED]
  docs/design.md → frontend/src/components/ArrivalVerificationView.tsx
- `River Streaming HST & CUSUM Anomaly Detection` --implements--> `EwmaCusumDetector`  [INFERRED]
  docs/ARCHITECTURE_AND_VERIFICATION.md → ai-service/models/ewma_cusum.py
- `USP <1160> Arrhenius Kinetic Shelf-Life Engine` --implements--> `calculateMKT()`  [INFERRED]
  docs/ARCHITECTURE_AND_VERIFICATION.md → shared/src/kinetics.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cold Chain Cryptographic Pipeline** — shared_src_index_canonicalserialize, shared_src_index_computecanonicalhash, shared_src_index_signwithed25519, shared_src_index_verifyed25519signature, backend_src_services_blockchainservice_blockchainservice_anchorbatchwindowonchain, contracts_contracts_coldchaintracker_contract_coldchaintracker [EXTRACTED 1.00]
- **5-Point Arrival Verification Flow** — docs_architecture_and_verification_five_point_arrival_proof, backend_src_services_verificationservice_verifyshipmentarrival, frontend_src_components_arrivalverificationview_arrivalverificationview, shared_src_kinetics_calculatemkt, backend_migrations_001_initial_schema_anchors [INFERRED 0.95]
- **Streaming AI Advisory ML Pipeline** — docs_architecture_and_verification_immutable_separation_rule, docs_architecture_and_verification_ai_advisory_plane, ai_service_models_hst_detector_halfspacetreesdetector, ai_service_models_ewma_cusum_ewmacusumdetector, ai_service_db_aidatabaseclient [INFERRED 0.95]

## Communities (72 total, 9 thin omitted)

### Community 0 - "shared/src/index.ts"
Cohesion: 0.04
Nodes (55): AiEvaluation, AiEvaluationSchema, AiInsight, AiInsightKind, AiInsightKindSchema, AiInsightSchema, AiInsightSeverity, AiInsightSeveritySchema (+47 more)

### Community 1 - "LandingView.tsx"
Cohesion: 0.09
Nodes (35): AmbientBackground(), AnnotatedText(), AnnotatedTextProps, AsciiReveal(), AsciiRevealProps, AuthModal(), AuthModalProps, ClosingNotes() (+27 more)

### Community 2 - "ColdChainTracker"
Cohesion: 0.05
Nodes (30): blockchainService, ColdChainTracker, ShipmentRegistered, SubmitterUpdated, WindowAnchored, anchorBatchWindow(), registerShipment(), setSubmitter() (+22 more)

### Community 3 - "test_cargo_models.py"
Cohesion: 0.10
Nodes (8): BaseCargoModel, ProduceColdChainModel, VaccineColdChainModel, test_produce_model_transpiration_and_condensation(), test_vaccine_model_freezing_and_heat_excursion(), generate_produce_training_data(), generate_vaccine_training_data(), train_and_evaluate()

### Community 4 - "frontend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, ethers, framer-motion, jspdf, lucide-react, react, react-dom, recharts (+33 more)

### Community 5 - "worker/package.json"
Cohesion: 0.05
Nodes (36): BatchJobData, clearMemoryEnqueuedJobs(), enqueueBatchProcessing(), getMemoryEnqueuedJobs(), getQueue(), memoryQueue, bullmq, ioredis (+28 more)

### Community 6 - "ShipmentLearner"
Cohesion: 0.08
Nodes (12): ShipmentLearner, EwmaCusumDetector, RateOfChangeDetector, create_sample_reading(), test_flat_copied_readings_triggers_spoofing_warning(), test_known_event_downweighting_door_open(), test_normal_simulation_produces_no_warnings(), test_slow_drift_triggers_cusum_drift_warning() (+4 more)

### Community 7 - "main.py"
Cohesion: 0.12
Nodes (22): EvaluationRecord, EvaluationsListResponse, get_cargo_models_metadata(), get_evaluations(), get_shipment_insights(), get_shipment_notifications(), get_shipment_risk(), health_check() (+14 more)

### Community 8 - "ArrivalVerificationView.tsx"
Cohesion: 0.13
Nodes (24): ArrivalVerificationView(), ArrivalVerificationViewProps, OnChainVerificationModalProps, getNetworkDisplayName(), METAMASK_CHROME_STORE_URL, resolveMetaMaskProvider(), useWeb3(), Web3Context (+16 more)

### Community 9 - "contracts/package.json"
Cohesion: 0.07
Nodes (20): config, description, devDependencies, ethers, hardhat, @nomicfoundation/hardhat-toolbox, @types/node, typescript (+12 more)

### Community 10 - "api.ts"
Cohesion: 0.12
Nodes (23): AdminManagementViewProps, AiRiskIntelligenceViewProps, CommandPaletteProps, PalletQrScannerModalProps, alertService, DatabaseAlert, DatabaseAuditLog, UserProfileItem (+15 more)

### Community 11 - "stage4_blockchain_verification.test.ts"
Cohesion: 0.10
Nodes (27): createApp(), DbClient, setTestDbClient(), runMigrations(), runSeed(), bootstrap(), close(), exec() (+19 more)

### Community 12 - "getUtcTimestamp"
Cohesion: 0.09
Nodes (29): AlertRecord, createAlert(), createSecurityAlert(), DeterministicProcessingResult, notificationDispatcher, processBatchDeterministic(), close(), exec() (+21 more)

### Community 13 - "App.tsx"
Cohesion: 0.18
Nodes (19): App(), AdminManagementView(), AiRiskIntelligenceView(), AtmosphereCanvas(), ExcursionSimulatorModal(), ExcursionSimulatorModalProps, ActiveTab, Navbar() (+11 more)

### Community 14 - "CompositeRiskScorer"
Cohesion: 0.31
Nodes (6): CompositeRiskScorer, test_composite_risk_scorer_differentiates_domains(), test_composite_risk_freezing_hazard(), test_composite_risk_high_thermal_excursion(), test_composite_risk_normal_temperature(), test_composite_risk_security_penalty()

### Community 15 - "simulator/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @frostledger/shared, description, devDependencies, tsx, @types/node, typescript, vitest (+14 more)

### Community 16 - "AiDatabaseClient"
Cohesion: 0.07
Nodes (13): AiDatabaseClient, OfflineMlEvaluator, NotificationService, AiService, test_checkpoint_and_restart_resumption_no_duplicates(), test_database_client_enforces_read_only_on_official_tables(), test_two_simultaneous_shipments_maintain_isolated_states(), test_generate_benchmark_dataset_structure() (+5 more)

### Community 17 - "useTheme"
Cohesion: 0.20
Nodes (18): AsciiImage(), AsciiImageProps, BAYER_4X4, CARDS, ModuleCard, Pillar1Playable(), Pillar2Playable(), Pillar3Playable() (+10 more)

### Community 19 - "001_initial_schema.sql"
Cohesion: 0.19
Nodes (19): ai_evaluations, ai_insights, ai_model_state, ai_notifications, alerts, anchors, audit_log, batches (+11 more)

### Community 20 - "backend/package.json"
Cohesion: 0.10
Nodes (19): description, @frostledger/shared, pg, tsx, @types/node, @types/pg, typescript, vitest (+11 more)

### Community 21 - "Expo Animation Recipes"
Cohesion: 0.06
Nodes (33): Bottom sheet you can drag to dismiss, Collapsing header on scroll, Expo Animation Recipes, Firing something once at a threshold, Keyboard-synced UI, List entrances, Press feedback, Screen transitions (Expo Router) (+25 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 23 - "scripts"
Cohesion: 0.11
Nodes (17): description, devDependencies, typescript, typescript, name, private, scripts, bootstrap (+9 more)

### Community 24 - "shared/package.json"
Cohesion: 0.11
Nodes (17): dependencies, zod, description, devDependencies, @types/node, typescript, @types/node, typescript (+9 more)

### Community 25 - "app.ts"
Cohesion: 0.18
Nodes (24): getDbClient(), asyncHandler(), AuthenticatedRequest, authenticateJwt(), requireAdmin, requireRole(), clientRecords, rateLimiter() (+16 more)

### Community 26 - "verificationService.ts"
Cohesion: 0.17
Nodes (16): router, AnchoringResult, checkAndCloseBatchWindow(), computeWindowHash(), OnChainProfileRecord, OnChainWindowRecord, BatchVerificationDetail, generateHtmlIntegrityReport() (+8 more)

### Community 27 - "Animation Recipes"
Cohesion: 0.06
Nodes (31): Accordion / collapse, Animation Recipes, Button press, Drag to dismiss, Drawer / sheet, Dropdown, popover, menu, select, Hold to confirm, Masking a crossfade that won't settle (+23 more)

### Community 28 - "stage2_ingestion.test.ts"
Cohesion: 0.15
Nodes (10): close(), exec(), query(), computeBatchHash(), GENESIS_PREV_HASH, signWithEd25519(), TelemetrySubmission, DeviceSimulator (+2 more)

### Community 29 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+6 more)

### Community 30 - "CommandPalette.tsx"
Cohesion: 0.29
Nodes (12): CommandItem, CommandPalette(), generateTelemetryHistory(), TelemetryReading, buildDeepThermalAnalyticsPdf(), buildOfficialAuditCertificatePdf(), generateDeepThermalAnalyticsPdf(), generateOfficialAuditCertificatePdf() (+4 more)

### Community 31 - "Worst-Case Catalog"
Cohesion: 0.06
Nodes (29): Collections, Emails, URLs, identifiers, Environment, Images and media, Labels, titles, and copy from data, Numbers and money, People and names, States (+21 more)

### Community 32 - "Animation Standards Reference"
Cohesion: 0.07
Nodes (26): Aggressive Escalation Triggers, Guidelines, Initial Response, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format (+18 more)

### Community 33 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, supertest, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken, @types/node (+4 more)

### Community 34 - "Animation Audit Playbook"
Cohesion: 0.08
Nodes (22): 1. Purpose & frequency, 2. Easing & duration, 3. Physicality & origin, 4. Interruptibility, 5. Performance, 6. Accessibility, 7. Cohesion & tokens, 8. Missed opportunities (+14 more)

### Community 35 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 36 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 37 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 38 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcrypt, cors, dotenv, @electric-sql/pglite, express, @frostledger/shared, @frostledger/simulator (+3 more)

### Community 39 - "Write Swift"
Cohesion: 0.09
Nodes (22): 10. ARC and object lifetime, 11. Testing — Swift Testing by default, 12. Macros, 13. Logging and debugging, 14. Unsafe code and interop, 15. Modern syntax you should be using, 16. Migrating an existing codebase to Swift 6, 1. Model data with value types (+14 more)

### Community 40 - "Apple Design"
Cohesion: 0.09
Nodes (21): 10. Gesture design details (the "feel" checklist), 11. Frame-level smoothness, 12. Materials & depth — translucency conveys hierarchy, 13. Multimodal feedback — motion + sound + haptics, 14. Reduced motion & accessibility, 15. Typography — optical sizing, tracking, leading, 16. Design foundations — the eight principles, 17. Process (+13 more)

### Community 41 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, skipLibCheck, strict, target (+2 more)

### Community 43 - "The Fixes"
Cohesion: 0.09
Nodes (21): 10. Status bar color doesn't match, 11. Right in Chrome, wrong on phone, 1. Hover state stuck after tap, 2. Gray/blue flash on tap, 3. Layout has the wrong height, 4. Page zooms into the input, 5. Tap feels laggy, 6. Pull-to-refresh hijacks scroll (+13 more)

### Community 44 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, migrate, seed, start, test (+1 more)

### Community 45 - "Prototyping Variants"
Cohesion: 0.10
Nodes (19): Behavior contract, Markup, Reference wiring, Rules, Styles, The Picker, Hard Rules, Initial Response (+11 more)

### Community 46 - "FeatureDeepDive.tsx"
Cohesion: 0.39
Nodes (7): BarTooltip(), FeatureDeepDive(), InteractiveRiskBar(), InteractiveScannerBar(), SCANNER_FEATURES, SHAP_FEATURES, TerminalPreview()

### Community 47 - "ci.js"
Cohesion: 0.29
Nodes (4): { execSync }, path, rootDir, steps

### Community 48 - "Sentry for AI Agents Aesthetic Archetype"
Cohesion: 0.33
Nodes (5): Sentry for AI Agents Aesthetic Archetype, Terminal-Adjacent Design Tokens & Tailwind v4 Theme, Black Box Landing Page Animation Architecture, Invariant Scanner & Suffix Replay Showcase, AsciiReveal Matrix & ParticleText Canvas

### Community 49 - "supabase.ts"
Cohesion: 0.33
Nodes (5): Shipment, supabase, TelemetryReading, UserProfile, @supabase/supabase-js

### Community 51 - "Glossary"
Cohesion: 0.11
Nodes (18): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Initial Response, Instructions (+10 more)

### Community 56 - "Finding Animation Opportunities"
Cohesion: 0.12
Nodes (16): 1. Frequency — how often will a user see this?, 2. Purpose — why does this animate?, 3. Speed — can it stay inside budget?, 4. Function — does motion help or hinder here?, Finding Animation Opportunities, Hard Rules, Initial Response, Operating Posture (+8 more)

### Community 57 - "Working With Sonner"
Cohesion: 0.15
Nodes (11): Functions, Sonner API Reference, `toast()` options, `<Toaster />`, Initial Response, Picking the right call, Recipes, Setup (+3 more)

### Community 59 - "The list"
Cohesion: 0.18
Nodes (10): Charts, Common mismatches to catch, How to use this, Initial Response, Interaction & performance, Motion & visuals, Picking The Right Library, State & styling (+2 more)

### Community 60 - "Design Engineering"
Cohesion: 0.22
Nodes (8): Accessibility, Design Engineering, Initial Response, prefers-reduced-motion, Review Checklist, Review Format (Required), Stagger Animations, Touch device hover states

### Community 61 - "Component Building Principles"
Cohesion: 0.25
Nodes (8): Animate enter states with @starting-style, Buttons must feel responsive, Component Building Principles, Make popovers origin-aware, Never animate from scale(0), Tooltips: skip delay on subsequent hovers, Use blur to mask imperfect transitions, Use CSS transitions over keyframes for interruptible UI

### Community 62 - "The Animation Decision Framework"
Cohesion: 0.33
Nodes (6): 1. Should this animate at all?, 2. What is the purpose?, 3. What easing should it use?, 4. How fast should it be?, Perceived performance, The Animation Decision Framework

### Community 63 - "clip-path for Animation"
Cohesion: 0.33
Nodes (6): clip-path for Animation, Comparison sliders, Hold-to-delete pattern, Image reveals on scroll, Tabs with perfect color transitions, The inset shape

### Community 64 - "Performance Rules"
Cohesion: 0.33
Nodes (6): CSS animations beat JS under load, CSS variables are inheritable, Framer Motion hardware acceleration caveat, Only animate transform and opacity, Performance Rules, Use WAAPI for programmatic CSS animations

### Community 65 - "Gesture and Drag Interactions"
Cohesion: 0.33
Nodes (6): Damping at boundaries, Friction instead of hard stops, Gesture and Drag Interactions, Momentum-based dismissal, Multi-touch protection, Pointer capture for drag

### Community 66 - "CSS Transform Mastery"
Cohesion: 0.40
Nodes (5): 3D transforms for depth, CSS Transform Mastery, scale() scales children too, transform-origin, translateY with percentages

### Community 67 - "The Sonner Principles (Building Loved Components)"
Cohesion: 0.40
Nodes (5): Asymmetric enter/exit timing, Cohesion matters, Review your work the next day, The opacity + height combination, The Sonner Principles (Building Loved Components)

### Community 68 - "Spring Animations"
Cohesion: 0.40
Nodes (5): Interruptibility advantage, Spring Animations, Spring-based mouse interactions, Spring configuration, When to use springs

### Community 69 - "Core Philosophy"
Cohesion: 0.50
Nodes (4): Beauty is leverage, Core Philosophy, Taste is trained, not innate, Unseen details compound

### Community 70 - "Debugging Animations"
Cohesion: 0.50
Nodes (4): Debugging Animations, Frame-by-frame inspection, Slow motion testing, Test on real devices

## Knowledge Gaps
- **48 isolated node(s):** `@frostledger/shared`, `@frostledger/simulator`, `pg`, `zod`, `@types/bcrypt` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 794 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `5-Point Arrival Verification Proof` connect `verificationService.ts` to `ColdChainTracker`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AiDatabaseClient` (e.g. with `OfflineMlEvaluator` and `NotificationService`) actually correct?**
  _`AiDatabaseClient` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@frostledger/shared`, `@frostledger/simulator`, `pg` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `shared/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Why does `bullmq` connect `worker/package.json` to `getUtcTimestamp`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `ShipmentLearner` (e.g. with `OfflineMlEvaluator` and `ProduceColdChainModel`) actually correct?**
  _`ShipmentLearner` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `LandingView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._