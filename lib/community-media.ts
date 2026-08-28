export const COMMUNITY_MEDIA_BUCKET = "shift-community-media";
export const MAX_COMMUNITY_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_COMMUNITY_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_COMMUNITY_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_COMMUNITY_AUDIO_SECONDS = 180;

export const COMMUNITY_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

export const COMMUNITY_AUDIO_TYPES = new Map([
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/mpeg", "mp3"],
  ["audio/aac", "aac"],
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
]);

export const COMMUNITY_FILE_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);

export function readCommunityImageSize(contentType: string, bytes: Uint8Array): { width: number; height: number } | null {
  if (contentType === "image/png") {
    const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !expected.every((value, index) => bytes[index] === value)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (contentType !== "image/jpeg" || bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += length + 2;
  }
  return null;
}

export function hasCommunityAudioSignature(contentType: string, bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  if (contentType === "audio/mp4" || contentType === "audio/x-m4a") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  if (contentType === "audio/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (contentType === "audio/ogg") return String.fromCharCode(...bytes.slice(0, 4)) === "OggS";
  if (contentType === "audio/mpeg") return String.fromCharCode(...bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (contentType === "audio/aac") return bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9);
  return false;
}

export function hasCommunityFileSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (contentType === "text/plain" || contentType === "text/csv") return bytes.length > 0 && !bytes.slice(0, 512).includes(0);
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return hasZipMarker(bytes, "word/");
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return hasZipMarker(bytes, "xl/");
  }
  return false;
}

function hasZipMarker(bytes: Uint8Array, marker: string) {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const needle = new TextEncoder().encode(marker);
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

export function safeCommunityFilename(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim()
    .slice(0, 180);
}
