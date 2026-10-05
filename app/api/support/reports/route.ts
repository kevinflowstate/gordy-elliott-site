import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSupportInput } from "@/lib/support-contract";

export const runtime = "nodejs";
const MAX_BODY = 3 * 1024 * 1024;
async function boundedFormData(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, size);
  return new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bytes,
  }).formData();
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(
      origin &&
      new URL(origin).host === request.headers.get("host") &&
      ["http:", "https:"].includes(new URL(origin).protocol),
    );
  } catch {
    /* Reject malformed origins. */
  }
  if (!sameOrigin)
    return NextResponse.json(
      { error: "Please submit using the app support form." },
      { status: 403 },
    );
  const size = Number(request.headers.get("content-length") || 0);
  if (size > MAX_BODY)
    return NextResponse.json(
      { error: "Choose a smaller screenshot (under 2MB)." },
      { status: 413 },
    );
  try {
    let body: FormData;
    try {
      body = await boundedFormData(request);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message === "BODY_TOO_LARGE"
              ? "Choose a smaller screenshot (under 2MB)."
              : "The form could not be read. Please try again.",
        },
        {
          status:
            error instanceof Error && error.message === "BODY_TOO_LARGE"
              ? 413
              : 400,
        },
      );
    }
    let input;
    try {
      input = validateSupportInput(
        Object.fromEntries(
          [...body.entries()].filter(([key]) => key !== "screenshot"),
        ),
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Check the form fields.",
        },
        { status: 400 },
      );
    }
    if (input.website)
      return NextResponse.json(
        { error: "Please reload the form and try again." },
        { status: 400 },
      );
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("Support configuration missing");
    const ip = (
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"
    )
      .split(",")[0]
      .trim();
    const reporterHash = createHmac("sha256", secret)
      .update(`support:${ip}`)
      .digest("hex");
    const admin = createAdminClient();
    const { error: admissionError } = await admin.rpc(
      "reserve_support_request",
      { p_reporter_hash: reporterHash },
    );
    if (admissionError) {
      if (admissionError.message.includes("SUPPORT_REQUEST_LIMIT"))
        return NextResponse.json(
          {
            error:
              "Too many attempts. Please wait ten minutes or email support.",
          },
          { status: 429, headers: { "Retry-After": "600" } },
        );
      throw new Error("Support admission unavailable");
    }
    const file = body.get("screenshot");
    let image: Buffer | null = null;
    if (file instanceof File && file.size) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        return NextResponse.json(
          { error: "Choose a JPEG, PNG or WebP screenshot under 2MB." },
          { status: 400 },
        );
      try {
        const { default: sharp } = await import("sharp");
        const processor = sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 20_000_000,
        });
        const metadata = await processor.metadata();
        if (
          !metadata.format ||
          !["jpeg", "png", "webp"].includes(metadata.format)
        )
          throw new Error("Invalid screenshot format");
        image = await processor
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .timeout({ seconds: 5 })
          .toBuffer();
        if (image.length > 2 * 1024 * 1024)
          throw new Error("Screenshot too large");
      } catch {
        return NextResponse.json(
          {
            error:
              "That screenshot could not be opened. Try another image or send without it.",
          },
          { status: 400 },
        );
      }
    }
    const { data, error } = await admin.rpc("submit_support_report", {
      p_input: input,
      p_reporter_hash: reporterHash,
    });
    if (error) {
      if (error.message.includes("SUPPORT_RATE_LIMIT"))
        return NextResponse.json(
          {
            error:
              "Too many reports in a short time. Please wait an hour or email support.",
          },
          { status: 429, headers: { "Retry-After": "3600" } },
        );
      throw new Error("Report save failed");
    }
    if (!data?.reference || !data?.id)
      throw new Error("Report receipt missing");
    let attachmentSaved = !image;
    if (image && !data.duplicate) {
      const path = `${data.id}/screenshot.jpg`;
      const { error: uploadError } = await admin.storage
        .from("support-images")
        .upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (!uploadError) {
        const { error: linkError } = await admin
          .from("support_reports")
          .update({ image_path: path })
          .eq("id", data.id);
        attachmentSaved = !linkError;
        if (linkError)
          await admin.storage.from("support-images").remove([path]);
      }
    } else if (image && data.duplicate) {
      const { data: existing } = await admin
        .from("support_reports")
        .select("image_path")
        .eq("id", data.id)
        .single();
      attachmentSaved = Boolean(existing?.image_path);
    }
    return NextResponse.json(
      { reference: data.reference, attachmentSaved },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Your report could not be saved. Your answers are still here. Please retry or email kevin@flowstatesystems.ai.",
      },
      { status: 503 },
    );
  }
}
