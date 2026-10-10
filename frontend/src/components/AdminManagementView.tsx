import React, { useState } from 'react';
import {
  DeviceFleetItem,
  ProductProfileItem,
  AuditLogItem,
  MOCK_DEVICES,
  MOCK_PROFILES,
  MOCK_AUDIT_LOGS,
} from '../services/api';

export const AdminManagementView: React.FC = () => {
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="fl-button"
            onClick={() => setActiveTab('profiles')}
            style={{
              background: activeTab === 'profiles' ? 'rgba(125, 249, 196, 0.15)' : 'transparent',
              borderColor: activeTab === 'profiles' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color: activeTab === 'profiles' ? 'var(--fl-mint)' : 'var(--fl-muted)',
            }}
          >
            Digital Product Profiles ({profiles.length})
          </button>
          <button
            className="fl-button"
            onClick={() => setActiveTab('devices')}
            style={{
              background: activeTab === 'devices' ? 'rgba(125, 249, 196, 0.15)' : 'transparent',
              borderColor: activeTab === 'devices' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color: activeTab === 'devices' ? 'var(--fl-mint)' : 'var(--fl-muted)',
            }}
          >
            Ed25519 Fleet Devices ({devices.length})
          </button>
          <button
            className="fl-button"
            onClick={() => setActiveTab('audit')}
            style={{
              background: activeTab === 'audit' ? 'rgba(125, 249, 196, 0.15)' : 'transparent',
              borderColor: activeTab === 'audit' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color: activeTab === 'audit' ? 'var(--fl-mint)' : 'var(--fl-muted)',
            }}
          >
            Tamper-Proof Audit Log ({auditLogs.length})
          </button>
        </div>

        {activeTab === 'profiles' && (
          <button
            className="fl-button"
            onClick={() => setShowProfileModal(true)}
            style={{
              background: 'var(--fl-mint)',
              color: 'var(--fl-bg-primary)',
              borderColor: 'var(--fl-mint)',
              fontWeight: 600,
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
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Immutable Product Quality Profiles</div>
            <div style={{ fontSize: '13px', color: 'var(--fl-muted)', marginTop: '2px' }}>
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
                      <div style={{ fontWeight: 600, color: 'var(--fl-text)' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--fl-muted)' }}>{p.profile_id}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {p.cargo_type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--fl-mint)', fontWeight: 600 }}>
                      {p.temp_min_c.toFixed(1)}°C to {p.temp_max_c.toFixed(1)}°C
                    </td>
                    <td>{(p.max_excursion_seconds / 60).toFixed(0)} mins</td>
                    <td>{p.mkt_activation_energy_kj.toFixed(2)} kJ/mol</td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          background: 'rgba(125, 249, 196, 0.1)',
                          color: 'var(--fl-mint)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        v{p.version}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: 'var(--fl-muted)',
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
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Ed25519 IoT Device Fleet</div>
            <div style={{ fontSize: '13px', color: 'var(--fl-muted)', marginTop: '2px' }}>
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
                    <td style={{ fontWeight: 600, color: 'var(--fl-text)' }}>{d.device_id}</td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: 'var(--fl-muted)',
                      }}
                    >
                      {d.public_key.substring(0, 24)}...
                    </td>
                    <td style={{ fontFamily: 'var(--fl-font-mono)', fontSize: '12px' }}>
                      {d.firmware_version}
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            d.battery_pct > 50
                              ? 'var(--fl-mint)'
                              : d.battery_pct > 20
                              ? 'var(--fl-warning)'
                              : 'var(--fl-danger)',
                          fontFamily: 'var(--fl-font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        {d.battery_pct}%
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--fl-muted)' }}>{d.last_heartbeat}</td>
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
                              ? 'rgba(125, 249, 196, 0.15)'
                              : 'rgba(248, 113, 113, 0.15)',
                          color: d.status === 'active' ? 'var(--fl-mint)' : 'var(--fl-danger)',
                          border: `1px solid ${
                            d.status === 'active' ? 'rgba(125, 249, 196, 0.3)' : 'rgba(248, 113, 113, 0.3)'
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
                            background: 'rgba(248, 113, 113, 0.1)',
                            borderColor: 'rgba(248, 113, 113, 0.4)',
                            color: 'var(--fl-danger)',
                            padding: '4px 10px',
                            fontSize: '11px',
                          }}
                        >
                          Revoke Key
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--fl-muted)' }}>Revoked</span>
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
            <div style={{ fontSize: '16px', fontWeight: 600 }}>PostgreSQL Immutable Audit Log</div>
            <div style={{ fontSize: '13px', color: 'var(--fl-muted)', marginTop: '2px' }}>
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
                        color: 'var(--fl-muted)',
                      }}
                    >
                      {l.timestamp}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '12px' }}>{l.actor}</td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: 'var(--fl-cyan)',
                        }}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--fl-font-mono)', fontSize: '12px' }}>
                      {l.target_table}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: 'var(--fl-muted)',
                      }}
                    >
                      {l.record_id}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--fl-text)', lineHeight: 1.4 }}>
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
            background: 'rgba(0, 0, 0, 0.8)',
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
              border: '1px solid var(--fl-danger)',
              boxShadow: '0 8px 32px rgba(248, 113, 113, 0.2)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fl-danger)' }}>
              Confirm Device Key Revocation
            </div>
            <div style={{ fontSize: '13px', color: 'var(--fl-muted)', margin: '12px 0 16px', lineHeight: 1.5 }}>
              Are you sure you want to revoke signing authorization for device{' '}
              <strong style={{ color: 'var(--fl-text)' }}>{revokeTarget.device_id}</strong>?
              <br />
              All subsequent inbound telemetry batches signed with this Ed25519 key will be
              permanently rejected by the cryptographic ingestion gateway.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="fl-button" onClick={() => setRevokeTarget(null)}>
                Cancel
              </button>
              <button
                className="fl-button"
                onClick={() => handleRevokeDevice(revokeTarget.device_id)}
                style={{
                  background: 'var(--fl-danger)',
                  color: '#fff',
                  borderColor: 'var(--fl-danger)',
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
            background: 'rgba(0, 0, 0, 0.8)',
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
              border: '1px solid var(--fl-mint)',
              boxShadow: '0 8px 32px rgba(125, 249, 196, 0.1)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fl-mint)', marginBottom: '4px' }}>
              Register Immutable Product Profile
            </div>
            <div style={{ fontSize: '12px', color: 'var(--fl-muted)', marginBottom: '16px' }}>
              Profiles are cryptographically hashed and versioned. Once committed, thresholds cannot be
              tampered with.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
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
                    border: '1px solid var(--fl-hairline)',
                    background: 'var(--fl-bg-secondary)',
                    color: 'var(--fl-text)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
                    Cargo Type
                  </label>
                  <select
                    value={newProfileCargo}
                    onChange={(e) => setNewProfileCargo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--fl-hairline)',
                      background: 'var(--fl-bg-secondary)',
                      color: 'var(--fl-text)',
                    }}
                  >
                    <option value="vaccine">Vaccine</option>
                    <option value="biologics">Biologics</option>
                    <option value="produce">Produce</option>
                    <option value="blood">Blood Products</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
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
                      border: '1px solid var(--fl-hairline)',
                      background: 'var(--fl-bg-secondary)',
                      color: 'var(--fl-text)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
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
                      border: '1px solid var(--fl-hairline)',
                      background: 'var(--fl-bg-secondary)',
                      color: 'var(--fl-text)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
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
                      border: '1px solid var(--fl-hairline)',
                      background: 'var(--fl-bg-secondary)',
                      color: 'var(--fl-text)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--fl-muted)', display: 'block', marginBottom: '4px' }}>
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
                    border: '1px solid var(--fl-hairline)',
                    background: 'var(--fl-bg-secondary)',
                    color: 'var(--fl-text)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="fl-button" onClick={() => setShowProfileModal(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="fl-button"
                style={{
                  background: 'var(--fl-mint)',
                  color: 'var(--fl-bg-primary)',
                  borderColor: 'var(--fl-mint)',
                  fontWeight: 600,
                }}
              >
                Register & Hash Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
