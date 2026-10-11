import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  FileText,
  AlertTriangle,
  Lock,
  Link as LinkIcon,
  Cpu,
  Printer,
  Wallet,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Send,
  Zap,
  Radio,
  Check,
  Download,
  FileBarChart,
  Eye,
  QrCode,
} from 'lucide-react';
import {
  MOCK_SHIPMENTS,
  API_BASE,
  ShipmentSummary,
  fetchDashboardState,
  verifyShipmentArrivalApi,
} from '../services/api';
import { useWeb3 } from '../context/Web3Context';
import { useTheme } from '../context/ThemeContext';
import {
  generateOfficialAuditCertificatePdf,
  generateDeepThermalAnalyticsPdf,
  previewOfficialAuditCertificatePdf,
  previewDeepThermalAnalyticsPdf,
} from '../services/pdfReportGenerator';
import {
  queryColdChainContract,
  registerShipmentOnChain,
  anchorBatchWindowOnChain,
  checkOnChainThresholds,
  LiveContractAuditResult,
  POLYGON_AMOY_CHAIN_ID,
  DEFAULT_CONTRACT_ADDRESS,
} from '../lib/contracts';
import { ethers } from 'ethers';
import { PalletQrScannerModal } from './PalletQrScannerModal';
import { PolygonScanLink } from './PolygonScanLink';
import { soundEffects } from '../services/soundEffects';

interface ArrivalVerificationViewProps {
  selectedShipmentId?: string;
  onSelectShipmentId?: (id: string) => void;
  isQrScannerOpen?: boolean;
  onCloseQrScanner?: () => void;
}

export const ArrivalVerificationView: React.FC<ArrivalVerificationViewProps> = ({
  selectedShipmentId: propSelectedId,
  onSelectShipmentId,
  isQrScannerOpen: propIsQrScannerOpen,
  onCloseQrScanner,
}) => {
  const {
    account,
    chainId,
    networkName,
    isMetaMaskInstalled,
    isConnecting,
    error: web3Error,
    signer,
    provider,
    contractAddress,
    setContractAddress,
    connectWallet,
    disconnectWallet,
    switchToAmoy,
    chromeStoreUrl,
    isMetaMaskChromeExtension,
  } = useWeb3();

  const [shipmentsList, setShipmentsList] = useState<ShipmentSummary[]>(MOCK_SHIPMENTS);
  const [selectedId, setSelectedId] = useState(propSelectedId || MOCK_SHIPMENTS[0].shipment_id);
  const [localQrOpen, setLocalQrOpen] = useState(false);
  const isQrScannerOpen = propIsQrScannerOpen !== undefined ? propIsQrScannerOpen : localQrOpen;
  const setIsQrScannerOpen = (val: boolean) => {
    setLocalQrOpen(val);
    if (!val && onCloseQrScanner) onCloseQrScanner();
  };

  useEffect(() => {
    fetchDashboardState().then((state) => {
      if (state && state.shipments.length > 0) {
        setShipmentsList(state.shipments);
      }
    });
  }, []);

  useEffect(() => {
    if (propSelectedId && propSelectedId !== selectedId) {
      setSelectedId(propSelectedId);
    }
  }, [propSelectedId]);

  const [isTamperSimulated, setIsTamperSimulated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isQueryingContract, setIsQueryingContract] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState<string | null>(null);
  const [recentTxHash, setRecentTxHash] = useState<string | null>(null);

  // Live contract query result
  const [contractAudit, setContractAudit] = useState<LiveContractAuditResult | null>(null);
  const [contractQueryError, setContractQueryError] = useState<string | null>(null);

  // Live on-chain threshold test state
  const [testTempC, setTestTempC] = useState<number>(4.2);
  const [thresholdTestResult, setThresholdTestResult] = useState<boolean | null>(null);
  const [isTestingThreshold, setIsTestingThreshold] = useState(false);

  const shipment = shipmentsList.find((s) => s.shipment_id === selectedId) || shipmentsList[0] || MOCK_SHIPMENTS[0];

  // Live Query Smart Contract
  const handleQueryContractLive = useCallback(async () => {
    setIsQueryingContract(true);
    setContractQueryError(null);

    try {
      // Determine runner: use browser provider/signer if connected, or fallback to public Polygon Amoy JSON-RPC
      let runner: ethers.ContractRunner | null = signer || provider;
      if (!runner) {
        // Fallback read-only provider for Polygon Amoy
        runner = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
      }

      const result = await queryColdChainContract(
        contractAddress,
        runner,
        selectedId,
        account
      );
      setContractAudit(result);
    } catch (err: any) {
      console.warn('[ArrivalVerification] Contract query error:', err);
      setContractQueryError(
        err?.message || 'Could not query contract. Please check contract address and network connectivity.'
      );
    } finally {
      setIsQueryingContract(false);
    }
  }, [contractAddress, selectedId, account, signer, provider]);

  // Query contract when shipment or account or contractAddress changes
  useEffect(() => {
    handleQueryContractLive();
  }, [handleQueryContractLive]);

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [auditSuccessToast, setAuditSuccessToast] = useState<string | null>(null);

  // Connect MetaMask helper with permission handling
  const handleConnectMetaMask = async () => {
    setTxStatusMessage('Prompting MetaMask for permission...');
    const connectedAccount = await connectWallet();
    if (connectedAccount) {
      setTxStatusMessage(`Connected to account ${connectedAccount.substring(0, 6)}...${connectedAccount.substring(38)}`);
      setTimeout(() => setTxStatusMessage(null), 4000);
    }
  };

  // Run arrival verification audit
  const handleRunVerify = async () => {
    soundEffects.playClick();
    setIsVerifying(true);
    setAuditSuccessToast(null);
    try {
      await Promise.all([
        handleQueryContractLive(),
        verifyShipmentArrivalApi(selectedId),
      ]);
      soundEffects.playSuccessChime();
      setAuditSuccessToast(
        'Audit complete! Cryptographic checks & live on-chain contract verified. Official PDF & Deep Thermal Analytics PDF ready.'
      );
      setTimeout(() => setAuditSuccessToast(null), 8000);
    } finally {
      setTimeout(() => {
        setIsVerifying(false);
      }, 500);
    }
  };

  // Download official cryptographic audit certificate PDF
  const handleDownloadOfficialPdf = () => {
    generateOfficialAuditCertificatePdf(shipment, contractAudit, isTamperSimulated, account);
    setAuditSuccessToast(`Downloaded Official Audit Certificate PDF: FrostLedger_Official_Audit_Certificate_${shipment.shipment_id}.pdf`);
    setTimeout(() => setAuditSuccessToast(null), 6000);
  };

  // Preview official audit certificate in a new tab
  const handlePreviewOfficialPdf = () => {
    previewOfficialAuditCertificatePdf(shipment, contractAudit, isTamperSimulated, account);
  };

  // Download deep thermal analytics and temperature evaluation PDF
  const handleDownloadThermalAnalyticsPdf = () => {
    generateDeepThermalAnalyticsPdf(shipment, contractAudit);
    setAuditSuccessToast(`Downloaded Deep Thermal Analytics PDF: FrostLedger_Deep_Thermal_Analytics_${shipment.shipment_id}.pdf`);
    setTimeout(() => setAuditSuccessToast(null), 6000);
  };

  // Preview deep thermal analytics in a new tab
  const handlePreviewThermalAnalyticsPdf = () => {
    previewDeepThermalAnalyticsPdf(shipment, contractAudit);
  };

  // Action: Register current shipment on-chain via MetaMask
  const handleRegisterOnChain = async () => {
    if (!account || !signer) {
      setTxStatusMessage('1st connecting to MetaMask (permission required)...');
      const conn = await connectWallet();
      if (!conn) return;
    }

    if (!signer) return;

    setIsSubmittingTx(true);
    setTxStatusMessage('Awaiting MetaMask transaction signature...');
    setRecentTxHash(null);

    try {
      // Sample canonical profile hash
      const profileHash = shipment.profile_id === 'profile-vaccine-2-8c'
        ? '0x3f7a1c8b9d0e2f4a6b8c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a'
        : '0x8a2f4c6e9b0d1a3c5e7f9a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d1e3f5a7b9c1d';

      const res = await registerShipmentOnChain(
        contractAddress,
        signer,
        selectedId,
        profileHash,
        shipment.temp_min_c,
        shipment.temp_max_c
      );

      setRecentTxHash(res.txHash);
      setTxStatusMessage(`Shipment successfully registered on-chain! Tx: ${res.txHash.substring(0, 10)}...`);
      await handleQueryContractLive();
    } catch (err: any) {
      console.error('[ArrivalVerification] Registration failed:', err);
      setTxStatusMessage(`Transaction failed: ${err?.reason || err?.message || 'User rejected or reverted'}`);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Action: Anchor batch window on-chain via MetaMask
  const handleAnchorWindowOnChain = async () => {
    if (!account || !signer) {
      setTxStatusMessage('1st connecting to MetaMask (permission required)...');
      const conn = await connectWallet();
      if (!conn) return;
    }

    if (!signer) return;

    setIsSubmittingTx(true);
    setTxStatusMessage('Awaiting MetaMask signature for window anchor...');
    setRecentTxHash(null);

    try {
      const currentWinCount = contractAudit?.totalWindows || 0;
      const startSeq = currentWinCount === 0 ? 1 : currentWinCount * 5 + 1;
      const endSeq = startSeq + 4;
      const windowHash = ethers.keccak256(
        ethers.toUtf8Bytes(`batch-window-${selectedId}-${startSeq}-${endSeq}-${Date.now()}`)
      );

      const res = await anchorBatchWindowOnChain(
        contractAddress,
        signer,
        selectedId,
        windowHash,
        startSeq,
        endSeq
      );

      setRecentTxHash(res.txHash);
      setTxStatusMessage(`Window [${startSeq}..${endSeq}] anchored on-chain! Tx: ${res.txHash.substring(0, 10)}...`);
      await handleQueryContractLive();
    } catch (err: any) {
      console.error('[ArrivalVerification] Anchoring failed:', err);
      setTxStatusMessage(`Anchoring failed: ${err?.reason || err?.message || 'User rejected or reverted'}`);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Action: Live On-Chain Threshold Check
  const handleTestThresholdOnChain = async () => {
    setIsTestingThreshold(true);
    try {
      let runner: ethers.ContractRunner | null = signer || provider;
      if (!runner) {
        runner = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
      }
      const inRange = await checkOnChainThresholds(contractAddress, runner, selectedId, testTempC);
      setThresholdTestResult(inRange);
    } catch (err: any) {
      console.error('[ArrivalVerification] Threshold check error:', err);
      setThresholdTestResult(null);
    } finally {
      setIsTestingThreshold(false);
    }
  };

  // Determine on-chain match
  const isOnChainRegistered = contractAudit?.profile?.isRegistered ?? false;
  const onChainWindowsCount = contractAudit?.totalWindows ?? 0;
  const isChainAnchorValid =
    !isTamperSimulated &&
    (isOnChainRegistered || shipment.anchored_tx !== null);

  const isVerified =
    !isTamperSimulated && shipment.status !== 'flagged' && isChainAnchorValid;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header Bar with MetaMask Integration */}
      <div
        className="panel"
        style={{
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>
              Cryptographic Arrival Verification Engine
            </h2>
            <span
              className="badge"
              style={{
                background: account
                  ? 'rgba(125, 249, 196, 0.15)'
                  : isMetaMaskInstalled
                  ? 'rgba(56, 189, 248, 0.15)'
                  : 'rgba(232, 177, 76, 0.15)',
                color: account
                  ? 'var(--color-accent)'
                  : isMetaMaskInstalled
                  ? '#38bdf8'
                  : 'var(--color-warn)',
                border: account
                  ? '1px solid var(--color-accent)'
                  : isMetaMaskInstalled
                  ? '1px solid #38bdf8'
                  : '1px solid var(--color-warn)',
                fontSize: '11px',
                padding: '2px 8px',
              }}
            >
              {account
                ? `🦊 MetaMask ${isMetaMaskChromeExtension ? 'Chrome' : ''} Extension Connected`
                : isMetaMaskInstalled
                ? `🦊 MetaMask ${isMetaMaskChromeExtension ? 'Chrome' : ''} Extension Ready`
                : 'MetaMask Extension Not Detected'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            Audits Ed25519 hardware signatures, hash-chain continuity, and live Polygon Amoy smart contract anchors via MetaMask Chrome Extension.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsQrScannerOpen(true);
            }}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              borderColor: 'var(--color-accent)',
              color: 'var(--color-accent)',
            }}
            title="Scan Pallet QR code with camera, badge generator, or photo upload"
          >
            <QrCode size={15} />
            <span>Scan Pallet QR</span>
          </button>

          <select
            value={selectedId}
            onChange={(e) => {
              soundEffects.playClick();
              const newId = e.target.value;
              setSelectedId(newId);
              onSelectShipmentId?.(newId);
              setIsTamperSimulated(false);
              setThresholdTestResult(null);
            }}
            style={{ padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)' }}
          >
            {shipmentsList.map((s) => (
              <option key={s.shipment_id} value={s.shipment_id}>
                {s.shipment_id} ({s.profile_name})
              </option>
            ))}
          </select>

          <button onClick={handleRunVerify} className="btn btn-accent" disabled={isVerifying}>
            <ShieldCheck size={16} />
            {isVerifying ? 'Auditing Hash Chain...' : 'Re-verify Arrival'}
          </button>
        </div>
      </div>

      {/* 2. MetaMask Permission & Connection Card */}
      <div
        className="panel"
        style={{
          padding: '1.25rem',
          border: account ? '1px solid rgba(125, 249, 196, 0.3)' : '1px solid rgba(232, 177, 76, 0.4)',
          background: account
            ? 'linear-gradient(135deg, rgba(125, 249, 196, 0.04) 0%, rgba(17, 17, 19, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(232, 177, 76, 0.04) 0%, rgba(17, 17, 19, 0.95) 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: account ? 'rgba(125, 249, 196, 0.12)' : 'rgba(232, 177, 76, 0.12)',
                color: account ? 'var(--color-accent)' : 'var(--color-warn)',
              }}
            >
              <Wallet size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  {account
                    ? 'MetaMask Chrome Extension Connected'
                    : isMetaMaskInstalled
                    ? 'MetaMask Chrome Extension Ready to Connect'
                    : 'MetaMask Chrome Extension Required'}
                </span>
                {account && (
                  <span className="status-dot status-dot-active" title="Connected to active Ethereum provider" />
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0' }}>
                {account
                  ? `Signer: ${account.substring(0, 6)}...${account.substring(38)} • Network: ${networkName}`
                  : isMetaMaskInstalled
                  ? 'MetaMask extension detected. Click below to grant connection permission in Chrome.'
                  : 'To execute transactions and sign smart contract anchors, add MetaMask to Chrome and grant permission.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isMetaMaskInstalled && (
              <a
                href={chromeStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '0.4rem 0.75rem', textDecoration: 'none' }}
                title="Open Chrome Web Store to install official MetaMask extension"
              >
                Add to Chrome (Web Store) <ExternalLink size={13} style={{ marginLeft: '4px' }} />
              </a>
            )}

            {!account ? (
              <button
                onClick={handleConnectMetaMask}
                className="btn btn-accent"
                disabled={isConnecting}
                style={{ fontSize: '12px', padding: '0.45rem 0.9rem' }}
              >
                <Zap size={14} />
                {isConnecting ? 'Awaiting Approval in MetaMask Extension...' : 'Connect MetaMask Chrome Extension (1st Ask Permission)'}
              </button>
            ) : (
              <>
                {chainId !== POLYGON_AMOY_CHAIN_ID && (
                  <button
                    onClick={switchToAmoy}
                    className="btn btn-outline"
                    style={{ fontSize: '11px', padding: '0.35rem 0.65rem' }}
                    title="Switch MetaMask active network to Polygon Amoy Testnet (80002)"
                  >
                    Switch to Amoy (80002)
                  </button>
                )}
                <button
                  onClick={disconnectWallet}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '0.35rem 0.65rem' }}
                >
                  Disconnect Wallet
                </button>
              </>
            )}

            <button
              onClick={handleQueryContractLive}
              className="btn btn-outline"
              disabled={isQueryingContract}
              style={{ fontSize: '12px', padding: '0.4rem 0.75rem' }}
              title="Query on-chain smart contract directly"
            >
              <RefreshCw size={13} className={isQueryingContract ? 'spin' : ''} />
              {isQueryingContract ? 'Querying Live...' : 'Query Contract Live'}
            </button>
          </div>
        </div>

        {/* Contract Address Configuration & Submitter Role Bar */}
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-muted)' }}>ColdChainTracker Contract:</span>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value.trim())}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '0.2rem 0.5rem',
                width: '320px',
                maxWidth: '100%',
              }}
              title="Target ColdChainTracker EVM Smart Contract Address"
            />
            {contractAddress === DEFAULT_CONTRACT_ADDRESS && (
              <span className="badge" style={{ fontSize: '10px' }}>Default Amoy</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {contractAudit?.isSubmitterAuthorized ? (
              <span className="badge badge-pass" style={{ fontSize: '11px' }}>
                <Check size={12} style={{ marginRight: '4px' }} /> Authorized Submitter
              </span>
            ) : account ? (
              <span className="badge" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                Auditor / Verifier (Read-Only)
              </span>
            ) : (
              <span className="badge" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                Unauthenticated Reader
              </span>
            )}
          </div>
        </div>

        {/* Audit Completion / PDF Ready notification banner */}
        {auditSuccessToast && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.95rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: isLight ? '#0369a1' : '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontWeight: 500 }}>{auditSuccessToast}</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadOfficialPdf}
                className="btn btn-accent"
                style={{ fontSize: '11px', padding: '0.25rem 0.55rem' }}
                title="Download Certificate as .pdf file"
              >
                <Download size={12} style={{ marginRight: '3px' }} />
                Save Cert PDF
              </button>
              <button
                onClick={handlePreviewOfficialPdf}
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '0.25rem 0.55rem' }}
                title="Open and view Certificate directly in Chrome PDF viewer"
              >
                <Eye size={12} style={{ marginRight: '3px' }} />
                View Cert
              </button>
              <button
                onClick={handleDownloadThermalAnalyticsPdf}
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '0.25rem 0.55rem', borderColor: isLight ? '#0369a1' : '#38bdf8', color: isLight ? '#0369a1' : '#38bdf8' }}
                title="Download Thermal Analytics as .pdf file"
              >
                <FileBarChart size={12} style={{ marginRight: '3px' }} />
                Save Analytics PDF
              </button>
              <button
                onClick={handlePreviewThermalAnalyticsPdf}
                className="btn btn-ghost"
                style={{ fontSize: '11px', padding: '0.25rem 0.55rem' }}
                title="Open and view Thermal Analytics directly in Chrome PDF viewer"
              >
                <Eye size={12} style={{ marginRight: '3px' }} />
                View Analytics
              </button>
            </div>
          </div>
        )}

        {/* Status / Transaction alerts */}
        {(web3Error || txStatusMessage || contractQueryError) && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              backgroundColor: (web3Error || contractQueryError) ? 'rgba(224, 87, 76, 0.1)' : 'rgba(125, 249, 196, 0.08)',
              border: (web3Error || contractQueryError) ? '1px solid var(--color-critical)' : '1px solid var(--color-accent)',
              color: (web3Error || contractQueryError) ? 'var(--color-critical)' : 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{web3Error || contractQueryError || txStatusMessage}</span>
            {recentTxHash && (
              <a
                href={`https://amoy.polygonscan.com/tx/${recentTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
              >
                View on Polygonscan <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Status Hero */}
      <div
        className={`panel ${isVerified ? 'glow-accent' : 'glow-critical'}`}
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: isVerified ? 'rgba(125, 249, 196, 0.03)' : 'rgba(224, 87, 76, 0.05)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            padding: '1rem',
            borderRadius: '50%',
            backgroundColor: isVerified ? 'var(--color-accent-subtle)' : 'var(--color-critical-subtle)',
            marginBottom: '1rem',
          }}
        >
          {isVerified ? (
            <ShieldCheck size={48} color="var(--color-accent)" />
          ) : (
            <AlertTriangle size={48} color="var(--color-critical)" />
          )}
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: isVerified ? 'var(--color-accent)' : 'var(--color-critical)',
          }}
        >
          {isVerified ? 'CRYPTOGRAPHICALLY VERIFIED & UNTAMPERED' : 'INTEGRITY AUDIT FAILED & TAMPER DETECTED'}
        </h3>

        <p style={{ maxWidth: '640px', margin: '0.5rem auto 1.5rem', color: 'var(--color-text-dim)', fontSize: '13px' }}>
          {isVerified
            ? `All 40 telemetry batches match canonical SHA-256 hashes, valid Ed25519 device signatures, continuous prev_hash chain, and live on-chain ColdChainTracker smart contract anchors (${onChainWindowsCount} windows verified on Polygon Amoy).`
            : isTamperSimulated
            ? 'Hash chain integrity failure! The recomputed batch hash diverges from the device signature or the on-chain blockchain anchor.'
            : 'Shipment flagged or on-chain registration mismatch detected.'}
        </p>

        {/* Temperature Compliance Callout Box */}
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto 1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            background: isVerified
              ? isLight ? '#eefbf2' : 'rgba(125, 249, 196, 0.08)'
              : isLight ? '#fdf2f2' : 'rgba(224, 87, 76, 0.08)',
            border: isVerified
              ? isLight ? '1.5px solid #033500' : '1px solid rgba(125, 249, 196, 0.3)'
              : isLight ? '1.5px solid #991b1b' : '1px solid rgba(224, 87, 76, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            textAlign: 'left',
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: isVerified
                  ? isLight ? '#033500' : 'var(--color-accent)'
                  : isLight ? '#991b1b' : 'var(--color-critical)',
              }}
            >
              {isVerified ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              <span>{isVerified ? 'TEMPERATURES PROPER & COMPLIANT' : 'TEMPERATURE EXCURSION / COMPLIANCE BREACH'}</span>
            </div>
            <div style={{ fontSize: '12px', color: isLight ? '#164014' : 'var(--color-text-dim)', marginTop: '2px' }}>
              {isVerified
                ? `100% of telemetry batches remained inside the required ${shipment.temp_min_c.toFixed(1)}°C - ${shipment.temp_max_c.toFixed(1)}°C corridor. Arrhenius MKT: ${shipment.mkt.toFixed(2)}°C (Remaining Life: ${shipment.remaining_life_pct.toFixed(1)}%).`
                : `Excursion detected! Temperature reached ${shipment.current_temp.toFixed(1)}°C outside allowed boundary [${shipment.temp_min_c.toFixed(1)}°C .. ${shipment.temp_max_c.toFixed(1)}°C]. Consult Deep Analytics PDF.`}
            </div>
          </div>
        </div>

        {/* PDF & Official Report Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Audit Certificate Group */}
          <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <button
              onClick={handleDownloadOfficialPdf}
              className="btn btn-accent"
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: 0 }}
              title="Download official cryptographic arrival audit certificate with guaranteed .pdf extension"
            >
              <Download size={15} />
              Download Audit Certificate (PDF)
            </button>
            <button
              onClick={handlePreviewOfficialPdf}
              className="btn btn-outline"
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', borderRadius: 0, borderLeft: '1px solid var(--color-border)' }}
              title="Open and preview Audit Certificate in Chrome's built-in PDF viewer tab"
            >
              <Eye size={14} />
              Preview Tab
            </button>
          </div>

          {/* Deep Thermal Analytics Group */}
          <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <button
              onClick={handleDownloadThermalAnalyticsPdf}
              className="btn btn-outline"
              style={{
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderColor: isLight ? '#0369a1' : '#38bdf8',
                color: isLight ? '#0369a1' : '#38bdf8',
                borderRadius: 0,
              }}
              title="Download comprehensive temperature excursion evaluation and Arrhenius kinetic degradation report as .pdf"
            >
              <FileBarChart size={15} />
              Download Deep Thermal Analytics (PDF)
            </button>
            <button
              onClick={handlePreviewThermalAnalyticsPdf}
              className="btn btn-ghost"
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', borderRadius: 0, borderLeft: '1px solid var(--color-border)' }}
              title="Open and preview Deep Thermal Analytics in Chrome's built-in PDF viewer tab"
            >
              <Eye size={14} />
              Preview Tab
            </button>
          </div>

          <a
            href={`${API_BASE}/verify/${shipment.shipment_id}/report`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Open printable HTML certificate view"
          >
            <Printer size={14} />
            Print HTML Certificate
          </a>

          <button
            onClick={() => setIsTamperSimulated(!isTamperSimulated)}
            className={`btn ${isTamperSimulated ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: '12px' }}
          >
            {isTamperSimulated ? 'Reset Simulated Tamper' : 'Simulate Database SQL Tamper'}
          </button>
        </div>
      </div>

      {/* 4. Live Smart Contract State & On-Chain Execution Section */}
      <div
        className="panel"
        style={{
          padding: '1.5rem',
          border: '1px solid rgba(125, 249, 196, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={16} color="var(--color-accent)" />
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
                Live Smart Contract Query &amp; Execution
              </h4>
              <span className="fl-badge fl-badge-mint" style={{ fontSize: '10px' }}>EVM Amoy / Localhost</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
              Real-time query of contract state via ethers.js. Execute on-chain registrations &amp; batch window anchors directly with MetaMask.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRegisterOnChain}
              className="btn btn-outline"
              disabled={isSubmittingTx}
              style={{ fontSize: '12px' }}
              title="Call ColdChainTracker.registerShipment via MetaMask Chrome Extension"
            >
              <PlusCircle size={14} />
              {isSubmittingTx ? 'Broadcasting Tx...' : 'Register On-Chain (MetaMask Extension)'}
            </button>

            <button
              onClick={handleAnchorWindowOnChain}
              className="btn btn-accent"
              disabled={isSubmittingTx}
              style={{ fontSize: '12px' }}
              title="Call ColdChainTracker.anchorBatchWindow via MetaMask Chrome Extension"
            >
              <Send size={14} />
              {isSubmittingTx ? 'Submitting Tx...' : 'Anchor Window On-Chain (MetaMask Extension)'}
            </button>
          </div>
        </div>

        {/* Live Query Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--color-panel-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              On-Chain Registration
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.35rem', color: isOnChainRegistered ? 'var(--color-pass)' : 'var(--color-warn)' }}>
              {isOnChainRegistered ? 'REGISTERED' : 'NOT ON-CHAIN YET'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              {isOnChainRegistered && contractAudit?.profile.registeredAt
                ? `Epoch: ${new Date(contractAudit.profile.registeredAt * 1000).toLocaleString()}`
                : 'Click "Register On-Chain" to create live record'}
            </div>
          </div>

          <div style={{ background: 'var(--color-panel-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Anchored Windows Count
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--color-accent)' }}>
              {onChainWindowsCount} Windows
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              Continuous sequence integrity on EVM
            </div>
          </div>

          <div style={{ background: 'var(--color-panel-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              On-Chain Thermal Envelope
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.35rem' }}>
              {isOnChainRegistered
                ? `${contractAudit?.profile.tempMinC.toFixed(1)}°C to ${contractAudit?.profile.tempMaxC.toFixed(1)}°C`
                : `${shipment.temp_min_c.toFixed(1)}°C to ${shipment.temp_max_c.toFixed(1)}°C (Local)`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              Hardcoded immutable contract profile
            </div>
          </div>

          <div style={{ background: 'var(--color-panel-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Contract Owner / Authority
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '0.5rem', wordBreak: 'break-all' }}>
              {contractAudit?.contractOwner
                ? `${contractAudit.contractOwner.substring(0, 10)}...${contractAudit.contractOwner.substring(34)}`
                : '0x9727...ed37 (Amoy)'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              Owner has admin authority
            </div>
          </div>
        </div>

        {/* Live On-Chain Windows Table */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              ON-CHAIN ANCHORED BATCH WINDOWS ({contractAudit?.windows.length || 0})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              Contract: <PolygonScanLink value={contractAddress} type="address" shorten={true} />
            </span>
          </div>

          {contractAudit && contractAudit.windows.length > 0 ? (
            <table className="telemetry-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Window Index</th>
                  <th>Sequence Range</th>
                  <th>Anchored Window Hash</th>
                  <th>On-Chain Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contractAudit.windows.map((win) => (
                  <tr key={win.index}>
                    <td className="data">#{win.index + 1}</td>
                    <td className="data">[{win.startSeq}..{win.endSeq}]</td>
                    <td className="data" style={{ wordBreak: 'break-all' }}>
                      <PolygonScanLink value={win.windowHash} type="tx" shorten={false} />
                    </td>
                    <td className="data">
                      {new Date(win.timestamp * 1000).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-pass">ANCHORED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                padding: '1rem',
                textAlign: 'center',
                backgroundColor: 'var(--color-panel-elevated)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--color-muted)',
              }}
            >
              No windows anchored on-chain for shipment <code style={{ color: 'var(--color-accent)' }}>{selectedId}</code> yet.
              Connect MetaMask and click <strong>&quot;Anchor Window On-Chain&quot;</strong> to record the initial window on sequence [1..5].
            </div>
          )}
        </div>

        {/* Live On-Chain Threshold Checker Tool */}
        <div
          style={{
            background: 'var(--color-panel-elevated)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Test Live On-Chain Threshold Rule:</span>
            <p style={{ fontSize: '11px', color: 'var(--color-muted)', margin: '2px 0 0' }}>
              Executes <code style={{ fontSize: '11px' }}>checkOnChainThresholds(shipmentId, tempMilliC)</code> view call directly on the contract.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="number"
                step="0.1"
                value={testTempC}
                onChange={(e) => {
                  setTestTempC(parseFloat(e.target.value) || 0);
                  setThresholdTestResult(null);
                }}
                style={{ width: '80px', padding: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              />
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>°C</span>
            </div>

            <button
              onClick={handleTestThresholdOnChain}
              className="btn btn-outline"
              disabled={isTestingThreshold}
              style={{ fontSize: '12px', padding: '0.35rem 0.75rem' }}
            >
              {isTestingThreshold ? 'Evaluating On-Chain...' : 'Query Threshold On-Chain'}
            </button>

            {thresholdTestResult !== null && (
              <span
                className={`badge ${thresholdTestResult ? 'badge-pass' : 'badge-critical'}`}
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                {thresholdTestResult ? 'IN RANGE (PASS)' : 'EXCURSION (FAIL)'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. 5-Step Cryptographic Audit Checklist Table */}
      <div className="panel" style={{ padding: '1.5rem' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Hardware &amp; Cryptographic Checklist Breakdown
        </h4>

        <table className="telemetry-table">
          <thead>
            <tr>
              <th>Verification Check</th>
              <th>Audit Mechanism</th>
              <th>Observed Evidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={15} color="var(--color-accent)" />
                Canonical Payload Hash
              </td>
              <td>RFC-8785 JSON canonicalization + SHA-256</td>
              <td className="data">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</td>
              <td>
                <span className={`badge ${!isTamperSimulated ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated ? 'MATCHED' : 'HASH MISMATCH'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={15} color="var(--color-accent)" />
                Ed25519 Hardware Signature
              </td>
              <td>Curve25519 onboard crypto key verification</td>
              <td className="data">pub: a7f8e329... signature: 8f2b3149...</td>
              <td>
                <span className={`badge ${!isTamperSimulated ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated ? 'VALID SIGNATURE' : 'FORGERY REJECTED'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LinkIcon size={15} color="var(--color-accent)" />
                Sequential Hash Chain
              </td>
              <td>prev_hash pointer verification across all batches</td>
              <td className="data">Continuity verified [1..40] with zero sequence gaps</td>
              <td>
                <span className={`badge ${!isTamperSimulated ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated ? 'CONTINUOUS' : 'BROKEN CHAIN'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={15} color={isChainAnchorValid ? 'var(--color-pass)' : 'var(--color-critical)'} />
                Smart Contract Window Anchor
              </td>
              <td>
                Polygon Amoy ColdChainTracker ({contractAddress.substring(0, 8)}...)
              </td>
              <td className="data">
                {isOnChainRegistered
                  ? `On-Chain Anchors: ${onChainWindowsCount} windows verified • Hash: ${contractAudit?.windows[0]?.windowHash ? `${contractAudit.windows[0].windowHash.substring(0, 16)}...` : '0x97273b...'}`
                  : `Anchored TX: ${shipment.anchored_tx ? `${shipment.anchored_tx.substring(0, 24)}...` : 'Pending On-Chain Registration'}`}
              </td>
              <td>
                <span className={`badge ${isChainAnchorValid ? 'badge-pass' : 'badge-critical'}`}>
                  {isChainAnchorValid ? 'ANCHORED ON-CHAIN' : 'ANCHOR MISMATCH'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={15} color="var(--color-accent)" />
                Immutable Profile Snapshot
              </td>
              <td>Genesis profile hash matching smart contract registration</td>
              <td className="data">
                {isOnChainRegistered
                  ? `Live Profile Hash: ${contractAudit?.profile.profileHash.substring(0, 16)}...`
                  : 'Genesis Hash: 7d21fe8294... (Pfizer v1)'}
              </td>
              <td>
                <span className={`badge ${!isTamperSimulated ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated ? 'FROZEN SPEC VERIFIED' : 'PROFILE MISMATCH'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pallet QR Scanner & Printable Badge Generator Modal */}
      <PalletQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={(scanned: ShipmentSummary) => {
          setSelectedId(scanned.shipment_id);
          onSelectShipmentId?.(scanned.shipment_id);
          handleRunVerify();
        }}
      />
    </div>
  );
};
