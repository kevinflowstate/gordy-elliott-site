export function boundedText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

export function sanitiseSets(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).map((entry, index) => {
    const set = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const requestedNumber = Number(set.set_number);
    const weight = boundedText(set.weight, 32);
    const reps = boundedText(set.reps, 120);
    const notes = boundedText(set.notes, 240);
    return {
      ...(Number.isInteger(set.circuit_rounds) && Number(set.circuit_rounds) >= 0 && Number(set.circuit_rounds) <= 9999
        ? { circuit_rounds: Number(set.circuit_rounds) } : {}),
      set_number: Number.isInteger(requestedNumber) && requestedNumber > 0 && requestedNumber <= 20
        ? requestedNumber
        : index + 1,
      weight,
      reps,
      notes,
      completed: typeof set.completed === "boolean"
        ? set.completed
        : Boolean(weight || reps || notes),
    };
  });
}

