import type { FormQuestion } from '@/lib/types';
export function withConsultationBodyMetrics(questions: FormQuestion[]) {
    const result = [...questions];
    for (const [id, label, example, pattern] of [
        ['height_cm', 'Height (cm)', 'For example: 175 cm', /\bheight\b/i],
        ['weight_kg', 'Current weight (kg)', 'For example: 80.5 kg', /\b(body\s*weight|current\s*weight|starting\s*weight|weight)\b/i],
    ] as const) {
        if (!result.some(q => q.id === id || (pattern.test(q.label) || pattern.test(q.id.replaceAll('_', ' '))) && !(id === 'weight_kg' && /goal|target|desired/i.test(q.label + q.id))))
            result.push({ id, label, placeholder: example, type: 'text', enabled: true, required: false });
    }
    return result;
}
export function consultationMetricError(answers: Record<string, unknown>) {
    for (const key of ['height_cm', 'weight_kg']) {
        const value = answers[key];
        if (value === undefined || value === null || value === '')
            continue;
        if (!['string', 'number'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1000)
            return `Enter a positive ${key === 'height_cm' ? 'height in cm' : 'weight in kg'} (up to 1,000).`;
    }
    return null;
}
export function consultationBodyContext(answers: Record<string, unknown> | null | undefined, questions: FormQuestion[] = []) {
    return [['height_cm', 'Height', 'cm', /\bheight\b/i], ['weight_kg', 'Consultation weight', 'kg', /\b(body\s*weight|current\s*weight|starting\s*weight|weight)\b/i]].flatMap(([key, label, unit, pattern]) => {
        const canonical = answers?.[key as string];
        if (canonical !== undefined && canonical !== null && canonical !== '') return [`${label}: ${canonical} ${unit}`];
        const question = questions.find(q => (pattern as RegExp).test(q.label + ' ' + q.id.replaceAll('_', ' ')) && !(key === 'weight_kg' && /goal|target|desired/i.test(q.label + q.id)) && answers?.[q.id] !== undefined && answers?.[q.id] !== null && answers?.[q.id] !== '');
        // Retain the configured label/unit exactly; never infer kg from an alias.
        return question ? [`${question.label}: ${answers?.[question.id]}`] : [];
    }).join('\n');
}
