/**
 * Cloudflare Pages Function: /api/tts
 * Proxies TTS generation requests to NusaTTSE on Hugging Face Spaces.
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const HF_SPACE_URL = env.HF_SPACE_URL || 'https://maselonn-nusattse.hf.space';
  const HF_TOKEN = env.HF_TOKEN || '';

  try {
    const body = await request.json().catch(() => ({}));
    const { text, voice, speed = 1.0, pitch = 0 } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const voiceId = voice || 'jv-ID-SitiNeural';
    const headers = { 'Content-Type': 'application/json' };
    if (HF_TOKEN) {
      headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    }

    // Step 1: Submit TTS job to Gradio API
    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/tts_generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [text, voiceId, parseFloat(speed) || 1.0, parseInt(pitch) || 0, null] })
    });

    if (!callRes.ok) {
      const errText = await callRes.text();
      return new Response(JSON.stringify({
        error: `HF Space error (${callRes.status}): ${errText}`,
        isRateLimit: callRes.status === 429 || errText.includes('quota') || errText.includes('ZeroGPU')
      }), {
        status: callRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: 'No event_id returned from TTS service' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Step 2: Stream result for event_id
    const streamHeaders = {};
    if (HF_TOKEN) streamHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;

    const eventRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/tts_generate/${event_id}`, {
      headers: streamHeaders
    });
    const streamText = await eventRes.text();

    if (streamText.includes('ZeroGPU') || streamText.includes('quota exceeded') || streamText.includes('event: error')) {
      return new Response(JSON.stringify({
        error: 'ZeroGPU quota exceeded on Hugging Face Spaces. Configure HF_TOKEN in environment variables.',
        isRateLimit: true
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const match = streamText.match(/"url":\s*"([^"]+)"/);
    if (match && match[1]) {
      const audioUrl = match[1];
      const audioRes = await fetch(audioUrl);
      if (audioRes.ok) {
        const arrayBuf = await audioRes.arrayBuffer();
        return new Response(arrayBuf, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'TTS audio stream URL not found', rawStream: streamText }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
