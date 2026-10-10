import React, { useState } from 'react';
import {
  DeviceFleetItem,
  ProductProfileItem,
  AuditLogItem,
  MOCK_DEVICES,
  MOCK_PROFILES,
  MOCK_AUDIT_LOGS,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

export const AdminManagementView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'profiles' | 'devices' | 'audit'>('profiles');
  const [devices, setDevices] = useState<DeviceFleetItem[]>(MOCK_DEVICES);
  const [profiles, setProfiles] = useState<ProductProfileItem[]>(MOCK_PROFILES);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileCargo, setNewProfileCargo] = useState<string>('vaccine');
  const [newProfileMin, setNewProfileMin] = useState<number>(2.0);
  const [newProfileMax, setNewProfileMax] = useState<number>(8.0);
  const [newProfileMaxExcursion, setNewProfileMaxExcursion] = useState<number>(7200);
  const [newProfileEa, setNewProfileEa] = useState<number>(83.14);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<DeviceFleetItem | null>(null);

  const handleRevokeDevice = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, status: 'revoked' } : d))
    );
    // Add audit entry
    const newLog: AuditLogItem = {
      log_id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'admin@pharma.corp',
      action: 'REVOKE_DEVICE_KEY',
      target_table: 'devices',
      record_id: deviceId,
      details: `Ed25519 signing authorization revoked by administrator. Inbound batches from this key will be rejected.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    setRevokeTarget(null);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName) return;

    // Simulate sha256 generation
    const mockHash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const newProf: ProductProfileItem = {
      profile_id: `profile-${newProfileName.toLowerCase().replace(/\s+/g, '-')}-v1`,
      name: newProfileName,
      cargo_type: newProfileCargo,
      temp_min_c: newProfileMin,
      temp_max_c: newProfileMax,
      max_excursion_seconds: newProfileMaxExcursion,
      mkt_activation_energy_kj: newProfileEa,
      version: 1,
      profile_hash: mockHash,
      created_at: new Date().toISOString(),
    };

    setProfiles((prev) => [...prev, newProf]);

    // Audit log
    const newLog: AuditLogItem = {
      log_id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'admin@pharma.corp',
      action: 'REGISTER_PROFILE',
      target_table: 'product_profiles',
      record_id: newProf.profile_id,
      details: `Registered immutable profile '${newProfileName}' v1 with hash ${mockHash.substring(0, 16)}...`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setShowProfileModal(false);
    setNewProfileName('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Navigation Tabs for Admin */}
      <div
        className="fl-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`fl-button ${isLight && activeTab === 'profiles' ? 'force-white' : ''}`}
            onClick={() => setActiveTab('profiles')}
            style={{
              background:
                activeTab === 'profiles'
                  ? isLight
                    ? '#033500'
                    : 'rgba(125, 249, 196, 0.15)'
                  : isLight
                  ? '#ffffff'
                  : 'transparent',
              borderColor: isLight ? '#033500' : activeTab === 'profiles' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color:
                activeTab === 'profiles'
                  ? isLight
                    ? '#ffffff'
                    : 'var(--fl-mint)'
                  : isLight
                  ? '#033500'
                  : 'var(--fl-muted)',
              fontWeight: activeTab === 'profiles' ? 600 : 500,
            }}
          >
            Digital Product Profiles ({profiles.length})
          </button>
          <button
            className={`fl-button ${isLight && activeTab === 'devices' ? 'force-white' : ''}`}
            onClick={() => setActiveTab('devices')}
            style={{
              background:
                activeTab === 'devices'
                  ? isLight
                    ? '#033500'
                    : 'rgba(125, 249, 196, 0.15)'
                  : isLight
                  ? '#ffffff'
                  : 'transparent',
              borderColor: isLight ? '#033500' : activeTab === 'devices' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color:
                activeTab === 'devices'
                  ? isLight
                    ? '#ffffff'
                    : 'var(--fl-mint)'
                  : isLight
                  ? '#033500'
                  : 'var(--fl-muted)',
              fontWeight: activeTab === 'devices' ? 600 : 500,
            }}
          >
            Ed25519 Fleet Devices ({devices.length})
          </button>
          <button
            className={`fl-button ${isLight && activeTab === 'audit' ? 'force-white' : ''}`}
            onClick={() => setActiveTab('audit')}
            style={{
              background:
                activeTab === 'audit'
                  ? isLight
                    ? '#033500'
                    : 'rgba(125, 249, 196, 0.15)'
                  : isLight
                  ? '#ffffff'
                  : 'transparent',
              borderColor: isLight ? '#033500' : activeTab === 'audit' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color:
                activeTab === 'audit'
                  ? isLight
                    ? '#ffffff'
                    : 'var(--fl-mint)'
                  : isLight
                  ? '#033500'
                  : 'var(--fl-muted)',
              fontWeight: activeTab === 'audit' ? 600 : 500,
            }}
          >
            Tamper-Proof Audit Log ({auditLogs.length})
          </button>
        </div>

        {activeTab === 'profiles' && (
          <button
            className={`fl-button ${isLight ? 'force-white' : ''}`}
            onClick={() => setShowProfileModal(true)}
            style={{
              background: isLight ? '#033500' : 'var(--fl-mint)',
              color: isLight ? '#ffffff' : '#0a0a0b',
              borderColor: isLight ? '#033500' : 'var(--fl-mint)',
              fontWeight: 600,
              boxShadow: isLight ? '0 2px 8px rgba(3, 53, 0, 0.25)' : undefined,
            }}
          >
            + Register New Profile Version
          </button>
        )}
      </div>

      {/* Tab 1: Product Profiles */}
      {activeTab === 'profiles' && (
        <div className="fl-card">
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: isLight ? '#033500' : 'var(--color-text)' }}>
              Immutable Product Quality Profiles
            </div>
            <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
              Cryptographically hashed temperature corridors, USP &lt;1160&gt; activation energies,
              and cumulative excursion limits.
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Profile ID & Name</th>
                  <th>Cargo Type</th>
                  <th>Valid Corridor</th>
                  <th>Max Excursion</th>
                  <th>Activation Energy (Ea)</th>
                  <th>Version</th>
                  <th>Profile Hash (SHA-256)</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.profile_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: isLight ? '#033500' : 'var(--fl-text)' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>{p.profile_id}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isLight ? '#d7edd5' : 'rgba(255, 255, 255, 0.05)',
                          color: isLight ? '#033500' : 'inherit',
                          border: isLight ? '1px solid #033500' : 'none',
                          fontWeight: 600,
                        }}
                      >
                        {p.cargo_type}
                      </span>
                    </td>
                    <td style={{ color: isLight ? '#033500' : 'var(--fl-mint)', fontWeight: 600 }}>
                      {p.temp_min_c.toFixed(1)}°C to {p.temp_max_c.toFixed(1)}°C
                    </td>
                    <td style={{ color: isLight ? '#033500' : 'inherit' }}>{(p.max_excursion_seconds / 60).toFixed(0)} mins</td>
                    <td style={{ color: isLight ? '#033500' : 'inherit' }}>{p.mkt_activation_energy_kj.toFixed(2)} kJ/mol</td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          background: isLight ? '#d7edd5' : 'rgba(125, 249, 196, 0.1)',
                          color: isLight ? '#033500' : 'var(--fl-mint)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          border: isLight ? '1px solid #033500' : 'none',
                          fontWeight: 600,
                        }}
                      >
                        v{p.version}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: isLight ? '#2d552b' : 'var(--fl-muted)',
                      }}
                    >
                      {p.profile_hash.substring(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Ed25519 Fleet Devices */}
      {activeTab === 'devices' && (
        <div className="fl-card">
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: isLight ? '#033500' : 'var(--color-text)' }}>
              Ed25519 IoT Device Fleet
            </div>
            <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
              Hardware cryptographic identity keys. Inbound telemetry batches are rejected if signed
              by a revoked device key.
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Device Identifier</th>
                  <th>Ed25519 Public Key</th>
                  <th>Firmware</th>
                  <th>Battery</th>
                  <th>Last Heartbeat</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.device_id}>
                    <td style={{ fontWeight: 600, color: isLight ? '#033500' : 'var(--fl-text)' }}>{d.device_id}</td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: isLight ? '#2d552b' : 'var(--fl-muted)',
                      }}
                    >
                      {d.public_key.substring(0, 24)}...
                    </td>
                    <td style={{ fontFamily: 'var(--fl-font-mono)', fontSize: '12px', color: isLight ? '#033500' : 'inherit' }}>
                      {d.firmware_version}
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            d.battery_pct > 50
                              ? isLight
                                ? '#033500'
                                : 'var(--fl-mint)'
                              : d.battery_pct > 20
                              ? isLight
                                ? '#8f7200'
                                : 'var(--fl-warning)'
                              : isLight
                              ? '#b21919'
                              : 'var(--fl-danger)',
                          fontFamily: 'var(--fl-font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        {d.battery_pct}%
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>{d.last_heartbeat}</td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'var(--fl-font-mono)',
                          fontWeight: 600,
                          background:
                            d.status === 'active'
                              ? isLight
                                ? '#d7edd5'
                                : 'rgba(125, 249, 196, 0.15)'
                              : isLight
                              ? '#fbe0e0'
                              : 'rgba(248, 113, 113, 0.15)',
                          color:
                            d.status === 'active'
                              ? isLight
                                ? '#033500'
                                : 'var(--fl-mint)'
                              : isLight
                              ? '#b21919'
                              : 'var(--fl-danger)',
                          border: `1px solid ${
                            d.status === 'active'
                              ? isLight
                                ? '#033500'
                                : 'rgba(125, 249, 196, 0.3)'
                              : isLight
                              ? '#b21919'
                              : 'rgba(248, 113, 113, 0.3)'
                          }`,
                        }}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {d.status === 'active' ? (
                        <button
                          className="fl-button"
                          onClick={() => setRevokeTarget(d)}
                          style={{
                            background: isLight ? '#fbe0e0' : 'rgba(248, 113, 113, 0.1)',
                            borderColor: isLight ? '#b21919' : 'rgba(248, 113, 113, 0.4)',
                            color: isLight ? '#b21919' : 'var(--fl-danger)',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Revoke Key
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>Revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Tamper-Proof Audit Log */}
      {activeTab === 'audit' && (
        <div className="fl-card">
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: isLight ? '#033500' : 'var(--color-text)' }}>
              PostgreSQL Immutable Audit Log
            </div>
            <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
              Trigger-enforced append-only record tracking all cryptographic verifications, blockchain
              anchors, profile revisions, and security events.
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target Table</th>
                  <th>Record ID</th>
                  <th>Cryptographic Evidence / Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.log_id}>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: isLight ? '#2d552b' : 'var(--fl-muted)',
                      }}
                    >
                      {l.timestamp}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '12px', color: isLight ? '#033500' : 'inherit' }}>{l.actor}</td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isLight ? '#d7edd5' : 'rgba(56, 189, 248, 0.15)',
                          color: isLight ? '#033500' : 'var(--fl-cyan)',
                          border: isLight ? '1px solid #033500' : 'none',
                          fontWeight: 600,
                        }}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--fl-font-mono)', fontSize: '12px', color: isLight ? '#033500' : 'inherit' }}>
                      {l.target_table}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: isLight ? '#2d552b' : 'var(--fl-muted)',
                      }}
                    >
                      {l.record_id}
                    </td>
                    <td style={{ fontSize: '12px', color: isLight ? '#033500' : 'var(--fl-text)', lineHeight: 1.4 }}>
                      {l.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokeTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="fl-card"
            style={{
              maxWidth: '460px',
              width: '90%',
              background: isLight ? '#ffffff' : undefined,
              border: '1.5px solid var(--fl-danger)',
              boxShadow: '0 8px 32px rgba(248, 113, 113, 0.25)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fl-danger)' }}>
              Confirm Device Key Revocation
            </div>
            <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', margin: '12px 0 16px', lineHeight: 1.5 }}>
              Are you sure you want to revoke signing authorization for device{' '}
              <strong style={{ color: isLight ? '#033500' : 'var(--fl-text)' }}>{revokeTarget.device_id}</strong>?
              <br />
              All subsequent inbound telemetry batches signed with this Ed25519 key will be
              permanently rejected by the cryptographic ingestion gateway.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="fl-button"
                onClick={() => setRevokeTarget(null)}
                style={isLight ? { background: '#ffffff', color: '#033500', borderColor: '#033500' } : undefined}
              >
                Cancel
              </button>
              <button
                className="fl-button force-white"
                onClick={() => handleRevokeDevice(revokeTarget.device_id)}
                style={{
                  background: 'var(--fl-danger)',
                  color: '#ffffff',
                  borderColor: 'var(--fl-danger)',
                  fontWeight: 600,
                }}
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Profile Modal */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleCreateProfile}
            className="fl-card"
            style={{
              maxWidth: '520px',
              width: '90%',
              background: isLight ? '#ffffff' : 'var(--fl-bg-primary)',
              border: isLight ? '1.5px solid #033500' : '1px solid var(--fl-mint)',
              boxShadow: isLight ? '0 12px 36px rgba(3, 53, 0, 0.2)' : '0 8px 32px rgba(125, 249, 196, 0.1)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: isLight ? '#033500' : 'var(--fl-mint)', marginBottom: '4px' }}>
              Register Immutable Product Profile
            </div>
            <div style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginBottom: '16px' }}>
              Profiles are cryptographically hashed and versioned. Once committed, thresholds cannot be
              tampered with.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Biotech Cell Therapy"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                    background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                    color: isLight ? '#033500' : 'var(--fl-text)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Cargo Type
                  </label>
                  <select
                    value={newProfileCargo}
                    onChange={(e) => setNewProfileCargo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                      background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                      color: isLight ? '#033500' : 'var(--fl-text)',
                    }}
                  >
                    <option value="vaccine">Vaccine</option>
                    <option value="biologics">Biologics</option>
                    <option value="produce">Produce</option>
                    <option value="blood">Blood Products</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Activation Energy (Ea kJ/mol)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProfileEa}
                    onChange={(e) => setNewProfileEa(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                      background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                      color: isLight ? '#033500' : 'var(--fl-text)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Min Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProfileMin}
                    onChange={(e) => setNewProfileMin(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                      background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                      color: isLight ? '#033500' : 'var(--fl-text)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Max Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProfileMax}
                    onChange={(e) => setNewProfileMax(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                      background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                      color: isLight ? '#033500' : 'var(--fl-text)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Max Cumulative Excursion (seconds)
                </label>
                <input
                  type="number"
                  value={newProfileMaxExcursion}
                  onChange={(e) => setNewProfileMaxExcursion(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                    background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                    color: isLight ? '#033500' : 'var(--fl-text)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="fl-button"
                onClick={() => setShowProfileModal(false)}
                style={isLight ? { background: '#ffffff', color: '#033500', borderColor: '#033500' } : undefined}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`fl-button ${isLight ? 'force-white' : ''}`}
                style={{
                  background: isLight ? '#033500' : 'var(--fl-mint)',
                  color: isLight ? '#ffffff' : '#0a0a0b',
                  borderColor: isLight ? '#033500' : 'var(--fl-mint)',
                  fontWeight: 600,
                  boxShadow: isLight ? '0 2px 8px rgba(3, 53, 0, 0.25)' : undefined,
                }}
              >
                Register &amp; Hash Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
