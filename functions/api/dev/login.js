import { verifyDevPassword, createDevSessionToken, SESSION_COOKIE_NAME } from './_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json().catch(() => ({}));
    const { password } = body;
    
    const expectedPassword = env.DEV_SUITE_PASSWORD || 'nusaquest-dev-2026';
    
    if (!password || !(await verifyDevPassword(password, expectedPassword))) {
      return new Response(JSON.stringify({
        error: 'Password Dev Suite salah.',
        status: 'error'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const token = await createDevSessionToken(env.DEV_SESSION_SECRET);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
    );

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Dev Suite unlocked successfully',
      token
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      status: 'error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
