export type PortalAIAction = { label: string; href: string };

function actionForText(value: string): PortalAIAction | null {
  const routeText = value.toLowerCase();
  if (/education|lesson|learning module/.test(routeText)) {
    return { label: "Open Education", href: "/portal/training" };
  }
  if (/nutrition|meal plan|macros|calories|protein|what (?:can|should) i eat|food/.test(routeText)) {
    return { label: "Open Nutrition", href: "/portal/nutrition-plan" };
  }
  if (/workout|exercise plan|training plan|next session|today.?s session/.test(routeText)) {
    return { label: "Open Training", href: "/portal/exercise-plan" };
  }
  return null;
}

export function getPortalAIAction(message: string, reply: string): PortalAIAction | null {
  return actionForText(message) || actionForText(reply);
}
