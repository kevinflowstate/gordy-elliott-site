import type { FormQuestion } from "@/lib/types";

export const HOME_EQUIPMENT_FIELD = "home_equipment_details";
export const HOME_EQUIPMENT_MAX_LENGTH = 4000;
const LOCATION_FIELDS = new Set(["equipment_access", "training_location"]);
export function homeTrainingSelected(answers: Record<string, unknown> | null | undefined) {
  return [...LOCATION_FIELDS].some(key => {
    const value = answers?.[key];
    return (Array.isArray(value) ? value : [value]).some(option => typeof option === "string" && /\bhome\b/i.test(option) && !/\b(no|not)\s+(at\s+)?home\b/i.test(option));
  });
}
export function withHomeEquipmentQuestion(questions: FormQuestion[]) {
  if (questions.some(question => question.id === HOME_EQUIPMENT_FIELD)) return questions;
  const index = questions.findIndex(question => LOCATION_FIELDS.has(question.id) && question.enabled !== false && question.options?.some(option => /\bhome\b/i.test(option)));
  if (index < 0) return questions;
  const question: FormQuestion = {
    id: HOME_EQUIPMENT_FIELD,
    label: "What equipment do you have at home?",
    placeholder: "List weights and quantities, plus any other equipment. For example: dumbbells 2 × 5kg, 2 × 10kg; kettlebell 1 × 16kg; adjustable bench; resistance bands (light and heavy). If you have none, say so.",
    type: "textarea", enabled: true, required: false,
  };
  return [...questions.slice(0,index+1),question,...questions.slice(index+1)];
}
export function savedHomeEquipmentDetails(answers: Record<string, unknown>, previous: Record<string, unknown> | null | undefined) {
  const value = answers[HOME_EQUIPMENT_FIELD];
  // Older clients and hidden fields must not erase an existing inventory.
  return typeof value === "string" ? value.trim() : typeof previous?.[HOME_EQUIPMENT_FIELD] === "string" ? previous[HOME_EQUIPMENT_FIELD] as string : undefined;
}
export function homeEquipmentTrainingContext(answers: Record<string, unknown> | null | undefined) {
  if (!homeTrainingSelected(answers)) return "";
  const details = answers?.[HOME_EQUIPMENT_FIELD];
  return typeof details === "string" && details.trim() ? `Home equipment: ${details.trim()}\nUse these listed weights, quantities and equipment when planning home sessions.` : "Home training selected; exact equipment has not been provided.";
}
