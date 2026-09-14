const MAPS = {};

window.mapsLoadPromise = (function() {
  if (typeof fetch !== 'undefined') {
    return fetch('/api/maps')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(() => fetch('/data/maps.json').then(r => r.json()))
      .then(data => {
        if (data && typeof data === 'object') {
          for (const [mapId, mapDef] of Object.entries(data)) {
            MAPS[mapId] = mapDef;
          }
          console.log('NusaQuest: Successfully loaded MAPS from API/KV');
        }
        return MAPS;
      })
      .catch(err => {
        console.error('Failed to load maps:', err);
        return MAPS;
      });
  }
  return Promise.resolve(MAPS);
})();
