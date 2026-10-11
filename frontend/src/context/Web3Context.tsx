import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import {
  DEFAULT_CONTRACT_ADDRESS,
  POLYGON_AMOY_CONFIG,
  POLYGON_AMOY_CHAIN_ID,
  HARDHAT_CHAIN_ID,
} from '../lib/contracts';

export const METAMASK_CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';

interface Web3ContextType {
  account: string | null;
  chainId: number | null;
  networkName: string;
  isMetaMaskInstalled: boolean;
  isMetaMaskChromeExtension: boolean;
  isConnecting: boolean;
  error: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  contractAddress: string;
  setContractAddress: (addr: string) => void;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  switchToAmoy: () => Promise<void>;
  switchToHardhat: () => Promise<void>;
  chromeStoreUrl: string;
}

const Web3Context = createContext<Web3ContextType | null>(null);

function getNetworkDisplayName(id: number | null): string {
  if (!id) return 'Not Connected';
  if (id === POLYGON_AMOY_CHAIN_ID) return 'Polygon Amoy';
  if (id === HARDHAT_CHAIN_ID) return 'Hardhat Localhost (31337)';
  if (id === 1) return 'Ethereum Mainnet';
  if (id === 11155111) return 'Sepolia Testnet';
  if (id === 137) return 'Polygon Mainnet';
  return `EVM Chain #${id}`;
}

/**
 * Resolves the MetaMask provider specifically, prioritizing EIP-6963,
 * window.ethereum.providers array, and window.ethereum.isMetaMask.
 */
function resolveMetaMaskProvider(eip6963Provider?: any): any {
  if (eip6963Provider) return eip6963Provider;
  if (typeof window === 'undefined') return null;

  const eth = (window as any).ethereum;
  if (!eth) return null;

  // Handle multi-wallet extensions where window.ethereum.providers exists
  if (eth.providers && Array.isArray(eth.providers)) {
    const metaMask = eth.providers.find((p: any) => p.isMetaMask && !p.isBraveWallet);
    if (metaMask) return metaMask;
    const anyMetaMask = eth.providers.find((p: any) => p.isMetaMask);
    if (anyMetaMask) return anyMetaMask;
  }

  if (eth.isMetaMask) return eth;
  return eth;
}

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT_ADDRESS);

  // EIP-6963 provider discovered from MetaMask extension
  const [eip6963MetaMask, setEip6963MetaMask] = useState<any>(null);
  const [isDetected, setIsDetected] = useState<boolean>(false);

  const activeEthereumRef = useRef<any>(null);

  // Synchronize network and signer when account or provider changes
  const initSignerAndNetwork = useCallback(async (browserProvider: ethers.BrowserProvider) => {
    try {
      const net = await browserProvider.getNetwork();
      setChainId(Number(net.chainId));
      const s = await browserProvider.getSigner();
      const addr = await s.getAddress();
      setSigner(s);
      setAccount(addr);
      setError(null);
      return addr;
    } catch (err: any) {
      console.error('[Web3] Error initializing signer & network:', err);
      setError(err?.message || 'Failed to initialize signer from MetaMask extension');
      return null;
    }
  }, []);

  // Check and setup provider
  const setupProvider = useCallback(
    async (injected: any) => {
      if (!injected) return;
      activeEthereumRef.current = injected;
      setIsDetected(true);

      try {
        const accounts: string[] = await injected.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          const browserProvider = new ethers.BrowserProvider(injected);
          setProvider(browserProvider);
          await initSignerAndNetwork(browserProvider);
        }
      } catch (err) {
        console.debug('[Web3] eth_accounts check:', err);
      }
    },
    [initSignerAndNetwork]
  );

  // 1. EIP-6963 Multi Injected Provider Discovery (modern Chrome extensions)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAnnounceProvider = (event: any) => {
      const { info, provider: announcedProvider } = event.detail || {};
      if (
        info?.rdns === 'io.metamask' ||
        info?.name?.toLowerCase().includes('metamask') ||
        announcedProvider?.isMetaMask
      ) {
        console.log('[Web3] EIP-6963 detected MetaMask Chrome Extension:', info);
        setEip6963MetaMask(announcedProvider);
        setupProvider(announcedProvider);
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounceProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // 2. MetaMask delayed injection listener ('ethereum#initialized') for Chrome
    const handleEthereumInitialized = () => {
      console.log('[Web3] ethereum#initialized event fired by Chrome extension');
      const resolved = resolveMetaMaskProvider();
      if (resolved) {
        setupProvider(resolved);
      }
    };

    window.addEventListener('ethereum#initialized', handleEthereumInitialized, { once: true });

    // 3. Immediate check and retry check after 500ms
    const immediate = resolveMetaMaskProvider();
    if (immediate) {
      setupProvider(immediate);
    } else {
      const timer = setTimeout(() => {
        const delayed = resolveMetaMaskProvider();
        if (delayed) {
          setupProvider(delayed);
        }
      }, 600);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('eip6963:announceProvider', handleAnnounceProvider);
      };
    }

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounceProvider);
    };
  }, [setupProvider]);

  // Connect to MetaMask with explicit user permission request (EIP-1102)
  const connectWallet = useCallback(async (): Promise<string | null> => {
    const ethereum = resolveMetaMaskProvider(eip6963MetaMask) || activeEthereumRef.current;
    if (!ethereum) {
      const msg =
        'MetaMask Chrome Extension not detected. Please install MetaMask from the Chrome Web Store to interact with the smart contract.';
      setError(msg);
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1st Ask permission to connect to MetaMask Chrome extension
      const accounts: string[] = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts authorized in MetaMask extension');
      }

      const browserProvider = new ethers.BrowserProvider(ethereum);
      setProvider(browserProvider);
      activeEthereumRef.current = ethereum;
      const addr = await initSignerAndNetwork(browserProvider);
      return addr;
    } catch (err: any) {
      console.warn('[Web3] User rejected or failed to connect MetaMask Chrome extension:', err);
      let msg = err?.message || 'Failed to connect MetaMask Chrome extension';
      if (err?.code === 4001) {
        msg = 'Connection request was rejected in MetaMask. Please open your extension and grant permission.';
      } else if (err?.code === -32002) {
        msg =
          'Request already pending in MetaMask! Please click the MetaMask fox icon in your Chrome toolbar / puzzle menu (🧩) to approve.';
      }
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [eip6963MetaMask, initSignerAndNetwork]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
  }, []);

  // Switch or add Polygon Amoy testnet
  const switchToAmoy = useCallback(async () => {
    const ethereum = resolveMetaMaskProvider(eip6963MetaMask) || activeEthereumRef.current;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_AMOY_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [POLYGON_AMOY_CONFIG],
          });
        } catch (addError: any) {
          setError(addError?.message || 'Failed to add Polygon Amoy network to MetaMask extension');
        }
      } else {
        setError(switchError?.message || 'Failed to switch network in MetaMask extension');
      }
    }
  }, [eip6963MetaMask]);

  // Switch to Hardhat Localhost (Chain ID 31337 = 0x7a69)
  const switchToHardhat = useCallback(async () => {
    const ethereum = resolveMetaMaskProvider(eip6963MetaMask) || activeEthereumRef.current;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7a69',
                chainName: 'Hardhat Localhost',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['http://127.0.0.1:8545'],
              },
            ],
          });
        } catch (addError: any) {
          setError(addError?.message || 'Failed to add Hardhat network to MetaMask extension');
        }
      } else {
        setError(switchError?.message || 'Failed to switch to Hardhat network');
      }
    }
  }, [eip6963MetaMask]);

  // Listen for account and network changes on active provider
  useEffect(() => {
    const ethereum = resolveMetaMaskProvider(eip6963MetaMask) || activeEthereumRef.current;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        const browserProvider = new ethers.BrowserProvider(ethereum);
        setProvider(browserProvider);
        initSignerAndNetwork(browserProvider);
      }
    };

    const handleChainChanged = () => {
      const browserProvider = new ethers.BrowserProvider(ethereum);
      setProvider(browserProvider);
      initSignerAndNetwork(browserProvider);
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [eip6963MetaMask, disconnectWallet, initSignerAndNetwork]);

  const isMetaMaskInstalled =
    isDetected || Boolean(resolveMetaMaskProvider(eip6963MetaMask));

  const isMetaMaskChromeExtension =
    isMetaMaskInstalled &&
    typeof window !== 'undefined' &&
    /Chrome/.test(navigator.userAgent) &&
    /Google Inc/.test(navigator.vendor);

  const networkName = getNetworkDisplayName(chainId);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        networkName,
        isMetaMaskInstalled,
        isMetaMaskChromeExtension,
        isConnecting,
        error,
        provider,
        signer,
        contractAddress,
        setContractAddress,
        connectWallet,
        disconnectWallet,
        switchToAmoy,
        switchToHardhat,
        chromeStoreUrl: METAMASK_CHROME_STORE_URL,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
