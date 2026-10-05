export const SUPPORT_AREAS = [
  "Sign in or account",
  "Training",
  "Nutrition",
  "Tracking or progress",
  "Calendar or connected apps",
  "Messages",
  "Other",
] as const;
export const SUPPORT_IMPACTS = [
  "I cannot use the app",
  "This feature is blocked",
  "Something looks wrong",
  "An improvement idea",
] as const;
export const SUPPORT_STATUSES = [
  "New",
  "Triaged",
  "Needs more information",
  "In progress",
  "Ready to retest",
  "Resolved",
  "Duplicate",
] as const;
export const SUPPORT_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export interface SupportInput {
  submission_key: string;
  name: string;
  email: string;
  area: string;
  description: string;
  expected: string;
  impact: string;
  device: string;
  page: string;
  website?: string;
}
export interface SupportTicket extends SupportInput {
  id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  status: string;
  priority: string;
  owner: string;
  internal_notes: string;
  resolution: string;
  image_path: string | null;
  image_url?: string | null;
}
export function validateSupportInput(
  value: Record<string, unknown>,
): SupportInput {
  const text = (key: string, max: number, required = false) => {
    const valueText = value[key];
    if (valueText != null && typeof valueText !== "string")
      throw new Error("Please check the form fields.");
    const s = ((valueText as string) || "").trim();
    if ((required && !s) || s.length > max)
      throw new Error(
        `Please check ${key === "description" ? "what happened" : key}.`,
      );
    return s;
  };
  const input = {
    submission_key: text("submission_key", 36, true),
    name: text("name", 100, true),
    email: text("email", 254, true).toLowerCase(),
    area: text("area", 80, true),
    description: text("description", 4000, true),
    expected: text("expected", 1000),
    impact: text("impact", 80, true),
    device: text("device", 200),
    page: text("page", 200),
    website: text("website", 200),
  };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.submission_key,
    )
  )
    throw new Error("Please reload the form and try again.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    throw new Error("Enter a valid email address.");
  if (
    !(SUPPORT_AREAS as readonly string[]).includes(input.area) ||
    !(SUPPORT_IMPACTS as readonly string[]).includes(input.impact)
  )
    throw new Error("Choose the affected area and impact.");
  if (
    input.page &&
    (!input.page.startsWith("/") ||
      input.page.startsWith("//") ||
      /[?#]/.test(input.page))
  )
    input.page = "";
  return input;
}
export function validateSupportUpdate(value: Record<string, unknown>) {
  const text = (k: string, max: number) => {
    if (typeof value[k] !== "string" || (value[k] as string).length > max)
      throw new Error("Check the queue fields.");
    return (value[k] as string).trim();
  };
  const update = {
    status: text("status", 40),
    priority: text("priority", 20),
    owner: text("owner", 100),
    internal_notes: text("internal_notes", 8000),
    resolution: text("resolution", 2000),
  };
  if (
    !(SUPPORT_STATUSES as readonly string[]).includes(update.status) ||
    !(SUPPORT_PRIORITIES as readonly string[]).includes(update.priority)
  )
    throw new Error("Choose a valid status and priority.");
  if (update.status === "Resolved" && !update.resolution)
    throw new Error("Add a resolution before closing this report.");
  return update;
}

export function supportTicketMatchesFilter(status: string, filter: string) {
  return (
    filter === "All" ||
    (filter === "Open"
      ? !["Resolved", "Duplicate"].includes(status)
      : status === filter)
  );
}
