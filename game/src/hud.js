// HUD System - Minimap, crosshair, wanted stars, compass, health/armor, money, mission objectives
import { WORLD, PLAYER, PALETTE, FONT, FONT_MONO, MISSION } from './config.js';
import { distance, angleTo, normalizeAngle } from './world.js';

export function createHUD(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    ctx,
    minimap: {
      x: 20,
      y: 20,
      size: WORLD.minimap.size,
      zoom: WORLD.minimap.zoom,
      border: WORLD.minimap.border,
      rotation: 0,
      showNames: true,
    },
    crosshair: {
      size: 24,
      gap: 8,
      thickness: 2,
      color: PALETTE.crosshair,
      outerColor: PALETTE.crosshairOuter,
      dynamic: true,
    },
    wantedStars: {
      x: canvas.width - 180,
      y: 20,
      starSize: 18,
      spacing: 4,
      maxStars: PLAYER.wantedMaxStars,
    },
    healthBar: {
      x: 20,
      y: canvas.height - 140,
      width: 200,
      height: 20,
      borderRadius: 4,
    },
    armorBar: {
      x: 20,
      y: canvas.height - 110,
      width: 200,
      height: 14,
      borderRadius: 3,
    },
    staminaBar: {
      x: 20,
      y: canvas.height - 85,
      width: 200,
      height: 10,
      borderRadius: 2,
    },
    money: {
      x: canvas.width - 200,
      y: canvas.height - 40,
    },
    weapon: {
      x: canvas.width - 200,
      y: canvas.height - 80,
    },
    vehicleInfo: {
      x: canvas.width - 250,
      y: canvas.height - 120,
    },
    compass: {
      x: canvas.width / 2,
      y: 40,
      radius: 100,
      markerSize: 8,
    },
    missionDisplay: {
      x: canvas.width / 2,
      y: 80,
      maxWidth: 400,
    },
    zoneName: {
      x: canvas.width / 2,
      y: 130,
    },
    messages: [],
    messageY: canvas.height - 200,
    subtitles: [],
    subtitleY: canvas.height / 2 + 150,
    // Animation state
    wantedFlash: 0,
    wantedFlashDir: 1,
    healthFlash: 0,
    armorFlash: 0,
    crosshairSpread: 0,
    minimapRotation: 0,
    showFullMap: false,
  };
}

export function updateHUD(hud, world, dt) {
  const player = world.player;
  
  // Wanted star flash animation
  if (player.wantedLevel > 0) {
    hud.wantedFlash += dt * 8;
    if (hud.wantedFlash > 1) {
      hud.wantedFlash = 1;
      hud.wantedFlashDir = -1;
    } else if (hud.wantedFlash < 0.3) {
      hud.wantedFlashDir = 1;
    }
    hud.wantedFlash += dt * 8 * hud.wantedFlashDir;
  } else {
    hud.wantedFlash = 0;
  }
  
  // Health flash when damaged
  if (player.health < PLAYER.maxHealth * 0.3) {
    hud.healthFlash = Math.max(hud.healthFlash, 0.5);
  }
  hud.healthFlash = Math.max(0, hud.healthFlash - dt * 2);
  
  // Armor flash
  if (player.armor > 0 && player.armor < PLAYER.maxArmor * 0.3) {
    hud.armorFlash = Math.max(hud.armorFlash, 0.5);
  }
  hud.armorFlash = Math.max(0, hud.armorFlash - dt * 2);
  
  // Crosshair spread based on movement/accuracy
  const baseSpread = player.inVehicle ? 0 : (player.input.sprint ? 8 : 2);
  const moveSpread = Math.abs(player.velocityX) + Math.abs(player.velocityY) > 0 ? 4 : 0;
  hud.crosshairSpread = lerp(hud.crosshairSpread, baseSpread + moveSpread, dt * 10);
  
  // Minimap rotation follows player when not in full map mode
  if (!hud.showFullMap) {
    hud.minimapRotation = lerpAngle(hud.minimapRotation, player.angle, dt * 5);
  }
  
  // Update messages
  hud.messages = world.messages || [];
  
  // Update subtitles (mission dialogue)
  hud.subtitles = world.subtitles || [];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  const diff = normalizeAngle(b - a);
  return a + diff * t;
}

export function renderHUD(hud, world) {
  const ctx = hud.ctx;
  const player = world.player;
  const canvas = hud.canvas;
  
  ctx.save();
  ctx.font = `14px ${FONT}`;
  ctx.textBaseline = 'top';
  
  // Render minimap
  renderMinimap(hud, world);
  
  // Render crosshair (only on foot and aiming)
  if (!player.inVehicle && (player.input.aim || player.input.attack)) {
    renderCrosshair(hud, player);
  }
  
  // Render wanted stars
  renderWantedStars(hud, player);
  
  // Render health/armor/stamina bars
  renderHealthArmorStamina(hud, player);
  
  // Render money
  renderMoney(hud, player);
  
  // Render weapon info
  renderWeapon(hud, player);
  
  // Render vehicle info
  if (player.inVehicle) {
    renderVehicleInfo(hud, player, world);
  }
  
  // Render compass
  renderCompass(hud, player);
  
  // Render mission objective
  renderMissionObjective(hud, world);
  
  // Render zone name
  renderZoneName(hud, world);
  
  // Render messages
  renderMessages(hud);
  
  // Render subtitles
  renderSubtitles(hud);
  
  // Render full map overlay if open
  if (hud.showFullMap || player.input.map) {
    renderFullMap(hud, world);
  }
  
  ctx.restore();
}

function renderMinimap(hud, world) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const player = world.player;
  const cam = world.camera;
  
  ctx.save();
  
  // Minimap background
  ctx.fillStyle = 'rgba(26, 26, 34, 0.9)';
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = m.border;
  
  const mapX = m.x;
  const mapY = m.y;
  const mapSize = m.size;
  
  // Rounded rect
  const radius = 8;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapSize, mapSize, radius);
  ctx.fill();
  ctx.stroke();
  
  // Clip to minimap bounds
  ctx.clip();
  
  // Translate to center for rotation
  const centerX = mapX + mapSize / 2;
  const centerY = mapY + mapSize / 2;
  
  ctx.translate(centerX, centerY);
  if (!hud.showFullMap) {
    ctx.rotate(-hud.minimapRotation);
  }
  ctx.translate(-centerX, -centerY);
  
  // Draw world sectors (districts)
  drawMinimapDistricts(hud, world, centerX, centerY);
  
  // Draw roads
  drawMinimapRoads(hud, world, centerX, centerY);
  
  // Draw GPS route
  if (world.gpsRoute && world.gpsRoute.length > 1) {
    drawMinimapGPS(hud, world, centerX, centerY);
  }
  
  // Draw mission markers
  drawMinimapMissions(hud, world, centerX, centerY);
  
  // Draw pickups
  drawMinimapPickups(hud, world, centerX, centerY);
  
  // Draw vehicles (traffic)
  drawMinimapVehicles(hud, world, centerX, centerY);
  
  // Draw pedestrians
  drawMinimapPeds(hud, world, centerX, centerY);
  
  // Draw police
  drawMinimapPolice(hud, world, centerX, centerY);
  
  // Draw player
  drawMinimapPlayer(hud, player, centerX, centerY);
  
  // Draw camera view indicator
  drawMinimapCamera(hud, world, centerX, centerY);
  
  // Draw north indicator
  drawMinimapNorth(hud, centerX, centerY);
  
  ctx.restore();
  
  // Minimap border
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = m.border;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapSize, mapSize, radius);
  ctx.stroke();
  
  // Minimap label
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `10px ${FONT}`;
  ctx.fillText('MAP', mapX + 4, mapY + 2);
}

function drawMinimapDistricts(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  
  for (const district of world.districts || []) {
    if (district.ring) continue;
    const x = cx + (district.x * WORLD.sectorSize - world.player.x) * zoom;
    const y = cy + (district.y * WORLD.sectorSize - world.player.y) * zoom;
    const w = district.w * WORLD.sectorSize * zoom;
    const h = district.h * WORLD.sectorSize * zoom;
    
    ctx.fillStyle = district.color + '40';
    ctx.fillRect(x, y, w, h);
  }
}

function drawMinimapRoads(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  ctx.strokeStyle = PALETTE.roadLine + '80';
  ctx.lineWidth = 1 / zoom;
  
  // Only draw roads near player (or all if full map)
  const viewRange = hud.showFullMap ? WORLD.width : 500 / zoom;
  const startSX = Math.max(0, Math.floor((player.x - viewRange) / WORLD.sectorSize));
  const endSX = Math.min(WORLD.gridSize, Math.ceil((player.x + viewRange) / WORLD.sectorSize));
  const startSY = Math.max(0, Math.floor((player.y - viewRange) / WORLD.sectorSize));
  const endSY = Math.min(WORLD.gridSize, Math.ceil((player.y + viewRange) / WORLD.sectorSize));
  
  for (let sy = startSY; sy < endSY; sy++) {
    for (let sx = startSX; sx < endSX; sx++) {
      const sectorX = sx * WORLD.sectorSize;
      const sectorY = sy * WORLD.sectorSize;
      const localCX = cx + (sectorX + WORLD.sectorSize / 2 - player.x) * zoom;
      const localCY = cy + (sectorY + WORLD.sectorSize / 2 - player.y) * zoom;
      
      // Main roads
      if (sx % 4 === 0) {
        const x = cx + (sectorX - player.x) * zoom;
        const y = cy + (sectorY - player.y) * zoom;
        const w = WORLD.sectorSize * zoom;
        const hw = (WORLD.sectorSize / 4) * zoom;
        ctx.beginPath();
        ctx.moveTo(x + w/2 - hw, localCY);
        ctx.lineTo(x + w/2 + hw, localCY);
        ctx.stroke();
      }
      if (sy % 4 === 0) {
        const x = cx + (sectorX - player.x) * zoom;
        const y = cy + (sectorY - player.y) * zoom;
        const h = WORLD.sectorSize * zoom;
        const hw = (WORLD.sectorSize / 4) * zoom;
        ctx.beginPath();
        ctx.moveTo(localCX, y + h/2 - hw);
        ctx.lineTo(localCX, y + h/2 + hw);
        ctx.stroke();
      }
      
      // Local roads
      ctx.strokeStyle = PALETTE.roadLine + '40';
      ctx.lineWidth = 0.5 / zoom;
      // Vertical
      const vx = cx + (sectorX - player.x) * zoom;
      const vy = cy + (sectorY - player.y) * zoom;
      const vw = WORLD.sectorSize * zoom;
      const lw = (WORLD.sectorSize / 8) * zoom;
      ctx.beginPath();
      ctx.moveTo(vx + vw/2 - lw, vy);
      ctx.lineTo(vx + vw/2 - lw, vy + vw);
      ctx.moveTo(vx + vw/2 + lw, vy);
      ctx.lineTo(vx + vw/2 + lw, vy + vw);
      ctx.stroke();
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(vx, vy + vw/2 - lw);
      ctx.lineTo(vx + vw, vy + vw/2 - lw);
      ctx.moveTo(vx, vy + vw/2 + lw);
      ctx.lineTo(vx + vw, vy + vw/2 + lw);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.roadLine + '80';
      ctx.lineWidth = 1 / zoom;
    }
  }
  
  // Highway ring
  if (hud.showFullMap) {
    ctx.strokeStyle = PALETTE.road + 'ff';
    ctx.lineWidth = 3 / zoom;
    const hx = cx - player.x * zoom;
    const hy = cy - player.y * zoom;
    const hw = WORLD.width * zoom;
    const hh = WORLD.height * zoom;
    const borderW = (WORLD.sectorSize / 2) * zoom;
    ctx.strokeRect(hx + borderW/2, hy + borderW/2, hw - borderW, hh - borderW);
  }
}

function drawMinimapGPS(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  ctx.strokeStyle = PALETTE.gpsRoute;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([10 / zoom, 5 / zoom]);
  
  ctx.beginPath();
  for (let i = 0; i < world.gpsRoute.length; i++) {
    const wp = world.gpsRoute[i];
    const x = cx + (wp.x - player.x) * zoom;
    const y = cy + (wp.y - player.y) * zoom;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  ctx.setLineDash([]);
  
  // Destination marker
  if (world.gpsTarget) {
    const x = cx + (world.gpsTarget.x - player.x) * zoom;
    const y = cy + (world.gpsTarget.y - player.y) * zoom;
    ctx.fillStyle = PALETTE.gps;
    ctx.beginPath();
    ctx.arc(x, y, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  }
}

function drawMinimapMissions(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  for (const marker of world.missionMarkers || []) {
    const x = cx + (marker.x - player.x) * zoom;
    const y = cy + (marker.y - player.y) * zoom;
    
    ctx.fillStyle = marker.color || PALETTE.mission;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / zoom;
    
    // Diamond marker
    ctx.beginPath();
    ctx.moveTo(x, y - 10 / zoom);
    ctx.lineTo(x + 7 / zoom, y);
    ctx.lineTo(x, y + 10 / zoom);
    ctx.lineTo(x - 7 / zoom, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Pulse animation
    const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    ctx.strokeStyle = marker.color + Math.floor(pulse * 255).toString(16).padStart(2, '0');
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(x, y, 12 / zoom * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMinimapPickups(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  for (const pickup of world.pickups || []) {
    if (!pickup.active) continue;
    const x = cx + (pickup.x - player.x) * zoom;
    const y = cy + (pickup.y - player.y) * zoom;
    
    const colors = { health: '#e74c3c', armor: '#3498db', weapon: '#f39c12', money: '#27ae60' };
    ctx.fillStyle = colors[pickup.type] || '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMinimapVehicles(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  for (const vehicle of world.vehicles || []) {
    if (!vehicle.active || vehicle.id === player.vehicleId) continue;
    if (vehicle.isPolice) continue; // Draw police separately
    
    const x = cx + (vehicle.x - player.x) * zoom;
    const y = cy + (vehicle.y - player.y) * zoom;
    
    ctx.fillStyle = vehicle.color + 'cc';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(vehicle.angle);
    const w = vehicle.width * zoom * 0.5;
    const l = vehicle.length * zoom * 0.5;
    ctx.fillRect(-w/2, -l/2, w, l);
    ctx.restore();
  }
}

function drawMinimapPeds(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  if (!hud.showFullMap) return; // Only show peds on full map
  
  ctx.fillStyle = '#888888';
  for (const ped of world.peds || []) {
    if (!ped.active || ped.state === 'dead') continue;
    const x = cx + (ped.x - player.x) * zoom;
    const y = cy + (ped.y - player.y) * zoom;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMinimapPolice(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const player = world.player;
  
  for (const vehicle of world.vehicles || []) {
    if (!vehicle.active || !vehicle.isPolice) continue;
    
    const x = cx + (vehicle.x - player.x) * zoom;
    const y = cy + (vehicle.y - player.y) * zoom;
    
    ctx.fillStyle = '#ff0000';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / zoom;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(vehicle.angle);
    const w = vehicle.width * zoom * 0.5;
    const l = vehicle.length * zoom * 0.5;
    ctx.fillRect(-w/2, -l/2, w, l);
    ctx.strokeRect(-w/2, -l/2, w, l);
    ctx.restore();
    
    // Siren indicator
    if (vehicle.siren && Math.floor(Date.now() / 200) % 2 === 0) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(x, y, 5 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Helicopters
  if (world.police && world.police.helicopters) {
    for (const heli of world.police.helicopters) {
      if (!heli.active) continue;
      const x = cx + (heli.x - player.x) * zoom;
      const y = cy + (heli.y - player.y) * zoom;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(x, y, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      // Spotlight line
      ctx.strokeStyle = '#ffff0080';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(heli.spotlightAngle) * 100 * zoom,
        y + Math.sin(heli.spotlightAngle) * 100 * zoom
      );
      ctx.stroke();
    }
  }
}

function drawMinimapPlayer(hud, player, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  
  // Player is always at center when not in full map mode
  const x = hud.showFullMap ? cx + (player.x - player.x) * zoom : cx;
  const y = hud.showFullMap ? cy + (player.y - player.y) * zoom : cy;
  
  ctx.fillStyle = PALETTE.text;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2 / zoom;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);
  // Arrow shape
  ctx.beginPath();
  ctx.moveTo(0, -8 / zoom);
  ctx.lineTo(5 / zoom, 5 / zoom);
  ctx.lineTo(0, 2 / zoom);
  ctx.lineTo(-5 / zoom, 5 / zoom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMinimapCamera(hud, world, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  const cam = world.camera;
  const player = world.player;
  
  if (hud.showFullMap) {
    const x = cx + (cam.x - player.x) * zoom;
    const y = cy + (cam.y - player.y) * zoom;
    const viewW = 1280 * zoom;
    const viewH = 720 * zoom;
    
    ctx.strokeStyle = PALETTE.gps + '80';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(x - viewW/2, y - viewH/2, viewW, viewH);
    ctx.setLineDash([]);
  }
}

function drawMinimapNorth(hud, cx, cy) {
  const ctx = hud.ctx;
  const m = hud.minimap;
  const zoom = hud.showFullMap ? m.zoom * 0.3 : m.zoom;
  
  const x = cx + m.size / 2 - 15;
  const y = cy - m.size / 2 + 15;
  
  ctx.fillStyle = PALETTE.text;
  ctx.font = `10px ${FONT_MONO}`;
  ctx.fillText('N', x, y);
  
  // North arrow
  ctx.strokeStyle = PALETTE.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 12);
  ctx.lineTo(x + 5, y + 20);
  ctx.moveTo(x, y + 15);
  ctx.lineTo(x + 10, y + 15);
  ctx.stroke();
}

function renderCrosshair(hud, player) {
  const ctx = hud.ctx;
  const ch = hud.crosshair;
  const cx = hud.canvas.width / 2;
  const cy = hud.canvas.height / 2;
  const spread = ch.gap + hud.crosshairSpread;
  const size = ch.size;
  
  ctx.strokeStyle = ch.outerColor;
  ctx.lineWidth = ch.thickness + 2;
  ctx.lineCap = 'round';
  
  // Outer circle when aiming
  if (player.input.aim) {
    ctx.beginPath();
    ctx.arc(cx, cy, spread + size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.strokeStyle = ch.color;
  ctx.lineWidth = ch.thickness;
  
  // Crosshair lines
  ctx.beginPath();
  // Top
  ctx.moveTo(cx, cy - spread - size);
  ctx.lineTo(cx, cy - spread);
  // Bottom
  ctx.moveTo(cx, cy + spread);
  ctx.lineTo(cx, cy + spread + size);
  // Left
  ctx.moveTo(cx - spread - size, cy);
  ctx.lineTo(cx - spread, cy);
  // Right
  ctx.moveTo(cx + spread, cy);
  ctx.lineTo(cx + spread + size, cy);
  ctx.stroke();
  
  // Center dot
  ctx.fillStyle = ch.color;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderWantedStars(hud, player) {
  const ctx = hud.ctx;
  const ws = hud.wantedStars;
  const maxStars = ws.maxStars;
  
  for (let i = 0; i < maxStars; i++) {
    const x = ws.x + i * (ws.starSize + ws.spacing);
    const y = ws.y;
    const filled = i < player.wantedLevel;
    const flashing = filled && player.wantedLevel > 0 && hud.wantedFlash > 0.5;
    
    ctx.save();
    ctx.translate(x + ws.starSize / 2, y + ws.starSize / 2);
    
    // Star shape
    const spikes = 5;
    const outerRadius = ws.starSize / 2;
    const innerRadius = ws.starSize / 4;
    
    ctx.beginPath();
    for (let j = 0; j < spikes * 2; j++) {
      const radius = j % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * j) / spikes - Math.PI / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    
    if (filled) {
      ctx.fillStyle = flashing ? '#fff' : PALETTE.wanted;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = PALETTE.wantedEmpty;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Wanted text
  if (player.wantedLevel > 0) {
    ctx.fillStyle = PALETTE.wanted;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`WANTED`, ws.x, ws.y + ws.starSize + 4);
  }
}

function renderHealthArmorStamina(hud, player) {
  const ctx = hud.ctx;
  
  // Background panel
  const panelX = hud.healthBar.x - 10;
  const panelY = hud.healthBar.y - 10;
  const panelW = hud.healthBar.width + 20;
  const panelH = 120;
  
  ctx.fillStyle = 'rgba(26, 26, 34, 0.85)';
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();
  
  // Health bar
  renderBar(ctx, hud.healthBar, player.health, PLAYER.maxHealth, PALETTE.health, hud.healthFlash);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.fillText('HEALTH', hud.healthBar.x, hud.healthBar.y - 16);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(player.health)}/${PLAYER.maxHealth}`, hud.healthBar.x + hud.healthBar.width, hud.healthBar.y - 16);
  ctx.textAlign = 'left';
  
  // Armor bar
  if (player.armor > 0 || player.maxArmor > 0) {
    renderBar(ctx, hud.armorBar, player.armor, PLAYER.maxArmor, PALETTE.armor, hud.armorFlash);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillText('ARMOR', hud.armorBar.x, hud.armorBar.y - 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(player.armor)}/${PLAYER.maxArmor}`, hud.armorBar.x + hud.armorBar.width, hud.armorBar.y - 14);
    ctx.textAlign = 'left';
  }
  
  // Stamina bar (only when not full)
  if (player.stamina < PLAYER.maxStamina) {
    renderBar(ctx, hud.staminaBar, player.stamina, PLAYER.maxStamina, PALETTE.stamina, 0);
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('STAMINA', hud.staminaBar.x, hud.staminaBar.y - 12);
  }
}

function renderBar(ctx, bar, value, maxValue, color, flash) {
  const percent = clamp(value / maxValue, 0, 1);
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, bar.width, bar.height, bar.borderRadius);
  ctx.fill();
  
  // Fill
  const fillWidth = bar.width * percent;
  const flashIntensity = flash * 0.5;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  ctx.fillStyle = `rgb(${Math.min(255, r + flashIntensity * 100)}, ${Math.min(255, g + flashIntensity * 100)}, ${Math.min(255, b + flashIntensity * 100)})`;
  
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, fillWidth, bar.height, bar.borderRadius);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, bar.width, bar.height, bar.borderRadius);
  ctx.stroke();
}

function renderMoney(hud, player) {
  const ctx = hud.ctx;
  const m = hud.money;
  
  ctx.fillStyle = PALETTE.money;
  ctx.font = `bold 20px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`$${formatNumber(player.money)}`, m.x, m.y);
  ctx.textAlign = 'left';
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderWeapon(hud, player) {
  const ctx = hud.ctx;
  const w = hud.weapon;
  
  const weaponNames = {
    fist: 'FISTS',
    pistol: 'PISTOL',
    smg: 'SMG',
    rifle: 'RIFLE',
    shotgun: 'SHOTGUN',
    sniper: 'SNIPER',
  };
  
  const name = weaponNames[player.weapon] || player.weapon.toUpperCase();
  const ammo = player.ammo[player.weapon] || 0;
  const maxAmmo = player.weapon !== 'fist' ? player.ammo[player.weapon + '_max'] || 0 : Infinity;
  
  ctx.fillStyle = PALETTE.text;
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(name, w.x, w.y);
  
  if (player.weapon !== 'fist') {
    ctx.font = `12px ${FONT_MONO}`;
    const ammoColor = ammo === 0 ? PALETTE.wanted : (ammo < maxAmmo * 0.2 ? '#f39c12' : PALETTE.text);
    ctx.fillStyle = ammoColor;
    ctx.fillText(`${ammo} / ${maxAmmo}`, w.x, w.y + 20);
  }
  ctx.textAlign = 'left';
}

function renderVehicleInfo(hud, player, world) {
  const ctx = hud.ctx;
  const v = world.vehicles.find(v => v.id === player.vehicleId);
  if (!v) return;
  
  const vi = hud.vehicleInfo;
  const speed = Math.abs(v.speed * 3.6); // Convert to km/h
  const gear = getVehicleGear(v);
  const fuel = v.fuel !== undefined ? v.fuel : 100;
  
  ctx.fillStyle = 'rgba(26, 26, 34, 0.85)';
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(vi.x - 10, vi.y - 10, 230, 80, 8);
  ctx.fill();
  ctx.stroke();
  
  // Speedometer
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 36px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(speed)}`, vi.x + 110, vi.y + 10);
  
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = PALETTE.textMuted;
  ctx.fillText('KM/H', vi.x + 120, vi.y + 35);
  
  // Gear
  ctx.fillStyle = PALETTE.text;
  ctx.font = `18px ${FONT_MONO}`;
  ctx.fillText(gear, vi.x + 200, vi.y + 10);
  ctx.font = `10px ${FONT}`;
  ctx.fillStyle = PALETTE.textMuted;
  ctx.fillText('GEAR', vi.x + 200, vi.y + 30);
  
  // Fuel
  ctx.fillStyle = PALETTE.text;
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', vi.x, vi.y + 50);
  renderBar(ctx, { x: vi.x + 50, y: vi.y + 52, width: 150, height: 10, borderRadius: 3 }, fuel, 100, '#f39c12', 0);
  
  ctx.textAlign = 'left';
}

function getVehicleGear(v) {
  if (v.speed <= 0) return v.speed < 0 ? 'R' : 'N';
  const gears = 5;
  const gear = Math.min(gears, Math.floor(v.speed / (v.maxSpeed / gears)) + 1);
  return gear.toString();
}

function renderCompass(hud, player) {
  const ctx = hud.ctx;
  const c = hud.compass;
  
  ctx.save();
  ctx.translate(c.x, c.y);
  
  // Compass background
  ctx.fillStyle = 'rgba(26, 26, 34, 0.7)';
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, c.radius, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Rotate to player heading
  ctx.rotate(-player.angle);
  
  // Tick marks
  ctx.strokeStyle = PALETTE.textMuted;
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const angle = i * 0.2;
    const x1 = Math.cos(angle) * (c.radius - 10);
    const y1 = Math.sin(angle) * (c.radius - 10);
    const x2 = Math.cos(angle) * (c.radius - 5);
    const y2 = Math.sin(angle) * (c.radius - 5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  
  // Cardinal directions
  ctx.fillStyle = PALETTE.text;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) - Math.PI / 2;
    const x = Math.cos(angle) * (c.radius - 20);
    const y = Math.sin(angle) * (c.radius - 20);
    ctx.fillText(dirs[i], x, y);
  }
  
  // Center marker (player direction)
  ctx.fillStyle = PALETTE.gps;
  ctx.beginPath();
  ctx.moveTo(0, -c.radius + 5);
  ctx.lineTo(-5, -c.radius + 15);
  ctx.lineTo(5, -c.radius + 15);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function renderMissionObjective(hud, world) {
  const ctx = hud.ctx;
  const md = hud.missionDisplay;
  const mission = world.activeMission;
  
  if (!mission) return;
  
  const obj = mission.currentObjective < mission.objectives.length 
    ? mission.objectives[mission.currentObjective] 
    : null;
  
  if (!obj) return;
  
  ctx.fillStyle = 'rgba(26, 26, 34, 0.85)';
  ctx.strokeStyle = PALETTE.mission;
  ctx.lineWidth = 2;
  
  const text = obj.text;
  ctx.font = `14px ${FONT}`;
  const metrics = ctx.measureText(text);
  const width = Math.min(metrics.width + 30, md.maxWidth);
  const height = 40;
  const x = md.x - width / 2;
  const y = md.y;
  
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = PALETTE.mission;
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, md.x, md.y + height / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  // Objective counter
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.fillText(`${mission.currentObjective + 1} / ${mission.objectives.length}`, md.x + width / 2 + 10, md.y + 4);
}

function renderZoneName(hud, world) {
  const ctx = hud.ctx;
  const zn = hud.zoneName;
  
  if (!world.zoneName || world.zoneNameTimer <= 0) return;
  
  ctx.fillStyle = `rgba(255, 215, 0, ${Math.min(1, world.zoneNameTimer)})`;
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(world.zoneName, zn.x, zn.y);
  ctx.textAlign = 'left';
  
  // District type
  const district = world.districts?.find(d => d.name === world.zoneName);
  if (district) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, world.zoneNameTimer) * 0.7})`;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(district.type.toUpperCase(), zn.x, zn.y + 30);
  }
}

function renderMessages(hud) {
  const ctx = hud.ctx;
  const y = hud.messageY;
  
  for (let i = 0; i < hud.messages.length; i++) {
    const msg = hud.messages[i];
    const alpha = msg.alpha || 1;
    
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * alpha})`;
    ctx.lineWidth = 1;
    
    ctx.font = `13px ${FONT}`;
    const metrics = ctx.measureText(msg.text);
    const padding = 12;
    const width = metrics.width + padding * 2;
    const height = 28;
    const x = hud.canvas.width - width - 20;
    const msgY = y - i * (height + 4);
    
    ctx.beginPath();
    ctx.roundRect(x, msgY, width, height, 6);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(msg.text, x + padding, msgY + 8);
  }
}

function renderSubtitles(hud) {
  const ctx = hud.ctx;
  
  for (let i = 0; i < hud.subtitles.length; i++) {
    const sub = hud.subtitles[i];
    const alpha = sub.alpha || 1;
    
    ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * alpha})`;
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'center';
    
    const metrics = ctx.measureText(sub.text);
    const padding = 20;
    const width = metrics.width + padding * 2;
    const height = 40;
    const x = hud.canvas.width / 2;
    const y = hud.subtitleY + i * (height + 10);
    
    ctx.beginPath();
    ctx.roundRect(x - width/2, y, width, height, 8);
    ctx.fill();
    
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(sub.text, x, y + height / 2 + 5);
  }
  ctx.textAlign = 'left';
}

function renderFullMap(hud, world) {
  const ctx = hud.ctx;
  const canvas = hud.canvas;
  
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Temporarily enable full map mode for minimap rendering
  const oldShowFullMap = hud.showFullMap;
  hud.showFullMap = true;
  const oldMinimap = { ...hud.minimap };
  hud.minimap.x = canvas.width / 2 - 400;
  hud.minimap.y = canvas.height / 2 - 300;
  hud.minimap.size = 800;
  hud.minimap.zoom = 0.08;
  
  renderMinimap(hud, world);
  
  // Restore
  hud.showFullMap = oldShowFullMap;
  hud.minimap = oldMinimap;
  
  // Full map title
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('VICE CITY MAP', canvas.width / 2, 40);
  ctx.textAlign = 'left';
  
  // Legend
  const legendX = 40;
  let legendY = canvas.height - 200;
  const items = [
    { color: PALETTE.mission, text: 'Mission' },
    { color: '#ff0000', text: 'Police' },
    { color: PALETTE.gps, text: 'GPS Route' },
    { color: '#27ae60', text: 'Pickups' },
    { color: '#888', text: 'Pedestrians' },
  ];
  
  for (const item of items) {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY, 16, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(item.text, legendX + 22, legendY + 2);
    legendY += 22;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}