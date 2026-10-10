import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kdarjiawiiqnfreijqzo.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYXJqaWF3aWlxbmZyZWlqcXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MzkzOTAsImV4cCI6MjEwNzIxNTM5MH0.WNExjHL1rc1SDKgpEeQoHSL2QtTOnoXNjBBV83Q8Rls';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  company?: string;
  role: 'admin' | 'manufacturer' | 'carrier' | 'auditor' | 'customs';
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  user_id?: string;
  name: string;
  profile_type: string;
  min_temp_c: number;
  max_temp_c: number;
  status: 'IN_TRANSIT' | 'DELIVERED' | 'EXCURSION_ALERT' | 'QUARANTINED';
  origin?: string;
  destination?: string;
  current_temp_c?: number;
  mkt_accumulated_c?: number;
  merkle_root?: string;
  created_at: string;
  updated_at: string;
}

export interface TelemetryReading {
  id: string;
  shipment_id: string;
  device_id: string;
  timestamp: string;
  temp_c: number;
  humidity_pct?: number;
  shock_g?: number;
  lux?: number;
  battery_v?: number;
  ed25519_signature: string;
  is_tampered: boolean;
  is_excursion: boolean;
  created_at: string;
}
