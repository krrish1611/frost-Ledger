import { useState } from 'react';
import { AtmosphereCanvas } from './components/AtmosphereCanvas';
import { Navbar, ActiveTab, UserRole } from './components/Navbar';
import { ShipmentDetailView } from './components/ShipmentDetailView';
import { ArrivalVerificationView } from './components/ArrivalVerificationView';
import { AiRiskIntelligenceView } from './components/AiRiskIntelligenceView';
import { AdminManagementView } from './components/AdminManagementView';
import { ShipmentSummary, MOCK_SHIPMENTS } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('shipments');
  const [userRole, setUserRole] = useState<UserRole>('operator');
  const [selectedShipment, setSelectedShipment] = useState<ShipmentSummary>(MOCK_SHIPMENTS[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--fl-bg-primary)', color: 'var(--fl-text)' }}>
      {/* Background Plasma Canvas */}
      <AtmosphereCanvas />

      {/* Main Layout Container */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentRole={userRole}
          onRoleChange={(r: UserRole) => {
            setUserRole(r);
            showToast(`Switched active role to ${r.toUpperCase()}`);
          }}
        />

        {/* Dynamic View Content */}
        <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px', flex: 1 }}>
          {activeTab === 'shipments' && <ShipmentDetailView />}

          {activeTab === 'verify' && <ArrivalVerificationView />}

          {activeTab === 'ai-intelligence' && (
            <AiRiskIntelligenceView
              currentShipment={selectedShipment}
              onSelectShipment={(s: ShipmentSummary) => setSelectedShipment(s)}
            />
          )}

          {activeTab === 'admin' && <AdminManagementView />}
        </main>

        {/* Global Footer */}
        <footer
          style={{
            borderTop: '1px solid var(--fl-hairline)',
            padding: '16px 24px',
            fontSize: '12px',
            color: 'var(--fl-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(10, 10, 11, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--fl-text)' }}>FrostLedger</span>
            <span>· Cold Chain Integrity &amp; Tamper Detection System v3.1</span>
            <span style={{ color: 'var(--fl-mint)', fontFamily: 'var(--fl-font-mono)' }}>[STAGE 8 COMPLETED]</span>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>Polygon Amoy: 0x9727...ed37</span>
            <span>PostgreSQL Immutable Triggers</span>
            <span className="fl-badge fl-badge-ai">AI Advisory Layer Active</span>
          </div>
        </footer>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--fl-bg-secondary)',
            border: '1px solid var(--fl-mint)',
            color: 'var(--fl-mint)',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(125, 249, 196, 0.2)',
            zIndex: 9999,
            fontSize: '13px',
            fontFamily: 'var(--fl-font-mono)',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
