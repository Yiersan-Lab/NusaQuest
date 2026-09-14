import { isDevAuthenticated } from './_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const authenticated = await isDevAuthenticated(request, env);

  return new Response(JSON.stringify({
    authenticated,
    status: 'ok'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
