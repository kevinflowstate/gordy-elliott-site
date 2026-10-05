export function isRecoveryType(value: unknown): value is 'recovery' | 'invite' {
  return value === 'recovery' || value === 'invite';
}

export function recoveryDestination(redirect: string | null) {
  // Password-link forms only navigate to password setup, never arbitrary URLs.
  return redirect === '/portal/settings?reset=true'
    ? '/portal/settings?reset=true'
    : '/portal/settings?setup=true';
}

export function recoveryConfirmationUrl(origin: string, token: string | null, type: string, redirect: string) {
  const url = new URL('/auth/confirm', origin);
  if (token) url.searchParams.set('token_hash', token);
  url.searchParams.set('type', type);
  url.searchParams.set('redirect', recoveryDestination(redirect));
  return url;
}
