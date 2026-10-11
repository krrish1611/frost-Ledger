import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabase';
import { AtmosphereCanvas } from './components/AtmosphereCanvas';
import { Navbar, ActiveTab, UserRole } from './components/Navbar';
import { ShipmentDetailView } from './components/ShipmentDetailView';
import { ArrivalVerificationView } from './components/ArrivalVerificationView';
import { AiRiskIntelligenceView } from './components/AiRiskIntelligenceView';
import { AdminManagementView } from './components/AdminManagementView';
import { LandingView } from './components/landing/LandingView';
import { ShipmentSummary, MOCK_SHIPMENTS, fetchLiveShipments } from './services/api';
import { useTheme } from './context/ThemeContext';
import { CommandPalette } from './components/CommandPalette';
import { ExcursionSimulatorModal } from './components/ExcursionSimulatorModal';
import { OnChainVerificationModal } from './components/OnChainVerificationModal';
import { PalletQrScannerModal } from './components/PalletQrScannerModal';
import { soundEffects } from './services/soundEffects';

export default function App() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');
  const [activeTab, setActiveTab] = useState<ActiveTab>('shipments');
  const [userRole, setUserRole] = useState<UserRole>('operator');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [shipmentsList, setShipmentsList] = useState<ShipmentSummary[]>(MOCK_SHIPMENTS);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentSummary>(MOCK_SHIPMENTS[0]);

  // Interactive Modals State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isOnChainModalOpen, setIsOnChainModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [activeVerificationHash, setActiveVerificationHash] = useState<string>('0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37');

  const showToast = (msg: string) => {
    toast(msg);
  };

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch and poll live shipments from backend API
  useEffect(() => {
    let mounted = true;
    const loadShipments = async () => {
      try {
        const live = await fetchLiveShipments();
        if (mounted && live && live.length > 0) {
          setShipmentsList(live);
          setSelectedShipment((prev) => live.find((s) => s.shipment_id === prev.shipment_id) || live[0]);
        }
      } catch {
        // Fallback to existing mock shipments
      }
    };
    loadShipments();
    const interval = setInterval(loadShipments, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setCurrentUser(u);
      if (u) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single()
          .then(({ data }) => {
            if (data?.role) {
              setUserRole(data.role as UserRole);
            }
          });
      }
    });

    // 2. Real-time Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setCurrentUser(u);
      if (u) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single()
          .then(({ data }) => {
            if (data?.role) {
              setUserRole(data.role as UserRole);
            }
          });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    showToast('Signed out from Supabase session');
  };

  if (viewMode === 'landing') {
    return (
      <LandingView
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onEnterDashboard={(role) => {
          if (role) setUserRole(role);
          setViewMode('dashboard');
          showToast(`Entered Console as ${role?.toUpperCase() || 'OPERATOR'}`);
        }}
      />
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Background Plasma Canvas */}
      <AtmosphereCanvas />

      {/* Main Layout Container */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentRole={userRole}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onRoleChange={(r: UserRole) => {
            setUserRole(r);
            showToast(`Switched active role to ${r.toUpperCase()}`);
          }}
          onReturnToLanding={() => setViewMode('landing')}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onOpenVerifier={() => setIsOnChainModalOpen(true)}
          onOpenQrScanner={() => setIsQrScannerOpen(true)}
        />

        {/* Dynamic View Content */}
        <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px', flex: 1 }}>
          {activeTab === 'shipments' && (
            <ShipmentDetailView
              selectedShipmentId={selectedShipment.shipment_id}
              currentUser={currentUser}
              currentRole={userRole}
              onSelectShipmentId={(id) => {
                const s = shipmentsList.find((x) => x.shipment_id === id) || MOCK_SHIPMENTS.find((x) => x.shipment_id === id);
                if (s) setSelectedShipment(s);
              }}
              onOpenSimulator={(id) => {
                const s = shipmentsList.find((x) => x.shipment_id === id) || MOCK_SHIPMENTS.find((x) => x.shipment_id === id);
                if (s) setSelectedShipment(s);
                setIsSimulatorOpen(true);
              }}
              onOpenVerifier={(hash) => {
                setActiveVerificationHash(hash);
                setIsOnChainModalOpen(true);
              }}
            />
          )}

          {activeTab === 'verify' && (
            <ArrivalVerificationView
              selectedShipmentId={selectedShipment.shipment_id}
              onSelectShipmentId={(id) => {
                const s = shipmentsList.find((x) => x.shipment_id === id) || MOCK_SHIPMENTS.find((x) => x.shipment_id === id);
                if (s) setSelectedShipment(s);
              }}
              isQrScannerOpen={isQrScannerOpen}
              onCloseQrScanner={() => setIsQrScannerOpen(false)}
            />
          )}

          {activeTab === 'ai-intelligence' && (
            <AiRiskIntelligenceView
              currentShipment={selectedShipment}
              onSelectShipment={(s: ShipmentSummary) => setSelectedShipment(s)}
            />
          )}

          {activeTab === 'admin' && (
            <AdminManagementView
              currentUser={currentUser}
              currentRole={userRole}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer
          style={{
            borderTop: isLight ? '1px solid #a7d3a2' : '1px solid var(--fl-hairline)',
            padding: '16px 24px',
            fontSize: '12px',
            color: isLight ? '#033500' : 'var(--fl-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 10, 11, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, color: isLight ? '#033500' : 'var(--fl-text)' }}>FrostLedger</span>
            <span>&bull; Cold Chain Integrity &amp; Tamper Detection System v3.1</span>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://amoy.polygonscan.com/address/0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37"
              target="_blank"
              rel="noreferrer"
              style={{
                color: isLight ? '#033500' : 'var(--color-accent)',
                textDecoration: 'none',
                fontFamily: 'var(--fl-font-mono)',
              }}
            >
              Polygon Amoy: 0x9727...ed37 ↗
            </a>
            <span>Supabase PostgreSQL + Trigger Layer</span>
            <span className="fl-badge fl-badge-ai">AI Advisory Layer Active</span>
          </div>
        </footer>
      </div>

      {/* Emil Kowalski Style Sonner Toaster */}
      <Toaster
        position="top-right"
        richColors
        theme={theme === 'light' ? 'light' : 'dark'}
        toastOptions={{
          style: {
            fontFamily: 'var(--fl-font-mono, monospace)',
            borderRadius: '8px',
            fontSize: '13px',
          },
        }}
      />

      {/* 1. Quick Command Palette (Cmd + K / Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onSelectShipment={(shipment) => {
          setSelectedShipment(shipment);
          setActiveTab('shipments');
          setIsCommandPaletteOpen(false);
          soundEffects.playClick();
        }}
        onOpenSimulator={() => {
          setIsSimulatorOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenVerifier={() => {
          setIsOnChainModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onNavigateHome={() => {
          setViewMode('landing');
          setIsCommandPaletteOpen(false);
        }}
      />

      {/* 2. Interactive Excursion Simulator Sandbox */}
      <ExcursionSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        shipmentId={selectedShipment.shipment_id}
        initialTemp={selectedShipment.current_temp}
        onExcursionSimulated={(temp, potency, tx) => {
          showToast(`Excursion simulated at ${temp.toFixed(1)}°C: Potency ${potency.toFixed(1)}%, batch anchored on Amoy (${tx.slice(0, 10)}...)`);
        }}
      />

      {/* 3. On-Chain Live PolygonScan Verifier Modal */}
      <OnChainVerificationModal
        isOpen={isOnChainModalOpen}
        onClose={() => setIsOnChainModalOpen(false)}
        shipmentId={selectedShipment.shipment_id}
        initialHash={activeVerificationHash || selectedShipment.anchored_tx || '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37'}
      />

      {/* 4. Pallet QR Scanner & Printable Badge Generator Modal (Fallback / Global) */}
      {isQrScannerOpen && activeTab !== 'verify' && (
        <PalletQrScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          onScanSuccess={(scanned) => {
            setSelectedShipment(scanned);
            setActiveTab('verify');
            setIsQrScannerOpen(false);
          }}
        />
      )}
    </div>
  );
}
