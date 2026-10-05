import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isRecoveryType, recoveryDestination } from '@/lib/recovery-links';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account access', robots: { index: false, follow: false }, referrer: 'strict-origin' as const };

export default async function ConfirmAccountLink({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token_hash === 'string' ? params.token_hash : '';
  const type = params.type;
  const hasLink = /^[a-f0-9]{32,128}$/i.test(token) && isRecoveryType(type) && !params.error;
  const destination = recoveryDestination(typeof params.redirect === 'string' ? params.redirect : null);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const needsSetup = user?.user_metadata?.requires_password_setup === true;
  const button = 'block w-full rounded-xl bg-accent-bright px-5 py-3 text-center font-semibold text-white';

  return <main className="min-h-screen flex items-center justify-center px-6 py-12">
    <section className="w-full max-w-[440px] rounded-[20px] border border-border bg-bg-card p-7 sm:p-9">
      <p className="mb-6 text-sm font-black tracking-[0.16em]"><span className="text-accent-bright">AT</span> CAPACITY</p>
      <h1 className="font-heading text-2xl font-black mb-3">{hasLink ? 'Continue to your account' : 'Let’s get you back in'}</h1>
      <p className="text-text-secondary text-sm leading-relaxed mb-6">{hasLink
        ? 'Tap Continue below to open your secure password page. You can then use the same email and password in the iPhone app and on the web.'
        : user ? 'This link may already have been used or may have expired. You can continue your existing sign-in below, or request a fresh link.' : 'This link may already have been used or may have expired. Request a fresh link below to finish setting up your account.'}</p>
      {hasLink && <form action="/auth/callback" method="post" className="mb-6">
        <input type="hidden" name="token_hash" value={token} />
        <input type="hidden" name="type" value={String(type)} />
        <input type="hidden" name="redirect" value={destination} />
        <button type="submit" className={button}>Continue</button>
      </form>}
      {user && <div className="border-t border-border pt-5 mb-6">
        <p className="text-sm text-text-secondary mb-3 break-words">You’re already signed in as <strong className="text-text-primary">{user.email}</strong>.</p>
        <Link prefetch={false} className={button} href={needsSetup ? '/portal/settings?setup=true' : '/portal'}>
          {needsSetup ? 'Finish setting up this account' : 'Open this account'}
        </Link>
        <p className="text-xs text-text-secondary mt-3">Only continue if this is your account.</p>
      </div>}
      <Link prefetch={false} href="/login?access=setup" className="block text-center text-accent-bright font-semibold text-sm">Request a fresh setup link</Link>
      <Link prefetch={false} href="/login" className="mt-4 block text-center text-text-secondary text-sm">Already have a password? Sign in</Link>
    </section>
  </main>;
}
