export const ALLOWED_AUDIO_TYPES = new Map([
  ["audio/mp4", "m4a"], ["audio/x-m4a", "m4a"], ["audio/mpeg", "mp3"],
  ["audio/aac", "aac"], ["audio/webm", "webm"], ["audio/ogg", "ogg"],
]);

export function hasExpectedAudioSignature(contentType: string, bytes: Uint8Array) {
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

