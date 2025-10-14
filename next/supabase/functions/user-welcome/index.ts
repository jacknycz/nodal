console.info('user-welcome starting');
Deno.serve(async (req)=>{
  try {
    const expected = Deno.env.get('AUTH_HOOK_SECRET');
    if (!expected) {
      return new Response('Missing AUTH_HOOK_SECRET', {
        status: 500
      });
    }
    const received = req.headers.get('x-auth-hook-secret');
    if (!received || received !== expected) {
      return new Response('Unauthorized', {
        status: 401
      });
    }
    // Parse payload safely (Auth webhook, or manual invoke test)
    let payload = undefined;
    try {
      if (req.method !== 'GET' && req.headers.get('content-type')?.includes('application/json')) {
        payload = await req.json();
      }
    } catch (_) {
      // ignore bad JSON to avoid 500s; treat as empty body
      payload = undefined;
    }
    // TODO: Add any side effects here (e.g., insert profile, send email)
    // This template just echoes OK.
    const res = {
      ok: true,
      received_type: typeof payload,
      ts: new Date().toISOString()
    };
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    console.error('user-welcome error', e);
    return new Response('Internal Server Error', {
      status: 500
    });
  }
});
