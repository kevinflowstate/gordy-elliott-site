import { createHash } from "node:crypto";
import type { CheckinFormConfig } from "./types";

export function checkinConfigRevision(config: CheckinFormConfig, templateId: string | null) {
  return createHash("sha256").update(JSON.stringify({ config, templateId })).digest("hex");
}
