import React from 'react';
import { Shield, Radio, Activity, Cpu, Layers, LogOut, User as UserIcon, Wallet } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useWeb3 } from '../context/Web3Context';

export type ActiveTab = 'shipments' | 'verify' | 'ai-intelligence' | 'admin';
export type UserRole = 'operator' | 'receiver' | 'auditor' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onReturnToLanding?: () => void;
  currentUser?: { email?: string; id?: string } | null;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  onReturnToLanding,
  currentUser,
  onSignOut,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { account, networkName, isConnecting, connectWallet, disconnectWallet } = useWeb3();

  return (
    <header
      style={{
        borderBottom: isLight ? '1px solid #a7d3a2' : '1px solid var(--color-border)',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 17, 19, 0.85)',
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
              backgroundColor: isLight ? '#ebf5eb' : 'var(--color-panel-elevated)',
              border: isLight ? '1.5px solid #033500' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? '#033500' : 'var(--color-accent)',
            }}
          >
            <Shield size={18} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: isLight ? '#033500' : 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              FROSTLEDGER
              <span className="status-dot status-dot-active" style={isLight ? { background: '#033500', boxShadow: '0 0 8px #033500' } : undefined} />
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
              style={{ fontSize: '13px', padding: '0.45rem 0.85rem', color: isLight ? '#033500' : 'var(--color-accent)' }}
              title="Return to Public Landing Showcase"
            >
              &larr; Landing Showcase
            </button>
          )}
        </nav>

        {/* Role Switcher, Theme Toggle, Supabase User & System Telemetry Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <ThemeToggle />

          {/* MetaMask Wallet Connection Status & Action */}
          {account ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: isLight ? 'rgba(3, 53, 0, 0.08)' : 'rgba(125, 249, 196, 0.08)',
                border: isLight ? '1.5px solid #033500' : '1px solid rgba(125, 249, 196, 0.35)',
                color: isLight ? '#033500' : 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title={`MetaMask Connected: ${account} (${networkName})`}
            >
              <Wallet size={12} />
              <span>{account.substring(0, 6)}...{account.substring(38)}</span>
              <button
                onClick={disconnectWallet}
                title="Disconnect MetaMask"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '10px',
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectWallet()}
              disabled={isConnecting}
              className="btn btn-outline"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Connect MetaMask Chrome / Browser Extension (permission prompt required)"
            >
              <Wallet size={12} />
              <span>{isConnecting ? 'Connecting...' : 'Connect MetaMask Extension'}</span>
            </button>
          )}

          <div
            className="data"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              background: isLight ? '#ffffff' : 'var(--color-panel)',
              border: isLight ? '1.5px solid #033500' : '1px solid var(--color-border)',
              color: isLight ? '#033500' : 'var(--color-muted)',
              fontWeight: isLight ? 600 : 400,
            }}
          >
            <Radio size={12} color={isLight ? '#033500' : 'var(--color-pass)'} />
            <span>AMOY: ANCHORED</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '11px', color: isLight ? '#033500' : 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
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
                backgroundColor: isLight ? '#ffffff' : 'var(--color-panel-elevated)',
                borderColor: isLight ? '#033500' : 'var(--color-border-hover)',
                color: isLight ? '#033500' : 'var(--color-text)',
                fontWeight: isLight ? 600 : 400,
              }}
            >
              <option value="operator">Operator</option>
              <option value="receiver">Receiver</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Supabase Authenticated User Status or Guest Pill */}
          {currentUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: isLight ? 'rgba(3, 53, 0, 0.08)' : 'rgba(125, 249, 196, 0.08)',
                border: isLight ? '1.5px solid #033500' : '1px solid rgba(125, 249, 196, 0.25)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: isLight ? '#033500' : 'var(--color-accent)',
                fontWeight: isLight ? 600 : 400,
              }}
            >
              <UserIcon size={12} />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentUser.email}>
                {currentUser.email}
              </span>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title="Sign out from Supabase session"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-panel)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-muted)',
              }}
            >
              DEMO / GUEST
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
