type ReminderProfile = { programme_type?: string | null; onboarding_status?: string | null; checkin_day?: string | null; checkin_form_id?: string | null };
export function checkinReminderDay(profile: ReminderProfile, config: { programme_type?: string; checkin_day?: string } | null, globalDay: string): string | null {
  // Keep existing fitness reminder behaviour. Boardroom uses its approved personal form.
  if (profile.programme_type !== 'boardroom') return globalDay.toLowerCase();
  if (profile.onboarding_status !== 'active' || !profile.checkin_form_id || config?.programme_type !== 'boardroom') return null;
  return (profile.checkin_day || config.checkin_day || 'monday').toLowerCase();
}
