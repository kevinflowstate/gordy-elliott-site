import type { TrainingPlan } from './types';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown) { if (typeof value !== 'string' || !uuid.test(value)) throw new Error('Invalid plan identifier'); return value; }
function text(value: unknown, max: number, required = false) { if (value == null && !required) return ''; if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Invalid plan text'); return value.trim(); }
function date(value: unknown) { if (!value) return null; if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) throw new Error('Invalid plan date'); return value; }
export function validateBusinessPlan(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Plan is required');
  const plan = input as TrainingPlan;
  if (!Array.isArray(plan.phases) || plan.phases.length < 1 || plan.phases.length > 30) throw new Error('Add between 1 and 30 phases');
  if (plan.status !== 'active' && plan.status !== 'completed') throw new Error('Invalid plan status');
  const seen = new Set<string>(); const unique = (value: unknown) => { const key = id(value); if (seen.has(key)) throw new Error('Duplicate phase or action identifier'); seen.add(key); return key; };
  const duration = plan.duration_days ?? 90;
  if (!Number.isInteger(duration) || duration < 1 || duration > 730) throw new Error('Plan length must be 1–730 days');
  const phases = plan.phases.map((phase, order_index) => {
    if (!Array.isArray(phase.items) || phase.items.length > 100) throw new Error('Too many actions');
    if (!Array.isArray(phase.linked_trainings) || phase.linked_trainings.length > 100) throw new Error('Invalid linked resources');
    return { id: unique(phase.id), name: text(phase.name, 200, true), notes: text(phase.notes, 20000), due_date: date(phase.due_date), order_index, linked_trainings: [...new Set(phase.linked_trainings.map(id))], items: phase.items.map((item, order_index) => ({id: unique(item.id), title: text(item.title, 2000, true), category: text(item.category, 200), due_date: date(item.due_date), notes: text(item.notes, 20000), completed: item.completed === true, completed_at: item.completed_at || null, order_index})) };
  });
  let pdf_url: string | null = null;
  if (plan.pdf_url) { const url = new URL(plan.pdf_url); if (url.protocol !== 'https:') throw new Error('PDF must use HTTPS'); pdf_url = url.toString(); }
  const discovery_answers: Record<string,string> = {};
  if (plan.discovery_answers) for (const [key,value] of Object.entries(plan.discovery_answers)) discovery_answers[text(key,200,true)] = text(value,20000);
  return {id: id(plan.id), client_id: id(plan.client_id), status: plan.status, summary: text(plan.summary, 30000, true), title: text(plan.title || 'Business Plan', 200, true), start_date: date(plan.start_date), duration_days: duration, discovery_answers, pdf_url, phases};
}
export async function saveBusinessPlan(admin: { rpc: (name: string, args: {payload: ReturnType<typeof validateBusinessPlan>}) => PromiseLike<{error: {message: string} | null}> }, input: unknown): Promise<{error?:string}> {
  try { const payload = validateBusinessPlan(input); const {error} = await admin.rpc('save_business_plan', {payload}); return error ? {error: error.message} : {}; } catch (error) { return {error: error instanceof Error ? error.message : 'Could not save plan'}; }
}
