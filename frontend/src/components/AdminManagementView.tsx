import React, { useState, useEffect } from 'react';
import {
  DeviceFleetItem,
  ProductProfileItem,
  AuditLogItem,
  MOCK_DEVICES,
  MOCK_PROFILES,
  MOCK_AUDIT_LOGS,
  fetchDashboardState,
  revokeDeviceKeyApi,
  createProfileApi,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { PolygonScanLink } from './PolygonScanLink';
import {
  alertService,
  DatabaseAlert,
  DatabaseAuditLog,
  UserProfileItem,
} from '../services/alertService';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

interface AdminManagementViewProps {
  currentUser?: { email?: string; id?: string } | null;
  currentRole?: string;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  currentUser,
  currentRole = 'admin',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'alerts' | 'users' | 'profiles' | 'devices' | 'audit'>('alerts');
  const [devices, setDevices] = useState<DeviceFleetItem[]>(MOCK_DEVICES);
  const [profiles, setProfiles] = useState<ProductProfileItem[]>(MOCK_PROFILES);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);

  // Live Alerts State
  const [alerts, setAlerts] = useState<DatabaseAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(false);
  const [resolveTargetAlert, setResolveTargetAlert] = useState<DatabaseAlert | null>(null);
  const [adminResolutionNotes, setAdminResolutionNotes] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState<boolean>(false);

  // Live Users & Activity Stream State
  const [userProfiles, setUserProfiles] = useState<UserProfileItem[]>([]);
  const [realtimeAuditLogs, setRealtimeAuditLogs] = useState<DatabaseAuditLog[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

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

  const fetchAllAlerts = async () => {
    setIsLoadingAlerts(true);
    const data = await alertService.fetchAlerts();
    setAlerts(data);
    setIsLoadingAlerts(false);
  };

  const fetchUsersAndAuditTrail = async () => {
    setIsLoadingUsers(true);
    const [profilesData, auditsData] = await Promise.all([
      alertService.fetchUserProfiles(),
      alertService.fetchAuditLogs(),
    ]);
    setUserProfiles(profilesData);
    setRealtimeAuditLogs(auditsData);
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    fetchAllAlerts();
    fetchUsersAndAuditTrail();

    const onAlertEvent = () => {
      fetchAllAlerts();
      fetchUsersAndAuditTrail();
    };

    window.addEventListener('frostledger:alert_acknowledged', onAlertEvent);
    window.addEventListener('frostledger:alert_resolved', onAlertEvent);

    const timer = setInterval(() => {
      fetchAllAlerts();
      fetchUsersAndAuditTrail();
    }, 12000);

    return () => {
      window.removeEventListener('frostledger:alert_acknowledged', onAlertEvent);
      window.removeEventListener('frostledger:alert_resolved', onAlertEvent);
      clearInterval(timer);
    };
  }, []);

  const handleRevokeDevice = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, status: 'revoked' } : d))
    );
    const newLog: AuditLogItem = {
      log_id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: currentUser?.email || 'admin@frostledger.io',
      action: 'REVOKE_DEVICE_KEY',
      target_table: 'devices',
      record_id: deviceId,
      details: `Ed25519 signing authorization revoked by administrator. Inbound batches from this key will be rejected.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    setRevokeTarget(null);
    await loadAdminState();
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName) return;

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
      actor: 'admin@coldchain.test',
    });

    setProfiles((prev) => [...prev, newProf]);

    const newLog: AuditLogItem = {
      log_id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: currentUser?.email || 'admin@frostledger.io',
      action: 'REGISTER_PROFILE',
      target_table: 'product_profiles',
      record_id: newProf.profile_id,
      details: `Registered immutable profile '${newProfileName}' v1 with hash ${mockHash.substring(0, 16)}...`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setShowProfileModal(false);
    setNewProfileName('');
  };

  const handleResolveAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTargetAlert) return;
    setIsSubmittingResolution(true);
    soundEffects.playClick();
    const success = await alertService.resolveAlert({
      alertId: resolveTargetAlert.alert_id,
      adminEmail: currentUser?.email || 'admin@frostledger.io',
      adminResolutionNote: adminResolutionNotes,
    });
    if (success) {
      setResolveTargetAlert(null);
      setAdminResolutionNotes('');
      fetchAllAlerts();
      fetchUsersAndAuditTrail();
    }
    setIsSubmittingResolution(false);
  };

  const handleRoleChange = async (userId: string, newRole: 'operator' | 'admin' | 'receiver' | 'auditor') => {
    soundEffects.playClick();
    const ok = await alertService.updateUserRole(userId, newRole);
    if (ok) {
      setUserProfiles((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
  };

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const acknowledgedAlertsCount = alerts.filter((a) => a.status === 'ACKNOWLEDGED').length;
  const resolvedAlertsCount = alerts.filter((a) => a.status === 'RESOLVED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Admin Executive Header */}
      <div
        className="fl-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderLeft: '4px solid var(--color-accent)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'rgba(125, 249, 196, 0.15)',
                color: isLight ? '#033500' : 'var(--fl-mint)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--fl-font-mono)',
                fontWeight: 700,
              }}
            >
              ADMIN GOVERNANCE CONSOLE
            </span>
            <span style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
              Connected as: <strong style={{ color: isLight ? '#033500' : 'var(--fl-text)' }}>{currentUser?.email || 'admin@frostledger.io'}</strong> ({currentRole.toUpperCase()})
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '6px 0 2px', color: isLight ? '#033500' : 'var(--fl-text)' }}>
            Supply Chain Integrity &amp; Incident Governance
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
            Supervise active alerts from field operators, verify deterministic remediation signatures, monitor user activity, and maintain device fleet cryptography.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              soundEffects.playClick();
              fetchAllAlerts();
              fetchUsersAndAuditTrail();
            }}
            className="fl-button"
            title="Refresh database records"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isLight ? '#033500' : 'var(--fl-hairline)',
              color: isLight ? '#033500' : 'var(--fl-text)',
            }}
          >
            <RefreshCw size={14} className={isLoadingAlerts || isLoadingUsers ? 'animate-spin' : ''} />
            <span>Sync Supabase</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs for Admin */}
      <div
        className="fl-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`fl-button ${isLight && activeTab === 'alerts' ? 'force-white' : ''}`}
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('alerts');
            }}
            style={{
              background:
                activeTab === 'alerts'
                  ? isLight
                    ? '#033500'
                    : 'rgba(125, 249, 196, 0.15)'
                  : isLight
                  ? '#ffffff'
                  : 'transparent',
              borderColor: isLight ? '#033500' : activeTab === 'alerts' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color:
                activeTab === 'alerts'
                  ? isLight
                    ? '#ffffff'
                    : 'var(--fl-mint)'
                  : isLight
                  ? '#033500'
                  : 'var(--fl-muted)',
              fontWeight: activeTab === 'alerts' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={14} style={{ color: activeAlertsCount > 0 ? '#ef4444' : 'inherit' }} />
            <span>Incidents &amp; Alerts</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: acknowledgedAlertsCount > 0 ? '#f59e0b' : activeAlertsCount > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {alerts.length}
            </span>
          </button>

          <button
            className={`fl-button ${isLight && activeTab === 'users' ? 'force-white' : ''}`}
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('users');
            }}
            style={{
              background:
                activeTab === 'users'
                  ? isLight
                    ? '#033500'
                    : 'rgba(125, 249, 196, 0.15)'
                  : isLight
                  ? '#ffffff'
                  : 'transparent',
              borderColor: isLight ? '#033500' : activeTab === 'users' ? 'var(--fl-mint)' : 'var(--fl-hairline)',
              color:
                activeTab === 'users'
                  ? isLight
                    ? '#ffffff'
                    : 'var(--fl-mint)'
                  : isLight
                  ? '#033500'
                  : 'var(--fl-muted)',
              fontWeight: activeTab === 'users' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={14} />
            <span>Operator &amp; User Monitor ({userProfiles.length})</span>
          </button>

          <button
            className={`fl-button ${isLight && activeTab === 'profiles' ? 'force-white' : ''}`}
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('profiles');
            }}
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
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('devices');
            }}
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
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('audit');
            }}
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
            Tamper-Proof Audit Log ({auditLogs.length + realtimeAuditLogs.length})
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

      {/* Tab: Incidents & Alerts Dispatch (User Request Primary) */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="fl-card" style={{ padding: '16px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Alerts Ingested
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                {alerts.length}
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '4px' }}>
                Synced across Supabase PostgreSQL
              </div>
            </div>

            <div
              className="fl-card"
              style={{
                padding: '16px',
                borderLeft: '4px solid #ef4444',
                background: isLight ? '#fff5f5' : 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                Active / Unacknowledged
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#ef4444' }}>
                {activeAlertsCount}
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#7f1d1d' : 'rgba(239, 68, 68, 0.8)', marginTop: '4px' }}>
                Requires urgent operator SOP remediation
              </div>
            </div>

            <div
              className="fl-card"
              style={{
                padding: '16px',
                borderLeft: '4px solid #f59e0b',
                background: isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.05)',
              }}
            >
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                Operator Acknowledged
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: '#f59e0b' }}>
                {acknowledgedAlertsCount}
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#78350f' : 'rgba(245, 158, 11, 0.8)', marginTop: '4px' }}>
                Remediation documented • Awaiting admin signoff
              </div>
            </div>

            <div
              className="fl-card"
              style={{
                padding: '16px',
                borderLeft: '4px solid var(--fl-mint)',
                background: isLight ? '#f0fdf4' : 'rgba(125, 249, 196, 0.05)',
              }}
            >
              <div style={{ fontSize: '11px', color: isLight ? '#033500' : 'var(--fl-mint)', fontWeight: 700, textTransform: 'uppercase' }}>
                Resolved &amp; Closed
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: isLight ? '#033500' : 'var(--fl-mint)' }}>
                {resolvedAlertsCount}
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '4px' }}>
                Audited &amp; sealed in Merkle root
              </div>
            </div>
          </div>

          {/* Main Alerts Stream Table */}
          <div className="fl-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: isLight ? '#033500' : 'var(--fl-text)' }}>
                  🚨 Real-Time Excursion &amp; Anomaly Alert Stream
                </div>
                <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
                  Live alerts dispatched directly from field edge nodes to this admin governance dashboard and database.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: 'rgba(125, 249, 196, 0.1)',
                    border: '1px solid var(--fl-mint)',
                    fontSize: '11px',
                    color: isLight ? '#033500' : 'var(--fl-mint)',
                    fontFamily: 'var(--fl-font-mono)',
                    fontWeight: 600,
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Supabase `public.alerts` Live
                </span>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 12px', opacity: 0.5, color: 'var(--fl-mint)' }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>No active or acknowledged alerts in database</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>All cold chain corridors operating strictly within nominal USP standards.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="fl-table">
                  <thead>
                    <tr>
                      <th>Alert ID &amp; Shipment</th>
                      <th>Severity</th>
                      <th>Telemetry Breach</th>
                      <th>Status &amp; Operator Remediation SOP</th>
                      <th>Cryptographic Signature</th>
                      <th>Governance Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => {
                      const isAck = a.status === 'ACKNOWLEDGED';
                      const isRes = a.status === 'RESOLVED';
                      const isAct = a.status === 'ACTIVE';

                      return (
                        <tr
                          key={a.alert_id}
                          style={{
                            background: isAck
                              ? isLight
                                ? 'rgba(245, 158, 11, 0.05)'
                                : 'rgba(245, 158, 11, 0.04)'
                              : isAct
                              ? isLight
                                ? 'rgba(239, 68, 68, 0.04)'
                                : 'rgba(239, 68, 68, 0.03)'
                              : undefined,
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--fl-font-mono)', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                              {a.alert_id}
                            </div>
                            <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
                              Shipment: <strong>{a.shipment_id}</strong>
                            </div>
                            <div style={{ fontSize: '10px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                              {a.created_at ? new Date(a.created_at).toLocaleString() : 'Just now'}
                            </div>
                          </td>

                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--fl-font-mono)',
                                background:
                                  a.severity === 'CRITICAL'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                                color: a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                                border: `1px solid ${a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                              }}
                            >
                              {a.severity}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                              {a.title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                              Observed: {a.temperature}°C (Limit: {a.threshold}°C)
                            </div>
                            <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
                              {a.description}
                            </div>
                          </td>

                          <td style={{ maxWidth: '340px' }}>
                            <div style={{ marginBottom: '6px' }}>
                              {isAct && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                  AWAITING OPERATOR SOP
                                </span>
                              )}
                              {isAck && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  ✓ OPERATOR ACKNOWLEDGED
                                </span>
                              )}
                              {isRes && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(125, 249, 196, 0.15)',
                                    color: isLight ? '#033500' : 'var(--fl-mint)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  ✓ RESOLVED &amp; ARCHIVED
                                </span>
                              )}
                            </div>

                            {/* Operator Remediation Details Display */}
                            {a.remediation_notes ? (
                              <div
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.25)',
                                  border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255, 255, 255, 0.08)',
                                  fontSize: '11px',
                                  lineHeight: 1.4,
                                }}
                              >
                                <div style={{ color: isLight ? '#2d552b' : 'var(--fl-muted)', fontSize: '10px', marginBottom: '2px' }}>
                                  Operator: <strong style={{ color: isLight ? '#033500' : 'var(--fl-text)' }}>{a.acknowledged_by || 'Field Operator'}</strong> •{' '}
                                  {a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleTimeString() : ''}
                                </div>
                                <div style={{ fontStyle: 'italic', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                                  &ldquo;{a.remediation_notes}&rdquo;
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                                Pending remediation note from field terminal.
                              </div>
                            )}
                          </td>

                          <td>
                            {a.signature ? (
                              <div>
                                <PolygonScanLink hash={a.signature} label="Merkle Audit Proof" shorten={true} />
                                <div style={{ fontSize: '10px', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontFamily: 'var(--fl-font-mono)', marginTop: '2px' }}>
                                  {a.signature.slice(0, 14)}...
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                                Pending Signature
                              </span>
                            )}
                          </td>

                          <td>
                            {!isRes ? (
                              <button
                                className={`fl-button ${isLight ? 'force-white' : ''}`}
                                onClick={() => {
                                  soundEffects.playClick();
                                  setResolveTargetAlert(a);
                                  setAdminResolutionNotes(
                                    `Verified remediation for ${a.shipment_id}: Container returned to nominal temperature. SOP requirements satisfied.`
                                  );
                                }}
                                style={{
                                  background: isLight ? '#033500' : 'var(--fl-mint)',
                                  color: isLight ? '#ffffff' : '#0a0a0b',
                                  borderColor: isLight ? '#033500' : 'var(--fl-mint)',
                                  fontSize: '11px',
                                  padding: '5px 10px',
                                  fontWeight: 600,
                                }}
                              >
                                Resolve &amp; Close
                              </button>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLight ? '#033500' : 'var(--fl-mint)', fontSize: '11px', fontWeight: 600 }}>
                                <CheckCircle size={14} />
                                <span>Closed</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Operator Surveillance & User Monitoring (User Request Primary) */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1: Registered Supply Chain Personnel */}
          <div className="fl-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: isLight ? '#033500' : 'var(--fl-text)' }}>
                  👥 Cold Chain Personnel &amp; Operator Surveillance
                </div>
                <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
                  Live registry of authenticated operators, receivers, and admins in Supabase `public.profiles`. Administrators can promote/demote privileges in real-time.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: 'rgba(125, 249, 196, 0.1)',
                    color: isLight ? '#033500' : 'var(--fl-mint)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {userProfiles.length} Registered Nodes
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="fl-table">
                <thead>
                  <tr>
                    <th>User Identity &amp; Email</th>
                    <th>Organization / Node</th>
                    <th>Assigned Role Privilege</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {userProfiles.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: u.role === 'admin' ? 'rgba(125, 249, 196, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: u.role === 'admin' ? 'var(--fl-mint)' : 'var(--fl-cyan)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              border: '1px solid currentColor',
                            }}
                          >
                            {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: isLight ? '#033500' : 'var(--fl-text)' }}>
                              {u.full_name || 'Unnamed Operator'}
                            </div>
                            <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontFamily: 'var(--fl-font-mono)' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: '12px', color: isLight ? '#033500' : 'inherit' }}>
                        {u.company || 'FrostLedger Cold Chain Node'}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value as 'operator' | 'admin' | 'receiver' | 'auditor')
                            }
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'var(--fl-font-mono)',
                              fontWeight: 600,
                              background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                              color: isLight ? '#033500' : 'var(--fl-text)',
                              border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="operator">Operator (Field)</option>
                            <option value="admin">Administrator (Governance)</option>
                            <option value="receiver">Dock Receiver</option>
                            <option value="auditor">GxP Auditor</option>
                          </select>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'rgba(125, 249, 196, 0.1)',
                            color: isLight ? '#033500' : 'var(--fl-mint)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Surveillance Active
                        </span>
                      </td>

                      <td style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontFamily: 'var(--fl-font-mono)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Real-Time Operator Activity Stream (Live from Supabase audit_logs) */}
          <div className="fl-card">
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: isLight ? '#033500' : 'var(--fl-text)' }}>
                ⚡ Real-Time Operator Action Stream (`public.audit_logs`)
              </div>
              <div style={{ fontSize: '13px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '2px' }}>
                Immutable event stream monitoring all operator remediation entries, alert acknowledgments, and administrative actions in real-time.
              </div>
            </div>

            {realtimeAuditLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontSize: '12px' }}>
                No database audit entries logged yet. Try acknowledging an alert in the Shipment Detail View!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {realtimeAuditLogs.map((log) => {
                  const isAck = log.event_type === 'ALERT_ACKNOWLEDGED';
                  const isResolved = log.event_type === 'ALERT_ADMIN_RESOLVED';

                  return (
                    <div
                      key={log.id || log.created_at}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: isLight
                          ? '1px solid #e5e7eb'
                          : '1px solid var(--fl-hairline)',
                        background: isLight ? '#fafafa' : 'rgba(255, 255, 255, 0.02)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: isAck
                              ? 'rgba(245, 158, 11, 0.15)'
                              : isResolved
                              ? 'rgba(125, 249, 196, 0.15)'
                              : 'rgba(56, 189, 248, 0.15)',
                            color: isAck
                              ? '#f59e0b'
                              : isResolved
                              ? 'var(--fl-mint)'
                              : 'var(--fl-cyan)',
                          }}
                        >
                          {isAck ? <AlertTriangle size={16} /> : isResolved ? <ShieldAlert size={16} /> : <FileCheck size={16} />}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontFamily: 'var(--fl-font-mono)',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: isLight ? '#033500' : 'var(--fl-text)',
                              }}
                            >
                              {log.event_type}
                            </span>
                            <span style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                              Shipment: <strong>{log.shipment_id}</strong>
                            </span>
                          </div>

                          {/* Payload Details */}
                          {isAck && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                              Operator <strong>{log.payload?.acknowledged_by}</strong> signed remediation SOP:
                              <div
                                style={{
                                  marginTop: '4px',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.3)',
                                  border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.05)',
                                  fontStyle: 'italic',
                                  fontSize: '11px',
                                }}
                              >
                                &ldquo;{log.payload?.remediation_notes}&rdquo;
                              </div>
                            </div>
                          )}

                          {isResolved && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: isLight ? '#033500' : 'var(--fl-text)' }}>
                              Admin <strong>{log.payload?.resolved_by}</strong> marked alert as resolved:
                              <div
                                style={{
                                  marginTop: '4px',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.3)',
                                  fontSize: '11px',
                                }}
                              >
                                {log.payload?.note}
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {log.merkle_hash && (
                              <PolygonScanLink hash={log.merkle_hash} label="Audit Root" shorten={true} />
                            )}
                            {log.polygon_tx && (
                              <PolygonScanLink type="tx" hash={log.polygon_tx} label="Polygon Amoy Anchor" shorten={true} />
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', fontFamily: 'var(--fl-font-mono)' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Product Profiles */}
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
                  <th>Profile ID &amp; Name</th>
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

      {/* Tab 4: Ed25519 Fleet Devices */}
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
                  <th>Device ID</th>
                  <th>Ed25519 Public Key</th>
                  <th>Firmware</th>
                  <th>Battery</th>
                  <th>Heartbeat</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.device_id}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--fl-font-mono)', color: isLight ? '#033500' : 'inherit' }}>
                      {d.device_id}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--fl-font-mono)',
                        fontSize: '11px',
                        color: isLight ? '#2d552b' : 'var(--fl-muted)',
                      }}
                    >
                      {d.public_key.substring(0, 20)}...
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          color: isLight ? '#033500' : 'inherit',
                        }}
                      >
                        {d.firmware_version}
                      </span>
                    </td>
                    <td style={{ color: isLight ? '#033500' : 'inherit', fontSize: '12px' }}>
                      {d.battery_pct}%
                    </td>
                    <td style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                      {d.last_heartbeat}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--fl-font-mono)',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
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

      {/* Tab 5: Tamper-Proof Audit Log */}
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

      {/* Admin Resolve Alert Modal */}
      {resolveTargetAlert && (
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
            onSubmit={handleResolveAlert}
            className="fl-card"
            style={{
              maxWidth: '520px',
              width: '90%',
              background: isLight ? '#ffffff' : 'var(--fl-bg-primary)',
              border: isLight ? '1.5px solid #033500' : '1px solid var(--fl-mint)',
              boxShadow: isLight ? '0 12px 36px rgba(3, 53, 0, 0.2)' : '0 8px 32px rgba(125, 249, 196, 0.15)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: isLight ? '#033500' : 'var(--fl-mint)', marginBottom: '4px' }}>
              🛡️ Admin Signoff: Close Deterministic Incident
            </div>
            <div style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginBottom: '16px' }}>
              Alert ID: <strong>{resolveTargetAlert.alert_id}</strong> • Shipment: <strong>{resolveTargetAlert.shipment_id}</strong>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: isLight ? '#f3f4f6' : 'rgba(255, 255, 255, 0.04)',
                border: isLight ? '1px solid #e5e7eb' : '1px solid var(--fl-hairline)',
                marginBottom: '16px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 600, color: isLight ? '#033500' : 'var(--fl-text)', marginBottom: '4px' }}>
                Field Operator Remediation Statement:
              </div>
              <div style={{ fontStyle: 'italic', color: isLight ? '#2d552b' : 'var(--fl-muted)' }}>
                &ldquo;{resolveTargetAlert.remediation_notes || 'No specific notes provided.'}&rdquo;
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#2d552b' : 'var(--fl-muted)', marginTop: '4px' }}>
                Signed by: {resolveTargetAlert.acknowledged_by || 'Field Operator'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Admin Incident Closure Notes:
              </label>
              <textarea
                value={adminResolutionNotes}
                onChange={(e) => setAdminResolutionNotes(e.target.value)}
                rows={3}
                required
                placeholder="Document administrative verification of remediation action before archiving..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: isLight ? '1px solid #033500' : '1px solid var(--fl-hairline)',
                  background: isLight ? '#ffffff' : 'var(--fl-bg-secondary)',
                  color: isLight ? '#033500' : 'var(--fl-text)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="fl-button"
                onClick={() => setResolveTargetAlert(null)}
                style={isLight ? { background: '#ffffff', color: '#033500', borderColor: '#033500' } : undefined}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingResolution}
                className={`fl-button ${isLight ? 'force-white' : ''}`}
                style={{
                  background: isLight ? '#033500' : 'var(--fl-mint)',
                  color: isLight ? '#ffffff' : '#0a0a0b',
                  borderColor: isLight ? '#033500' : 'var(--fl-mint)',
                  fontWeight: 600,
                  opacity: isSubmittingResolution ? 0.7 : 1,
                }}
              >
                {isSubmittingResolution ? 'Sealing...' : 'Confirm & Seal Incident'}
              </button>
            </div>
          </form>
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
                  placeholder="e.g. Comirnaty (COVID-19 mRNA)"
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
                    <option value="blood_plasma">Blood Plasma</option>
                    <option value="cellular_therapy">Cellular Therapy</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: isLight ? '#2d552b' : 'var(--fl-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Activation Energy (kJ/mol)
                  </label>
                  <input
                    type="number"
                    step="0.1"
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
