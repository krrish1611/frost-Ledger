import { ethers } from 'ethers';

export const COLD_CHAIN_TRACKER_ABI = [
  'constructor()',
  'event SubmitterUpdated(address indexed submitter, bool authorized)',
  'event ShipmentRegistered(string indexed shipmentId, bytes32 indexed profileHash)',
  'event WindowAnchored(string indexed shipmentId, bytes32 indexed windowHash, uint256 startSeq, uint256 endSeq)',
  'function owner() view returns (address)',
  'function authorizedSubmitters(address) view returns (bool)',
  'function setSubmitter(address submitter, bool authorized)',
  'function registerShipment(string shipmentId, bytes32 profileHash, int256 tempMinMilliC, int256 tempMaxMilliC)',
  'function anchorBatchWindow(string shipmentId, bytes32 windowHash, uint256 startSeq, uint256 endSeq)',
  'function checkOnChainThresholds(string shipmentId, int256 tempMilliC) view returns (bool inRange)',
  'function getWindowsCount(string shipmentId) view returns (uint256)',
  'function getWindow(string shipmentId, uint256 index) view returns (bytes32 windowHash, uint256 startSeq, uint256 endSeq, uint256 timestamp)',
  'function getShipmentProfile(string shipmentId) view returns (bytes32 profileHash, int256 tempMinMilliC, int256 tempMaxMilliC, uint256 registeredAt)',
  'function shipmentProfiles(string) view returns (bytes32 profileHash, int256 tempMinMilliC, int256 tempMaxMilliC, uint256 registeredAt)',
];

export const DEFAULT_CONTRACT_ADDRESS =
  (import.meta as any).env?.VITE_CONTRACT_ADDRESS ||
  '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37';

export const POLYGON_AMOY_CHAIN_ID = 80002;
export const HARDHAT_CHAIN_ID = 31337;

export const POLYGON_AMOY_RPC_URL =
  (import.meta as any).env?.VITE_POLYGON_AMOY_RPC_URL ||
  'https://rpc-amoy.polygon.technology';

export const POLYGON_AMOY_CONFIG = {
  chainId: '0x13882', // 80002
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: [POLYGON_AMOY_RPC_URL, 'https://rpc-amoy.polygon.technology'],
  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
};

export interface OnChainProfileData {
  profileHash: string;
  tempMinMilliC: number;
  tempMaxMilliC: number;
  tempMinC: number;
  tempMaxC: number;
  registeredAt: number;
  isRegistered: boolean;
}

export interface OnChainWindowData {
  index: number;
  windowHash: string;
  startSeq: number;
  endSeq: number;
  timestamp: number;
}

export interface LiveContractAuditResult {
  contractAddress: string;
  connectedNetwork: string;
  chainId: number | null;
  contractOwner: string | null;
  isSubmitterAuthorized: boolean;
  profile: OnChainProfileData;
  windows: OnChainWindowData[];
  totalWindows: number;
  queriedAt: string;
}

/**
 * Creates an ethers Contract instance connected to a provider or signer
 */
export function getColdChainTrackerContract(
  contractAddress: string,
  runner: ethers.ContractRunner
): ethers.Contract {
  return new ethers.Contract(contractAddress, COLD_CHAIN_TRACKER_ABI, runner);
}

/**
 * Live queries the smart contract for shipment profile & anchored batch windows
 */
export async function queryColdChainContract(
  contractAddress: string,
  runner: ethers.ContractRunner,
  shipmentId: string,
  userAddress?: string | null
): Promise<LiveContractAuditResult> {
  const contract = getColdChainTrackerContract(contractAddress, runner);

  // 1. Contract metadata
  let contractOwner: string | null = null;
  let isSubmitterAuthorized = false;

  try {
    contractOwner = await contract.owner();
    if (userAddress) {
      if (contractOwner && contractOwner.toLowerCase() === userAddress.toLowerCase()) {
        isSubmitterAuthorized = true;
      } else {
        isSubmitterAuthorized = await contract.authorizedSubmitters(userAddress);
      }
    }
  } catch (err) {
    console.warn('[Contract] Could not query owner / authorization:', err);
  }

  // 2. Fetch shipment profile snapshot
  let profile: OnChainProfileData = {
    profileHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    tempMinMilliC: 0,
    tempMaxMilliC: 0,
    tempMinC: 0,
    tempMaxC: 0,
    registeredAt: 0,
    isRegistered: false,
  };

  try {
    const rawProfile = await contract.getShipmentProfile(shipmentId);
    const registeredAt = Number(rawProfile[3] ?? rawProfile.registeredAt ?? 0);
    const profileHash = (rawProfile[0] ?? rawProfile.profileHash ?? '').toString();
    const tempMinMilliC = Number(rawProfile[1] ?? rawProfile.tempMinMilliC ?? 0);
    const tempMaxMilliC = Number(rawProfile[2] ?? rawProfile.tempMaxMilliC ?? 0);

    profile = {
      profileHash,
      tempMinMilliC,
      tempMaxMilliC,
      tempMinC: tempMinMilliC / 1000,
      tempMaxC: tempMaxMilliC / 1000,
      registeredAt,
      isRegistered: registeredAt > 0,
    };
  } catch (err) {
    console.warn(`[Contract] Profile for ${shipmentId} not registered or query failed:`, err);
  }

  // 3. Fetch anchored batch windows
  const windows: OnChainWindowData[] = [];
  let totalWindows = 0;

  try {
    const countBig = await contract.getWindowsCount(shipmentId);
    totalWindows = Number(countBig);

    for (let i = 0; i < totalWindows; i++) {
      try {
        const win = await contract.getWindow(shipmentId, i);
        windows.push({
          index: i,
          windowHash: (win[0] ?? win.windowHash).toString(),
          startSeq: Number(win[1] ?? win.startSeq),
          endSeq: Number(win[2] ?? win.endSeq),
          timestamp: Number(win[3] ?? win.timestamp),
        });
      } catch (e) {
        console.warn(`[Contract] Error fetching window index ${i}:`, e);
      }
    }
  } catch (err) {
    console.warn(`[Contract] Windows count for ${shipmentId} query failed:`, err);
  }

  // Determine network name if runner is provider
  let connectedNetwork = 'Unknown Network';
  let chainId: number | null = null;
  try {
    if ('getNetwork' in runner && typeof (runner as any).getNetwork === 'function') {
      const net = await (runner as any).getNetwork();
      chainId = Number(net.chainId);
      connectedNetwork = net.name || `Chain ID ${net.chainId}`;
    }
  } catch {
    // ignore
  }

  return {
    contractAddress,
    connectedNetwork,
    chainId,
    contractOwner,
    isSubmitterAuthorized,
    profile,
    windows,
    totalWindows,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * Registers shipment profile directly on-chain via MetaMask connected Signer
 */
export async function registerShipmentOnChain(
  contractAddress: string,
  signer: ethers.JsonRpcSigner,
  shipmentId: string,
  profileHash: string,
  tempMinC: number,
  tempMaxC: number
): Promise<{ txHash: string }> {
  const contract = getColdChainTrackerContract(contractAddress, signer);
  const hashBytes32 = profileHash.startsWith('0x') ? profileHash : `0x${profileHash}`;
  const minMilliC = Math.round(tempMinC * 1000);
  const maxMilliC = Math.round(tempMaxC * 1000);

  const tx = await contract.registerShipment(shipmentId, hashBytes32, minMilliC, maxMilliC);
  const receipt = await tx.wait();
  return { txHash: receipt?.hash || tx.hash };
}

/**
 * Anchors batch window hash directly on-chain via MetaMask connected Signer
 */
export async function anchorBatchWindowOnChain(
  contractAddress: string,
  signer: ethers.JsonRpcSigner,
  shipmentId: string,
  windowHash: string,
  startSeq: number,
  endSeq: number
): Promise<{ txHash: string }> {
  const contract = getColdChainTrackerContract(contractAddress, signer);
  const hashBytes32 = windowHash.startsWith('0x') ? windowHash : `0x${windowHash}`;

  const tx = await contract.anchorBatchWindow(shipmentId, hashBytes32, startSeq, endSeq);
  const receipt = await tx.wait();
  return { txHash: receipt?.hash || tx.hash };
}

/**
 * Runs on-chain temperature threshold check on the live contract
 */
export async function checkOnChainThresholds(
  contractAddress: string,
  runner: ethers.ContractRunner,
  shipmentId: string,
  tempC: number
): Promise<boolean> {
  const contract = getColdChainTrackerContract(contractAddress, runner);
  const tempMilliC = Math.round(tempC * 1000);
  return await contract.checkOnChainThresholds(shipmentId, tempMilliC);
}
