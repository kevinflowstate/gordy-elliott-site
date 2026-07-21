import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveClientLifecycleStatus } from '@/lib/client-attention';


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

  // Always refresh the session so API routes can read auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    const { data: profile, error: roleError } = await adminSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      return NextResponse.json({ error: 'Unable to verify account access' }, { status: 503 });
    }

    const role = profile?.role;
    const requiresPasswordSetup = user.user_metadata?.requires_password_setup === true;

    if (role !== 'admin') {
      const { data: clientProfile, error: lifecycleError } = await adminSupabase
        .from('client_profiles')
        .select('id, lifecycle_status, lifecycle_resumes_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (lifecycleError || !clientProfile) {
        return NextResponse.json({ error: 'Unable to verify client access' }, { status: 503 });
      }

      let lifecycleStatus = resolveClientLifecycleStatus(
        clientProfile.lifecycle_status,
        clientProfile.lifecycle_resumes_at,
      );
      if (lifecycleStatus === 'active' && clientProfile.lifecycle_status !== 'active') {
        const { data: resumed, error: resumeError } = await adminSupabase.rpc('resume_client_if_due', {
          p_client_id: clientProfile.id,
        });
        if (resumeError) {
          return NextResponse.json({ error: 'Unable to resume client access' }, { status: 503 });
        }
        if (!resumed) {
          const { data: refreshed, error: refreshError } = await adminSupabase
            .from('client_profiles')
            .select('lifecycle_status, lifecycle_resumes_at')
            .eq('id', clientProfile.id)
            .maybeSingle();
          if (refreshError || !refreshed) {
            return NextResponse.json({ error: 'Unable to refresh client access' }, { status: 503 });
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
