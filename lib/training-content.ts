import type { ContentType, ModuleContent } from "@/lib/types";

export function normalizeLessonType(
  contentType: ContentType | undefined,
  contentUrl?: string | null,
  contentText?: string | null
): ContentType {
  if (contentType === "video" && !contentUrl?.trim()) {
    return contentText?.trim() ? "text" : "checklist";
  }

  return contentType || "text";
}

export function getLessonDisplayType(
  lesson: Pick<ModuleContent, "content_type" | "content_url" | "content_text">
) {
  return normalizeLessonType(lesson.content_type, lesson.content_url, lesson.content_text);
}
