import type { FormQuestion } from "@/lib/types";
import type { ConsultationFormConfig } from "@/lib/consultation-form";

export const BOARDROOM_CONSULTATION_QUESTIONS: FormQuestion[] = [
  {
    "id": "business_full_name",
    "label": "Full name",
    "placeholder": "1. YOU",
    "type": "text",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_business_name",
    "label": "Business name",
    "placeholder": "1. YOU",
    "type": "text",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_mobile",
    "label": "Mobile",
    "placeholder": "1. YOU",
    "type": "text",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_email",
    "label": "Email",
    "placeholder": "1. YOU",
    "type": "text",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_town",
    "label": "Town / area",
    "placeholder": "1. YOU",
    "type": "text",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_role",
    "label": "Which best describes you?",
    "placeholder": "1. YOU",
    "type": "select",
    "enabled": true,
    "required": false,
    "options": [
      "I run my own business",
      "I’m a coach, consultant or freelancer",
      "I’m a manager or leader in someone else’s business"
    ]
  },
  {
    "id": "business_home",
    "label": "Who’s at home? Partner, kids, anyone you look after",
    "placeholder": "1. YOU",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_boundaries",
    "label": "Hours or days you won’t work, no matter what",
    "placeholder": "1. YOU",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_why_now",
    "label": "Why now? What made you reach out?",
    "placeholder": "1. YOU",
    "type": "textarea",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_offers",
    "label": "What do you sell? List your main offers and the price of each",
    "placeholder": "2. THE BUSINESS",
    "type": "textarea",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_years_trading",
    "label": "Years trading",
    "placeholder": "2. THE BUSINESS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_team",
    "label": "Who works with you? Staff, subbies, VA, family",
    "placeholder": "2. THE BUSINESS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_best_customer",
    "label": "Your best kind of customer or job: pays well AND you enjoy it",
    "placeholder": "2. THE BUSINESS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_turnover",
    "label": "Turnover over the last 12 months (£)",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_profit",
    "label": "Profit, or what you actually pay yourself (£)",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_average_sale",
    "label": "Average sale or job value (£)",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_sales_month",
    "label": "Sales or jobs per month",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_leads_month",
    "label": "Enquiries or leads per month",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_quotes_month",
    "label": "How many of those get a quote or proposal?",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_buyers_month",
    "label": "How many buy?",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_target_turnover",
    "label": "Monthly turnover you want in 6 months (£)",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_key_number",
    "label": "The ONE number that matters most to you right now, and what it is today",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_tracked_numbers",
    "label": "Which numbers do you already track each week, if any?",
    "placeholder": "3. THE NUMBERS (rough is fine)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_problems",
    "label": "Your 3 biggest problems in the business right now, in order",
    "placeholder": "4. YOUR BIGGEST PROBLEMS",
    "type": "textarea",
    "enabled": true,
    "required": true
  },
  {
    "id": "business_cost",
    "label": "What’s problem number 1 costing you? Money, time, stress, family time",
    "placeholder": "4. YOUR BIGGEST PROBLEMS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_tried",
    "label": "What have you already tried to fix it?",
    "placeholder": "4. YOUR BIGGEST PROBLEMS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_change",
    "label": "What would change if it was fixed?",
    "placeholder": "4. YOUR BIGGEST PROBLEMS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_help",
    "label": "What do you want my help with most? Select all that apply: Getting more leads, Converting more sales, Raising prices, Systems and automation, Admin and paperwork, Time management, Focus, Hiring or team, Something else",
    "placeholder": "4. YOUR BIGGEST PROBLEMS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_hours",
    "label": "Hours worked in a typical week",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_hours_breakdown",
    "label": "Hours a week on: delivering the work / sales / admin and paperwork / marketing / managing people",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_drain",
    "label": "What drains you most?",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_off_plate",
    "label": "If I could take ONE thing off your plate tomorrow, what would it be?",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_family_hours",
    "label": "Hours a week with family that are actually yours, phone away",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_hours_back",
    "label": "How many hours a week do you want back?",
    "placeholder": "5. TIME",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_sources",
    "label": "Where do your enquiries come from? List all that apply",
    "placeholder": "6. LEADS AND SALES",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_best_source",
    "label": "Which ONE source brings your best customers?",
    "placeholder": "6. LEADS AND SALES",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_reply_time",
    "label": "How fast do you usually reply to a new enquiry?",
    "placeholder": "6. LEADS AND SALES",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_follow_up",
    "label": "What happens when someone goes quiet after a quote?",
    "placeholder": "6. LEADS AND SALES",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_lead_tracking",
    "label": "Where do you keep track of leads?",
    "placeholder": "6. LEADS AND SALES",
    "type": "select",
    "enabled": true,
    "required": false,
    "options": [
      "Head",
      "Notebook",
      "Phone",
      "Spreadsheet",
      "CRM",
      "Nowhere"
    ]
  },
  {
    "id": "business_software",
    "label": "How do you quote and invoice? Name any software",
    "placeholder": "7. SYSTEMS AND ADMIN",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_processes",
    "label": "What’s written down: templates, processes, checklists? Where are they kept?",
    "placeholder": "7. SYSTEMS AND ADMIN",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_tools",
    "label": "Apps and tools you pay for monthly, and roughly what each costs",
    "placeholder": "7. SYSTEMS AND ADMIN",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_tech_score",
    "label": "How comfortable are you with tech? (1–10)",
    "placeholder": "7. SYSTEMS AND ADMIN",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_side_projects",
    "label": "Side projects, offers or ideas pulling at you right now",
    "placeholder": "8. FOCUS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_finish_score",
    "label": "How often do you start something and not finish it? (1–10)",
    "placeholder": "8. FOCUS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_tuesday",
    "label": "Describe a normal Tuesday if you were less scattered",
    "placeholder": "8. FOCUS",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_leads_score",
    "label": "Leads (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_sales_score",
    "label": "Sales (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_pricing_score",
    "label": "Pricing (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_systems_score",
    "label": "Systems (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_money_score",
    "label": "Money (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_time_score",
    "label": "Time (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_focus_score",
    "label": "Focus (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_energy_score",
    "label": "Energy (1–10)",
    "placeholder": "9. WHERE YOU’RE AT (score 1–10)",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_14_win",
    "label": "14-day win, and what done looks like",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_30_win",
    "label": "30-day win, and what done looks like",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_60_win",
    "label": "60-day win, and what done looks like",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_90_win",
    "label": "90-day win, and what done looks like",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_90_number",
    "label": "The number you most want to see moved in 90 days, and from what to what",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_one_fix",
    "label": "The one thing that, if we fixed it, would change everything",
    "placeholder": "10. WHAT WE MOVE",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_style",
    "label": "How do you want to be coached?",
    "placeholder": "11. HOW YOU WANT TO BE COACHED",
    "type": "select",
    "enabled": true,
    "required": false,
    "options": [
      "Straight, no fluff",
      "Straight but supportive",
      "Gentle"
    ]
  },
  {
    "id": "business_checkin_day",
    "label": "Which day suits your weekly check-in?",
    "placeholder": "11. HOW YOU WANT TO BE COACHED",
    "type": "select",
    "enabled": true,
    "required": false,
    "options": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ]
  },
  {
    "id": "business_give_up",
    "label": "What’s made you give up on things in the past?",
    "placeholder": "11. HOW YOU WANT TO BE COACHED",
    "type": "textarea",
    "enabled": true,
    "required": false
  },
  {
    "id": "business_anything_else",
    "label": "Anything else I should know?",
    "placeholder": "11. HOW YOU WANT TO BE COACHED",
    "type": "textarea",
    "enabled": true,
    "required": false
  }
];

export function buildBoardroomConsultationConfig(): ConsultationFormConfig { return { title: "Boardroom Consultation", description: "Right. This is where we get the real picture of you and your business. Not where you think it’s at, where it’s actually at. My job is simple: move your numbers and give you back time. To do that I need the honest version. Rough numbers are fine. Take 20 minutes and answer it straight. Never put passwords in here.", questions: BOARDROOM_CONSULTATION_QUESTIONS.map(q => ({ ...q })) }; }

for (const question of BOARDROOM_CONSULTATION_QUESTIONS) {
  if (question.id === "business_help") { question.type = "select"; question.options = ["Getting more leads", "Converting more sales", "Raising prices", "Systems and automation", "Admin and paperwork", "Time management", "Focus", "Hiring or team", "Something else"]; }
  if (question.id === "business_sources") { question.type = "select"; question.options = ["Instagram", "Facebook", "Google / search", "Referrals", "Website", "Paid advertising", "Other"]; }
}
export const BOARDROOM_MULTISELECT_IDS = new Set(["business_help", "business_sources"]);

export const BOARDROOM_EXCLUDED_FIELDS = new Set(["date_of_birth", "sex", "cycle_tracking_enabled", "weight", "weight_kg", "wearables", "wearables_preference", "wearables_notes", "fitness_level", "training_days", "equipment_access", "dietary_preferences", "injuries", "supplements", "hierarchy_exercise_nutrition"]);
export function isBoardroomConsultation(programme?: string | null) { return programme === "boardroom"; }
export function validateConsultationAnswers(config: ConsultationFormConfig, answers: Record<string, unknown>): string | null {
  for (const q of config.questions.filter(q => q.enabled !== false)) {
    const value = answers[q.id];
    if (q.required && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) return `${q.label} is required`;
    if (value !== undefined && value !== null && typeof value !== "string" && typeof value !== "boolean") return `Invalid answer for ${q.label}`;
    if (q.type === "select" && typeof value === "string" && value && q.id !== "sex" && !(BOARDROOM_MULTISELECT_IDS.has(q.id) ? value.split("; ").every(option => q.options?.includes(option)) : q.options?.includes(value))) return `Choose a valid option for ${q.label}`;
  }
  return null;
}
export function buildBoardroomConsultationSummary(data: Record<string, unknown>) {
  return { generated_by: "deterministic", generated_at: new Date().toISOString(), programme_type: "boardroom", business_profile: Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith("business_"))) };
}
