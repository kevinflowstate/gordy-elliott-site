import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveClientLifecycleStatus } from '@/lib/client-attention';
import { isFounderExperience, isFounderRestrictedPath } from '@/lib/client-experience';
import { withTimeout } from '@/lib/operation-timeout';

const SUPABASE_OPERATION_TIMEOUT_MS = 3_000;

function isUnauthenticatedError(error: { name?: string; status?: number } | null) {
  if (!error) return false;
  return error.name === 'AuthSessionMissingError'
    || error.status === 400
    || error.status === 401
    || error.status === 403;
}

function serviceUnavailableResponse(path: string) {
  if (path.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'AT CAPACITY is temporarily reconnecting. Please try again.', code: 'SERVICE_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '10' } },
    );
  }

  return new NextResponse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reconnecting | AT CAPACITY</title><style>
body{margin:0;background:#09090b;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}
main{max-width:440px;text-align:center}.mark{color:#e040d0;font-weight:800;letter-spacing:.14em;font-size:13px}h1{font-size:28px;line-height:1.15;margin:18px 0 12px}p{color:#b8b8c2;line-height:1.6;margin:0 0 24px}button{border:0;border-radius:14px;background:#e040d0;color:#09090b;font:inherit;font-weight:750;padding:13px 20px;cursor:pointer}
</style></head><body><main><div class="mark">AT CAPACITY</div><h1>We’re reconnecting</h1><p>Your data is safe. The app is taking longer than expected to connect. Please try again in a few seconds.</p><button onclick="location.reload()">Try again</button></main></body></html>`, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '10',
    },
  });
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const path = request.nextUrl.pathname;
  const isNativePushRemoval = path.startsWith('/api/push/native') && request.method === 'DELETE';
  const isClientAppApi =
    path.startsWith('/api/portal') ||
    path.startsWith('/api/inbox') ||
    path.startsWith('/api/notifications') ||
    path.startsWith('/api/calendar') ||
    path.startsWith('/api/push/subscribe') ||
    (path.startsWith('/api/push/native') && !isNativePushRemoval);

  // Subdomain routing
  if (hostname.startsWith('portal.')) {
    if (path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  const isProtectedPage = path.startsWith('/portal')
    || path.startsWith('/admin')
    || path.startsWith('/account-paused');

  // Public pages and independently authenticated webhooks/routes do not need
  // a Supabase round trip in middleware.
  if (!isProtectedPage && !isClientAppApi) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const authResult = await withTimeout(
      supabase.auth.getUser(),
      SUPABASE_OPERATION_TIMEOUT_MS,
      'Supabase authentication',
    );
    if (authResult.error && !isUnauthenticatedError(authResult.error)) {
      console.error('[middleware] Supabase authentication unavailable', {
        path,
        error: authResult.error.name,
        status: authResult.error.status,
      });
      return serviceUnavailableResponse(path);
    }
    user = authResult.data.user;
  } catch (error) {
    console.error('[middleware] Supabase authentication timed out', { path, error: String(error) });
    return serviceUnavailableResponse(path);
  }

  // Protect portal and admin routes
  if ((path.startsWith('/portal') || path.startsWith('/admin') || path.startsWith('/account-paused')) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Role-based routing: admin sees admin, client sees portal, never cross
  if ((path.startsWith('/admin') || path.startsWith('/portal') || path.startsWith('/account-paused') || isClientAppApi) && user) {
    // Use service role key to bypass RLS for role lookup
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    let profile;
    let roleError;
    try {
      const result = await withTimeout(
        adminSupabase.from('users').select('role').eq('id', user.id).single(),
        SUPABASE_OPERATION_TIMEOUT_MS,
        'account role lookup',
      );
      profile = result.data;
      roleError = result.error;
    } catch (error) {
      console.error('[middleware] Account role lookup timed out', { path, error: String(error) });
      return serviceUnavailableResponse(path);
    }

    if (roleError) {
      return serviceUnavailableResponse(path);
    }

    const role = profile?.role;
    const requiresPasswordSetup = user.user_metadata?.requires_password_setup === true;

    if (role !== 'admin') {
      let clientProfile;
      let lifecycleError;
      try {
        const result = await withTimeout(
          adminSupabase
            .from('client_profiles')
            .select('id, lifecycle_status, lifecycle_resumes_at, experience_mode')
            .eq('user_id', user.id)
            .maybeSingle(),
          SUPABASE_OPERATION_TIMEOUT_MS,
          'client lifecycle lookup',
        );
        clientProfile = result.data;
        lifecycleError = result.error;
      } catch (error) {
        console.error('[middleware] Client lifecycle lookup timed out', { path, error: String(error) });
        return serviceUnavailableResponse(path);
      }

      if (lifecycleError || !clientProfile) {
        return serviceUnavailableResponse(path);
      }

      let lifecycleStatus = resolveClientLifecycleStatus(
        clientProfile.lifecycle_status,
        clientProfile.lifecycle_resumes_at,
      );
      if (lifecycleStatus === 'active' && clientProfile.lifecycle_status !== 'active') {
        let resumed;
        let resumeError;
        try {
          const result = await withTimeout(
            adminSupabase.rpc('resume_client_if_due', { p_client_id: clientProfile.id }),
            SUPABASE_OPERATION_TIMEOUT_MS,
            'client resume check',
          );
          resumed = result.data;
          resumeError = result.error;
        } catch (error) {
          console.error('[middleware] Client resume check timed out', { path, error: String(error) });
          return serviceUnavailableResponse(path);
        }
        if (resumeError) {
          return serviceUnavailableResponse(path);
        }
        if (!resumed) {
          let refreshed;
          let refreshError;
          try {
            const result = await withTimeout(
              adminSupabase
                .from('client_profiles')
                .select('lifecycle_status, lifecycle_resumes_at')
                .eq('id', clientProfile.id)
                .maybeSingle(),
              SUPABASE_OPERATION_TIMEOUT_MS,
              'client lifecycle refresh',
            );
            refreshed = result.data;
            refreshError = result.error;
          } catch (error) {
            console.error('[middleware] Client lifecycle refresh timed out', { path, error: String(error) });
            return serviceUnavailableResponse(path);
          }
          if (refreshError || !refreshed) {
            return serviceUnavailableResponse(path);
          }
          lifecycleStatus = resolveClientLifecycleStatus(
            refreshed.lifecycle_status,
            refreshed.lifecycle_resumes_at,
          );
        }
      }

      if (lifecycleStatus === 'access_frozen') {
        if (isClientAppApi) {
          return NextResponse.json(
            { error: 'Coaching access is paused', code: 'ACCESS_FROZEN' },
            { status: 423 },
          );
        }
        if (path.startsWith('/portal')) {
          const url = request.nextUrl.clone();
          url.pathname = '/account-paused';
          url.search = '';
          return NextResponse.redirect(url);
        }
      } else if (path.startsWith('/account-paused')) {
        const url = request.nextUrl.clone();
        url.pathname = '/portal';
        url.search = '';
        return NextResponse.redirect(url);
      }

      if (isFounderExperience(clientProfile.experience_mode) && isFounderRestrictedPath(path)) {
        if (path.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'This feature is not included in the Founder Dashboard experience' },
            { status: 403 },
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = '/portal';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }

    // First-login enforcement for clients created without a password
    if (path.startsWith('/portal') && role !== 'admin' && requiresPasswordSetup) {
      const isSettingsPage = path.startsWith('/portal/settings');
      const setupMode = request.nextUrl.searchParams.get('setup') === 'true';
      if (!isSettingsPage || !setupMode) {
        const url = request.nextUrl.clone();
        url.pathname = '/portal/settings';
        url.searchParams.set('setup', 'true');
        return NextResponse.redirect(url);
      }
    }

    // Admin trying to access portal -> redirect to admin
    if (path.startsWith('/portal') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    // Client (or unknown role) trying to access admin -> redirect to portal
    if (path.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|start\\.html|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
