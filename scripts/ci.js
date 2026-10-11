const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const steps = [
  { name: 'Shared Module (Typecheck & Build)', cmd: 'npm run build --workspace=@frostledger/shared' },
  { name: 'Simulator (Typecheck & Build)', cmd: 'npm run build --workspace=@frostledger/simulator' },
  { name: 'Simulator (Unit Tests)', cmd: 'npm run test --workspace=@frostledger/simulator' },
  { name: 'Backend (Typecheck)', cmd: 'npm run typecheck --workspace=@frostledger/backend' },
  { name: 'Backend (Acceptance Tests)', cmd: 'npm run test --workspace=@frostledger/backend' },
  { name: 'Worker (Typecheck)', cmd: 'npm run typecheck --workspace=@frostledger/worker' },
  { name: 'Worker (Unit Tests)', cmd: 'npm run test --workspace=@frostledger/worker' },
  { name: 'Contracts (Hardhat Tests)', cmd: 'npm run test --workspace=@frostledger/contracts' },
  { name: 'AI Service (Pytest Test Suite)', cmd: 'uv run --python 3.11 --with-requirements requirements.txt pytest', cwd: path.resolve(rootDir, 'ai-service') },
  { name: 'Frontend (Typecheck & Production Build)', cmd: 'npm run build --workspace=@frostledger/frontend' },
];

console.log('====================================================');
console.log('FrostLedger Monorepo CI Pipeline Verification');
console.log('====================================================\n');

let failed = false;

for (const step of steps) {
  process.stdout.write(`[*] Running: ${step.name}... `);
  try {
    execSync(step.cmd, { cwd: step.cwd || rootDir, stdio: 'pipe' });
    console.log('PASSED');
  } catch (err) {
    console.log('FAILED');
    console.error(`\nError executing: ${step.cmd}\n`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failed = true;
    break;
  }
}

if (failed) {
  console.error('\n❌ CI Pipeline Checks Failed');
  process.exit(1);
} else {
  console.log('\n✅ All Monorepo Checks Passed Cleanly');
  process.exit(0);
}
