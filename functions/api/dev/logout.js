import { SESSION_COOKIE_NAME } from './_auth.js';

export async function onRequestPost(context) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );

  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Dev Suite session cleared'
  }), {
    status: 200,
    headers
  });
}
