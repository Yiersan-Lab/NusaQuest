/**
 * Cloudflare Pages Function: /api/status
 */

export async function onRequestGet(context) {
  const { env } = context;
  const groqConfigured = !!(env.GROQ_API_KEY && env.GROQ_API_KEY.trim() !== '');
  const hfConfigured = !!(env.HF_TOKEN && env.HF_TOKEN.trim() !== '');
  const hfSpaceUrl = env.HF_SPACE_URL || 'https://maselonn-nusattse.hf.space';

  return new Response(JSON.stringify({
    status: 'ok',
    groqConfigured,
    model: groqConfigured ? 'qwen/qwen3.8-27b' : 'smart-fallback',
    hfConfigured,
    hfSpaceUrl,
    platform: 'cloudflare-pages'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
