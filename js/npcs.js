class NpcManager {
  constructor() {
    this.initNpcs();
  }

  initNpcs() {
    if (typeof fetch !== 'undefined') {
      fetch('/api/npc-placements')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .catch(() => fetch('/data/npc_placements.json').then(r => r.json()))
        .then(data => {
          if (data && typeof data === 'object') {
            for (const [mapId, list] of Object.entries(data)) {
              if (MAPS[mapId]) MAPS[mapId].npcs = list;
            }
          }
        })
        .catch(() => {});
    }
  }

  getNpcsForMap(mapId) {
    const mapDef = MAPS[mapId];
    if (!mapDef || !mapDef.npcs) return [];

    return mapDef.npcs.map(npcRef => {
      const dialogData = DIALOGUES[npcRef.id] || {};
      const npcName = dialogData.name || npcRef.name || (npcRef.id ? npcRef.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'NPC');
      const npcRole = dialogData.role || npcRef.role || 'Warga Desa';

      let lines = (dialogData.lines && dialogData.lines.length > 0) ? dialogData.lines : (npcRef.dialogue || npcRef.lines || []);
      if (!lines || lines.length === 0) {
        lines = [
          {
            javanese: `Sugeng rawuh! Kula ${npcName}.`,
            indonesian: `Selamat datang! Saya ${npcName}.`
          }
        ];
      }

      return {
        id: npcRef.id,
        name: npcName,
        role: npcRole,
        tileX: npcRef.tileX !== undefined ? npcRef.tileX : 0,
        tileY: npcRef.tileY !== undefined ? npcRef.tileY : 0,
        dir: npcRef.dir !== undefined ? npcRef.dir : 0,
        charIndex: dialogData.charIndex !== undefined ? dialogData.charIndex : (npcRef.charIndex !== undefined ? npcRef.charIndex : 0),
        col: dialogData.col !== undefined ? dialogData.col : npcRef.col,
        row: dialogData.row !== undefined ? dialogData.row : npcRef.row,
        animList: dialogData.animList || npcRef.animList || null,
        dialogue: lines
      };
    });
  }

  getAdjacentNpc(player, currentMapId) {
    const npcs = this.getNpcsForMap(currentMapId);
    for (const npc of npcs) {
      const dx = Math.abs(player.tileX - npc.tileX);
      const dy = Math.abs(player.tileY - npc.tileY);
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        return npc;
      }
    }
    return null;
  }

  drawNpc(ctx, npc, tileSize = 48) {
    const img = AssetManager.images.characters;
    const px = npc.tileX * tileSize;
    const py = npc.tileY * tileSize;

    if (img && img.complete && img.naturalWidth !== 0) {
      let srcX, srcY;
      const dir = npc.dir !== undefined ? npc.dir : 0;
      if (npc.col !== undefined && npc.col !== null && npc.row !== undefined && npc.row !== null) {
        const baseRow = Math.floor(npc.row / 4) * 4;
        srcX = npc.col * 26;
        srcY = (baseRow + (dir % 4)) * 36;
      } else {
        const cIdx = npc.charIndex !== undefined ? npc.charIndex : 0;
        const baseRow = Math.floor(cIdx / 4) * 4;
        const baseCol = (cIdx % 4) * 3 + 1;
        srcX = baseCol * 26;
        srcY = (baseRow + (dir % 4)) * 36;
      }
      const spriteW = Math.round(tileSize * 0.75);
      const spriteH = Math.round(tileSize * 1.0833);
      const offsetX = Math.round((tileSize - spriteW) / 2);
      const offsetY = Math.round(tileSize - spriteH - (tileSize * 0.08));
      ctx.drawImage(img, srcX, srcY, 26, 36, px + offsetX, py + offsetY, spriteW, spriteH);
    } else {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(px + Math.round(tileSize * 0.2), py + Math.round(tileSize * 0.2), Math.round(tileSize * 0.6), Math.round(tileSize * 0.7));
    }
  }
}
