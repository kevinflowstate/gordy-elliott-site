import { checkinAnswers, type CheckinMessageContext } from "@/lib/checkin-message";
export function foundationsDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function monthlyReviewWindow(joined: string, today = foundationsDayKey()) {
  const base = joined.slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base) || !Number.isFinite(Date.parse(base))) throw new Error('A joining date is needed for monthly reviews');
  const [year, month, day] = base.split('-').map(Number);
  const anniversary = (n: number) => {
    const first = new Date(Date.UTC(year, month - 1 + n, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last))).toISOString().slice(0,10);
  };
  const now = new Date(`${today}T12:00:00Z`);
  let n = Math.max(0, (now.getUTCFullYear()-year)*12 + now.getUTCMonth()-(month-1));
  if (anniversary(n)>today) n=Math.max(0,n-1);
  // Review the latest completed month; before the first anniversary, show the first month.
  const period = Math.max(0,n-1);
  return { joined: base, periodStart: anniversary(period), periodEnd: anniversary(period+1), nextDue: anniversary(Math.max(1,n+1)), due: n>0 };
}

export function foundationsMidnight(dateKey: string) {
 const date=new Date(`${dateKey}T00:00:00Z`);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(date));
 return new Date(date.getTime()-hour*3600000).toISOString();
}

export const FOUNDATIONS_AI_REPLY_POLICY = "Foundations permits one client message and one AI answer per day. Give your best complete, useful answer now, stating reasonable assumptions when information is missing. Do not ask clarifying or follow-up questions or make useful advice depend on another reply. For a change you cannot safely recommend, explain the limitation and give a practical safe next step within this answer.";
export function foundationsReviewAnswers(context: CheckinMessageContext) {
 const responses=Object.fromEntries(Object.entries(context.responses||{}).map(([key,value])=>[key,typeof value==='boolean'?(value?'Yes':'No'):typeof value==='number'?String(value):Array.isArray(value)&&value.every(v=>typeof v==='string')?value.join(', '):value]));
 return checkinAnswers({...context,responses});
}
export function reviewPeriodMatches(window: ReturnType<typeof monthlyReviewWindow>, start: unknown, end: unknown) {
 return start===window.periodStart && end===window.periodEnd;
}
