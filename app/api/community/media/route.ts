import {
  COMMUNITY_AUDIO_TYPES,
  COMMUNITY_FILE_TYPES,
  COMMUNITY_IMAGE_TYPES,
  COMMUNITY_MEDIA_BUCKET,
  hasCommunityAudioSignature,
  hasCommunityFileSignature,
  MAX_COMMUNITY_AUDIO_BYTES,
  MAX_COMMUNITY_AUDIO_SECONDS,
  MAX_COMMUNITY_FILE_BYTES,
  MAX_COMMUNITY_IMAGE_BYTES,
  readCommunityImageSize,
  safeCommunityFilename,
} from "@/lib/community-media";
import { getCommunityViewer, notifyCommunityPost } from "@/lib/community-server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type MediaType = "audio" | "image" | "file";

export async function POST(request: Request) {
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: "SHIFT community access is required" }, { status: 403 });

  const form = await request.formData();
  const mediaType = String(form.get("media_type") || "") as MediaType;
  const file = form.get("media") as File | null;
  if (!file || !["audio", "image", "file"].includes(mediaType)) {
    return NextResponse.json({ error: "Choose a supported attachment" }, { status: 400 });
  }

  const limit = mediaType === "audio" ? 12 : mediaType === "image" ? 15 : 10;
  const limited = rateLimit(`shift-community-${mediaType}:${viewer.userId}`, viewer.role === "admin" ? limit * 3 : limit, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attachments. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)) },
    });
  }

  const contentType = file.type.split(";")[0].toLowerCase();
  const maximumBytes = mediaType === "audio"
    ? MAX_COMMUNITY_AUDIO_BYTES
    : mediaType === "image"
      ? MAX_COMMUNITY_IMAGE_BYTES
      : MAX_COMMUNITY_FILE_BYTES;
  if (file.size < 1 || file.size > maximumBytes) {
    const error = mediaType === "audio"
      ? "Voice notes must be under 15MB"
      : mediaType === "image"
        ? "Photos must be under 10MB"
        : "Files must be under 10MB";
    return NextResponse.json({ error }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let extension: string | undefined;
  let duration: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let filename: string | null = null;

  if (mediaType === "audio") {
    extension = COMMUNITY_AUDIO_TYPES.get(contentType);
    duration = Math.round(Number(form.get("duration_seconds")));
    if (!extension) {
      return NextResponse.json({ error: "Voice notes must use a supported audio format" }, { status: 400 });
    }
    if (!Number.isFinite(duration) || duration < 1 || duration > MAX_COMMUNITY_AUDIO_SECONDS) {
      return NextResponse.json({ error: "Voice notes can be up to 3 minutes" }, { status: 400 });
    }
    if (!hasCommunityAudioSignature(contentType, bytes.slice(0, 16))) {
      return NextResponse.json({ error: "That recording file is not valid audio" }, { status: 400 });
    }
  } else if (mediaType === "image") {
    extension = COMMUNITY_IMAGE_TYPES.get(contentType);
    if (!extension) {
      return NextResponse.json({ error: "Photos must be JPEG or PNG" }, { status: 400 });
    }
    const dimensions = readCommunityImageSize(contentType, bytes);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 12000 || dimensions.height > 12000) {
      return NextResponse.json({ error: "That file is not a valid photo" }, { status: 400 });
    }
    width = dimensions.width;
    height = dimensions.height;
  } else {
    extension = COMMUNITY_FILE_TYPES.get(contentType);
    filename = safeCommunityFilename(file.name);
    if (!extension || !filename) {
      return NextResponse.json({ error: "Files must be PDF, TXT, CSV, DOCX or XLSX" }, { status: 400 });
    }
    if (!hasCommunityFileSignature(contentType, bytes)) {
      return NextResponse.json({ error: "That attachment does not match its file type" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const path = `${viewer.userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from(COMMUNITY_MEDIA_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "Attachment upload failed" }, { status: 500 });

  const { data: row, error } = await admin.from("shift_community_messages").insert({
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: "",
    message_type: mediaType,
    media_bucket: COMMUNITY_MEDIA_BUCKET,
    media_path: path,
    media_mime_type: contentType,
    media_size_bytes: file.size,
    media_duration_seconds: duration,
    media_width: width,
    media_height: height,
    media_filename: filename,
  }).select("*").single();
  if (error) {
    await admin.storage.from(COMMUNITY_MEDIA_BUCKET).remove([path]);
    return NextResponse.json({ error: "Attachment could not be saved" }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from(COMMUNITY_MEDIA_BUCKET).createSignedUrl(path, 60 * 10);
  await notifyCommunityPost(viewer, mediaType);

  return NextResponse.json({
    message: {
      ...row,
      client_id: "shift-community",
      sender_name: viewer.role === "admin" ? "Gordy" : viewer.fullName,
      audio_url: mediaType === "audio" ? signed?.signedUrl || null : null,
      audio_duration_seconds: mediaType === "audio" ? duration : null,
      image_url: mediaType === "image" ? signed?.signedUrl || null : null,
      image_width: mediaType === "image" ? width : null,
      image_height: mediaType === "image" ? height : null,
      file_url: mediaType === "file" ? signed?.signedUrl || null : null,
      file_name: mediaType === "file" ? filename : null,
      file_mime_type: mediaType === "file" ? contentType : null,
      file_size_bytes: mediaType === "file" ? file.size : null,
    },
  });
}
