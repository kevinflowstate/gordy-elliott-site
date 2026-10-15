import { createAdminClient } from '@/lib/supabase/admin';
import type { InboxViewer } from '@/lib/inbox-server';
export async function foundationsClientCannotSend(viewer: InboxViewer) {
  if (viewer.role !== 'client') return false;
  if (!viewer.clientProfileId) return true;
  const { data, error } = await createAdminClient().from('client_profiles').select('programme_type').eq('id', viewer.clientProfileId).maybeSingle();
  if (error || !data) throw new Error('Could not verify messaging access');
  return data.programme_type === 'foundations';
}
