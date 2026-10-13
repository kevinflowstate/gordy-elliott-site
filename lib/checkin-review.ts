/** Reviewed is a coach workflow state; it does not invent a client-facing reply. */
export function checkinNeedsReview(checkin: { admin_reply?: string | null; reviewed_at?: string | null }) {
  return !checkin.admin_reply?.trim() && !checkin.reviewed_at;
}
