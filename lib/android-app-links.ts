import appIdentity from "@/config/app-identity.json";

export function createAndroidAppLinks(fingerprints: string | undefined) {
  const hashes = [...new Set((fingerprints || '').split(',').map((hash) => hash.trim().toUpperCase()))]
    .filter((hash) => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(hash));
  return hashes.length ? [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: appIdentity.bundleId,
      sha256_cert_fingerprints: hashes,
    },
  }] : [];
}
