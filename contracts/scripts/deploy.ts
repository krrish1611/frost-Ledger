import { ethers } from 'hardhat';

async function main() {
  console.log('[Deploy] Deploying ColdChainTracker smart contract...');
  const [deployer] = await ethers.getSigners();
  console.log(`[Deploy] Deployer address: ${deployer.address}`);

  const ColdChainTracker = await ethers.getContractFactory('ColdChainTracker');
  const tracker = await ColdChainTracker.deploy();
  await tracker.waitForDeployment();

  const contractAddress = await tracker.getAddress();
  console.log(`[Deploy] ColdChainTracker successfully deployed to: ${contractAddress}`);
}

main().catch((error) => {
  console.error('[Deploy] Error during deployment:', error);
  process.exitCode = 1;
});
