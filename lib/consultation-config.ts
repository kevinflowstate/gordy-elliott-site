import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeConsultationConfig } from '@/lib/consultation-form';
export async function loadConsultationConfig(admin: SupabaseClient, programme?: string | null) {
 const {data} = await admin.from('form_config').select('config').eq('form_type', programme === 'boardroom' ? 'boardroom_consultation' : programme === 'foundations' ? 'foundations_consultation' : 'consultation').maybeSingle();
 return normalizeConsultationConfig(data?.config, programme);
}
