class Player {
  constructor(tileX = 7, tileY = 4, tileSize = 48) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.pixelX = tileX * tileSize;
    this.pixelY = tileY * tileSize;
    this.targetTileX = tileX;
    this.targetTileY = tileY;
    this.dir = 0;
    this.isMoving = false;
    this.moveStartTime = 0;
    this.moveDuration = 180;
    this.animFrame = 0;
    this.charIndex = 0;
    this.onPositionChange = null;
  }

  setPosition(tx, ty, dir = 0, tileSize = 48) {
    this.tileX = tx;
    this.tileY = ty;
    this.targetTileX = tx;
    this.targetTileY = ty;
    this.pixelX = tx * tileSize;
    this.pixelY = ty * tileSize;
    this.dir = dir;
    this.isMoving = false;
    this.animFrame = 0;
  }

  updatePixelPosition(tileSize = 48) {
    this.pixelX = this.tileX * tileSize;
    this.pixelY = this.tileY * tileSize;
  }

  update(now, currentMap, activeNpcDialogue, keysPressed, checkWarpCallback, tileSize = 48) {
    if (activeNpcDialogue) return;

    if (this.isMoving) {
      const elapsed = now - this.moveStartTime;
      const progress = Math.min(elapsed / this.moveDuration, 1);

      const startX = this.tileX * tileSize;
      const startY = this.tileY * tileSize;
      const targetX = this.targetTileX * tileSize;
      const targetY = this.targetTileY * tileSize;

      this.pixelX = startX + (targetX - startX) * progress;
      this.pixelY = startY + (targetY - startY) * progress;

      if (progress < 0.25) this.animFrame = 1;
      else if (progress < 0.5) this.animFrame = 0;
      else if (progress < 0.75) this.animFrame = 2;
      else this.animFrame = 0;

      if (progress >= 1) {
        this.isMoving = false;
        this.tileX = this.targetTileX;
        this.tileY = this.targetTileY;
        this.pixelX = this.tileX * tileSize;
        this.pixelY = this.tileY * tileSize;
        this.animFrame = 0;

        if (typeof this.onPositionChange === 'function') {
          this.onPositionChange(this.tileX, this.tileY, this.dir);
        }

        if (checkWarpCallback) {
          checkWarpCallback(this.tileX, this.tileY);
        }
      }
      return;
    }

    let nextX = this.tileX;
    let nextY = this.tileY;
    let newDir = this.dir;
    let keyHit = false;

    const binds = window.KEYBINDS || {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight']
    };

    const isPressed = (action) => {
      const list = binds[action] || [];
      return list.some(k => keysPressed[k]);
    };

    if (isPressed('up')) {
      nextY--;
      newDir = 3;
      keyHit = true;
    } else if (isPressed('down')) {
      nextY++;
      newDir = 0;
      keyHit = true;
    } else if (isPressed('left')) {
      nextX--;
      newDir = 1;
      keyHit = true;
    } else if (isPressed('right')) {
      nextX++;
      newDir = 2;
      keyHit = true;
    }

    if (keyHit) {
      const dirChanged = this.dir !== newDir;
      this.dir = newDir;

      if (this.isWalkable(nextX, nextY, currentMap)) {
        this.isMoving = true;
        this.targetTileX = nextX;
        this.targetTileY = nextY;
        this.moveStartTime = now;
      } else if (dirChanged && typeof this.onPositionChange === 'function') {
        this.onPositionChange(this.tileX, this.tileY, this.dir);
      }
    }
  }

  isWalkable(tx, ty, currentMap) {
    if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) return false;
    if (currentMap.collision[ty][tx] === 1) return false;

    if (currentMap.activeNpcs) {
      for (const npc of currentMap.activeNpcs) {
        if (npc.tileX === tx && npc.tileY === ty) return false;
      }
    }
    return true;
  }

  draw(ctx, tileSize = 48) {
    const img = AssetManager.images.characters;
    const px = this.pixelX;
    const py = this.pixelY;

    if (img && img.complete && img.naturalWidth !== 0) {
      const srcX = this.charIndex * 3 * 26 + this.animFrame * 26;
      const srcY = this.dir * 36;
      const spriteW = Math.round(tileSize * 0.75);
      const spriteH = Math.round(tileSize * 1.0833);
      const offsetX = Math.round((tileSize - spriteW) / 2);
      const offsetY = Math.round(tileSize - spriteH - (tileSize * 0.08));
      ctx.drawImage(img, srcX, srcY, 26, 36, px + offsetX, py + offsetY, spriteW, spriteH);
    } else {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(px + Math.round(tileSize * 0.2), py + Math.round(tileSize * 0.2), Math.round(tileSize * 0.6), Math.round(tileSize * 0.7));
    }
  }
}
