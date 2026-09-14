/**
 * Cloudflare Pages Function: /api/[[catchall]]
 * Fallback handler for database and config requests.
 */

export async function onRequest(context) {
  const { request, params } = context;
  const pathParts = params.catchall || [];
  const endpoint = pathParts.join('/');

  const url = new URL(request.url);

  // If GET request, attempt to fetch the static data file from origin
  if (request.method === 'GET') {
    let staticPath = '';
    if (endpoint === 'dialogues') staticPath = '/data/dialogues.json';
    else if (endpoint === 'maps') staticPath = '/data/maps.json';
    else if (endpoint === 'quests') staticPath = '/data/quests.json';
    else if (endpoint === 'tile-map') staticPath = '/data/tile_map.json';
    else if (endpoint === 'tilesheets') staticPath = '/assets/tiles/tilesheets.json';
    else if (endpoint === 'npc-placements') staticPath = '/data/npc_placements.json';

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

  // If POST request in serverless environment, return simulated success
  if (request.method === 'POST') {
    return new Response(JSON.stringify({ success: true, readOnlyNotice: 'Serverless deployment environment' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  return new Response(JSON.stringify({ error: `Endpoint /api/${endpoint} not found` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
