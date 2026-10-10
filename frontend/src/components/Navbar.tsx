import React from 'react';
import { Shield, Radio, Activity, Cpu, Layers } from 'lucide-react';

export type ActiveTab = 'shipments' | 'verify' | 'ai-intelligence' | 'admin';
export type UserRole = 'operator' | 'receiver' | 'auditor' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onReturnToLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  onReturnToLanding,
}) => {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'rgba(17, 17, 19, 0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Brand */}
        <div
          onClick={onReturnToLanding}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: onReturnToLanding ? 'pointer' : 'default' }}
          title={onReturnToLanding ? 'Return to Landing Page' : undefined}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--color-panel-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <Shield size={18} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              FROSTLEDGER
              <span className="status-dot status-dot-active" />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Cold Chain IoT &bull; Polygon Amoy &bull; AI Advisory
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => onTabChange('shipments')}
            className={`btn ${activeTab === 'shipments' ? 'btn-accent' : 'btn-ghost'}`}
            style={{ fontSize: '13px', padding: '0.45rem 0.85rem' }}
          >
            <Activity size={15} />
            Live Telemetry
          </button>

          <button
            onClick={() => onTabChange('verify')}
            className={`btn ${activeTab === 'verify' ? 'btn-accent' : 'btn-ghost'}`}
            style={{ fontSize: '13px', padding: '0.45rem 0.85rem' }}
          >
            <Shield size={15} />
            Arrival Verification
          </button>

          <button
            onClick={() => onTabChange('ai-intelligence')}
            className={`btn ${activeTab === 'ai-intelligence' ? 'btn-accent' : 'btn-ghost'}`}
            style={{ fontSize: '13px', padding: '0.45rem 0.85rem' }}
          >
            <Cpu size={15} />
            AI Risk &amp; Advisory
          </button>

          <button
            onClick={() => onTabChange('admin')}
            className={`btn ${activeTab === 'admin' ? 'btn-accent' : 'btn-ghost'}`}
            style={{ fontSize: '13px', padding: '0.45rem 0.85rem' }}
          >
            <Layers size={15} />
            Admin &amp; Audit Log
          </button>

          {onReturnToLanding && (
            <button
              onClick={onReturnToLanding}
              className="btn btn-ghost"
              style={{ fontSize: '13px', padding: '0.45rem 0.85rem', color: 'var(--color-accent)' }}
              title="Return to Public Landing Showcase"
            >
              &larr; Landing Showcase
            </button>
          )}
        </nav>

        {/* Role Switcher & System Telemetry Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            className="data"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-panel)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-muted)',
            }}
          >
            <Radio size={12} color="var(--color-pass)" />
            <span>AMOY: ANCHORED</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              ROLE:
            </span>
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              style={{
                padding: '0.3rem 0.5rem',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                backgroundColor: 'var(--color-panel-elevated)',
                borderColor: 'var(--color-border-hover)',
              }}
            >
              <option value="operator">Operator</option>
              <option value="receiver">Receiver</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
