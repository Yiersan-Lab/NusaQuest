/**
 * Cloudflare Pages Function: /api/[[catchall]]
 * Dynamic JSON database and config handler backed by Cloudflare KV.
 */

export async function onRequest(context) {
  const { request, params, env } = context;
  const pathParts = params.catchall || [];
  const endpoint = pathParts.join('/');

  const url = new URL(request.url);

  // 1. GET requests: check KV first, fallback to static JSON asset file
  if (request.method === 'GET') {
    if (env.NUSAQUEST_STORAGE) {
      try {
        if (endpoint === 'npc-config') {
          const dialogues = await env.NUSAQUEST_STORAGE.get('dialogues', 'json') || {};
          const npcPlacements = await env.NUSAQUEST_STORAGE.get('npc-placements', 'json') || {};
          return new Response(JSON.stringify({ dialogues, npcPlacements }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }
          });
        }

        const kvData = await env.NUSAQUEST_STORAGE.get(endpoint, 'json');
        if (kvData !== null) {
          return new Response(JSON.stringify(kvData), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache'
            }
          });
        }
      } catch (e) {
        console.warn(`[KV GET] Error reading ${endpoint}:`, e);
      }
    }

    let staticPath = '';
    if (endpoint === 'dialogues') staticPath = '/data/dialogues.json';
    else if (endpoint === 'maps') staticPath = '/data/maps.json';
    else if (endpoint === 'quests') staticPath = '/data/quests.json';
    else if (endpoint === 'tile-map') staticPath = '/data/tile_map.json';
    else if (endpoint === 'tilesheets') staticPath = '/assets/tiles/tilesheets.json';
    else if (endpoint === 'npc-placements') staticPath = '/data/npc_placements.json';
    else if (endpoint === 'npc/quiz/get') staticPath = '/data/quizzes.json';

    if (staticPath) {
      try {
        const fileUrl = new URL(staticPath, url.origin);
        const fileRes = await fetch(fileUrl.toString());
        if (fileRes.ok) {
          const data = await fileRes.json();
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      } catch (e) {}
    }
  }

  // 2. POST requests: write to KV!
  if (request.method === 'POST') {
    try {
      const payload = await request.json();
      if (env.NUSAQUEST_STORAGE) {
        if (endpoint === 'npc-config') {
          if (payload.dialogues) {
            await env.NUSAQUEST_STORAGE.put('dialogues', JSON.stringify(payload.dialogues));
          }
          if (payload.npcPlacements) {
            await env.NUSAQUEST_STORAGE.put('npc-placements', JSON.stringify(payload.npcPlacements));
          }
          await env.NUSAQUEST_STORAGE.put('npc-config', JSON.stringify(payload));
        } else {
          await env.NUSAQUEST_STORAGE.put(endpoint, JSON.stringify(payload));
        }

        return new Response(JSON.stringify({ success: true, savedTo: 'Cloudflare KV' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({ success: true, notice: 'KV not bound, simulated save' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  return new Response(JSON.stringify({ error: `Endpoint /api/${endpoint} not found` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
