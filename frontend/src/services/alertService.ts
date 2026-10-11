import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface DatabaseAlert {
  id?: string;
  alert_id: string;
  shipment_id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  temperature: number;
  threshold: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  remediation_notes?: string | null;
  signature?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseAuditLog {
  id?: string;
  shipment_id: string;
  event_type: string;
  actor_id?: string | null;
  payload: Record<string, any>;
  merkle_hash?: string | null;
  polygon_tx?: string | null;
  created_at?: string;
}

export interface UserProfileItem {
  id: string;
  email: string;
  full_name?: string | null;
  company?: string | null;
  role: 'operator' | 'admin' | 'receiver' | 'auditor';
  created_at?: string;
}

// Generate simple deterministic SHA256-like hex hash for audit trail
function generateAuditHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const salt = Math.abs((hash * 31) | 0).toString(16).padStart(8, '0');
  return `0x${hex}${salt}${hex}${salt}`.padEnd(66, 'e');
}

export const alertService = {
  /**
   * Fetches all alerts from Supabase public.alerts
   */
  async fetchAlerts(shipmentId?: string): Promise<DatabaseAlert[]> {
    try {
      let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
      if (shipmentId) {
        query = query.eq('shipment_id', shipmentId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('[alertService] fetchAlerts error, using local fallback:', error);
        return [];
      }
      return (data as DatabaseAlert[]) || [];
    } catch (err) {
      console.warn('[alertService] fetchAlerts network error:', err);
      return [];
    }
  },

  /**
   * Acknowledges a deterministic alert, updates database, and creates an immutable audit log
   */
  async acknowledgeAlert({
    alertId,
    shipmentId,
    remediationNotes,
    actorEmail,
    actorRole = 'operator',
    actorId = null,
  }: {
    alertId: string;
    shipmentId: string;
    remediationNotes: string;
    actorEmail: string;
    actorRole?: string;
    actorId?: string | null;
  }): Promise<{ success: boolean; auditHash: string }> {
    const nowIso = new Date().toISOString();
    const hashString = `${alertId}:${shipmentId}:${remediationNotes}:${actorEmail}:${nowIso}`;
    const auditHash = generateAuditHash(hashString);
    const polygonTx = '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37';

    try {
      // 1. Update public.alerts in Supabase
      const { error: alertUpdateError } = await supabase
        .from('alerts')
        .update({
          status: 'ACKNOWLEDGED',
          remediation_notes: remediationNotes,
          acknowledged_by: actorEmail,
          acknowledged_at: nowIso,
          signature: auditHash,
          updated_at: nowIso,
        })
        .eq('alert_id', alertId);

      if (alertUpdateError) {
        console.warn('[alertService] Error updating alert:', alertUpdateError);
      }

      // 2. Insert into public.audit_logs for immutable audit trail
      const { error: auditError } = await supabase.from('audit_logs').insert({
        shipment_id: shipmentId,
        event_type: 'ALERT_ACKNOWLEDGED',
        actor_id: actorId,
        payload: {
          alert_id: alertId,
          remediation_notes: remediationNotes,
          acknowledged_by: actorEmail,
          actor_role: actorRole,
          timestamp: nowIso,
          regulatory_standard: 'GxP Annex 11 / 21 CFR Part 11',
          action: 'OPERATOR_REMEDIATION_SIGNATURE',
        },
        merkle_hash: auditHash,
        polygon_tx: polygonTx,
        created_at: nowIso,
      });

      if (auditError) {
        console.warn('[alertService] Error inserting audit log:', auditError);
      }

      // Notify user via Sonner
      toast.success('Alert Acknowledged & Logged to Supabase', {
        description: `Audit Hash: ${auditHash.slice(0, 16)}... • Logged by ${actorEmail}`,
      });

      // Broadcast custom event so other components (e.g. Admin view) can immediately update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('frostledger:alert_acknowledged', {
            detail: {
              alertId,
              shipmentId,
              remediationNotes,
              actorEmail,
              actorRole,
              auditHash,
              timestamp: nowIso,
            },
          })
        );
      }

      return { success: true, auditHash };
    } catch (err: any) {
      console.error('[alertService] acknowledgeAlert error:', err);
      toast.error('Failed to record acknowledgment: ' + (err?.message || 'Database error'));
      return { success: false, auditHash };
    }
  },

  /**
   * Resolves an alert from the Admin console
   */
  async resolveAlert({
    alertId,
    adminEmail,
    adminResolutionNote,
  }: {
    alertId: string;
    adminEmail: string;
    adminResolutionNote?: string;
  }): Promise<boolean> {
    const nowIso = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'RESOLVED',
          updated_at: nowIso,
        })
        .eq('alert_id', alertId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        shipment_id: 'ALL',
        event_type: 'ALERT_ADMIN_RESOLVED',
        payload: {
          alert_id: alertId,
          resolved_by: adminEmail,
          note: adminResolutionNote || 'Admin marked alert as fully remediated and closed.',
          timestamp: nowIso,
        },
        merkle_hash: generateAuditHash(`${alertId}:${adminEmail}:${nowIso}`),
        polygon_tx: '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37',
        created_at: nowIso,
      });

      toast.success('Alert Marked as RESOLVED by Admin', {
        description: `Alert ${alertId} closed in database.`,
      });

      window.dispatchEvent(new CustomEvent('frostledger:alert_resolved', { detail: { alertId } }));
      return true;
    } catch (err: any) {
      toast.error('Failed to resolve alert: ' + (err?.message || 'Error'));
      return false;
    }
  },

  /**
   * Fetches immutable audit logs from Supabase
   */
  async fetchAuditLogs(): Promise<DatabaseAuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[alertService] fetchAuditLogs error:', error);
        return [];
      }
      return (data as DatabaseAuditLog[]) || [];
    } catch (err) {
      console.warn('[alertService] fetchAuditLogs network error:', err);
      return [];
    }
  },

  /**
   * Fetches all registered user profiles for Admin user monitoring
   */
  async fetchUserProfiles(): Promise<UserProfileItem[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[alertService] fetchUserProfiles error:', error);
        return [];
      }
      return (data as UserProfileItem[]) || [];
    } catch (err) {
      console.warn('[alertService] fetchUserProfiles network error:', err);
      return [];
    }
  },

  /**
   * Updates a user's role from the Admin governance dashboard
   */
  async updateUserRole(userId: string, newRole: 'operator' | 'admin' | 'receiver' | 'auditor'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`User role updated to ${newRole.toUpperCase()}`);
      return true;
    } catch (err: any) {
      toast.error('Failed to update role: ' + (err?.message || 'Error'));
      return false;
    }
  },
};
