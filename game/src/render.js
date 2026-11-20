// Render System - Canvas 2D rendering for open world GTA 6 style game.
// Handles all visual rendering: sky, water, ground, roads, buildings, props,
// vehicles, pedestrians, effects, and HUD overlay. Uses canvas 2D context with
// optimized drawing order, culling, and visual effects for performance on desktop
// and mobile browsers. Render order follows: sky → water → ground → roads → buildings
// → props → vehicles → peds → effects → HUD for correct layering.
import { WORLD, PALETTE, FONT, FONT_MONO, DISTRICTS, ROAD_NETWORK, TIME, WEATHER, VEHICLE, PEDESTRIAN } from './config.js';
import { distance, angleTo, normalizeAngle, isOnRoad, getRoadDirection, getDistrictAt } from './world.js';
import { getVehicleCorners, getVehicleBounds } from './vehicles.js';

export function getRendererInfo(renderer) {
  return {
    canvas: renderer.canvas,
    ctx: renderer.ctx,
    layers: renderer.layers,
    camera: { ...renderer.camera },
    viewWidth: renderer.viewWidth,
    viewHeight: renderer.viewHeight,
    drawCalls: renderer.drawCalls,
    lastFrameTime: renderer.lastFrameTime,
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    ctx,
    // Render layers
    layers: ['sky', 'water', 'ground', 'roads', 'buildings', 'props', 'vehicles', 'peds', 'effects', 'hud'],
    // Camera
    camera: { x: 0, y: 0, zoom: 1, angle: 0 },
    // Viewport
    viewWidth: canvas.width,
    viewHeight: canvas.height,
    // Culling
    cullMargin: 100,
    // Time/weather
    timeOfDay: 12 * 3600,
    weather: 'clear',
    weatherTransition: 0,
    targetWeather: 'clear',
    // Visual effects
    effects: [],
    screenShake: { x: 0, y: 0, intensity: 0, time: 0 },
    // Render stats
    drawCalls: 0,
    lastFrameTime: 0,
    // Lighting
    lights: [],
    // Performance
    stats: { drawCalls: 0, triangles: 0, cullCount: 0 },
    // Debug
    debug: false,
    showBounds: false,
    showGrid: false,
  };
}

export function updateRenderer(renderer, world, dt) {
  const player = world.player;
  const cam = world.camera;
  
  // Update camera
  renderer.camera.x = cam.x;
  renderer.camera.y = cam.y;
  renderer.camera.zoom = 1;
  renderer.camera.angle = 0; // Top-down view
  
  // Update time/weather
  renderer.timeOfDay = world.timeOfDay;
  renderer.weather = world.weather;
  renderer.targetWeather = world.targetWeather;
  renderer.weatherTransition = world.weatherTransition;
  
  // Update effects
  updateEffects(renderer, dt);
  
  // Update screen shake
  if (renderer.screenShake.time > 0) {
    renderer.screenShake.time -= dt;
    renderer.screenShake.intensity = Math.max(0, renderer.screenShake.intensity - dt * 20);
    renderer.screenShake.x = (Math.random() - 0.5) * renderer.screenShake.intensity;
    renderer.screenShake.y = (Math.random() - 0.5) * renderer.screenShake.intensity;
  } else {
    renderer.screenShake.x = 0;
    renderer.screenShake.y = 0;
    renderer.screenShake.intensity = 0;
  }
  
  // Add camera shake
  if (cam.shake > 0 && cam.shakeTime > 0) {
    renderer.screenShake.intensity = Math.max(renderer.screenShake.intensity, cam.shake);
    renderer.screenShake.time = Math.max(renderer.screenShake.time, cam.shakeTime);
  }
  
  // Update stats
  renderer.stats.drawCalls = 0;
  renderer.stats.triangles = 0;
  renderer.stats.cullCount = 0;
}

function updateEffects(renderer, dt) {
  for (let i = renderer.effects.length - 1; i >= 0; i--) {
    const effect = renderer.effects[i];
    effect.timer += dt;
    if (effect.timer >= effect.duration) {
      renderer.effects.splice(i, 1);
    }
  }
}

export function addEffect(renderer, effect) {
  renderer.effects.push({
    ...effect,
    timer: 0,
  });
}

export function addScreenShake(renderer, intensity, duration) {
  renderer.screenShake.intensity = Math.max(renderer.screenShake.intensity, intensity);
  renderer.screenShake.time = Math.max(renderer.screenShake.time, duration);
}

export function render(renderer, world) {
  const ctx = renderer.ctx;
  const canvas = renderer.canvas;
  const cam = renderer.camera;
  
  // Clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply camera transform
  ctx.save();
  ctx.translate(
    canvas.width / 2 - cam.x * cam.zoom + renderer.screenShake.x,
    canvas.height / 2 - cam.y * cam.zoom + renderer.screenShake.y
  );
  ctx.scale(cam.zoom, cam.zoom);
  ctx.rotate(-cam.angle);
  
  // Calculate view bounds for culling
  const viewBounds = getViewBounds(renderer);
  
  // Render layers
  renderSky(renderer, world, viewBounds);
  renderWater(renderer, world, viewBounds);
  renderGround(renderer, world, viewBounds);
  renderRoads(renderer, world, viewBounds);
  renderBuildings(renderer, world, viewBounds);
  renderProps(renderer, world, viewBounds);
  renderVehicles(renderer, world, viewBounds);
  renderPeds(renderer, world, viewBounds);
  renderEffects(renderer, world, viewBounds);
  
  ctx.restore();
  
  // Render HUD (screen space)
  if (world.hud) {
    renderHUDOverlay(renderer, world);
  }
  
  // Render debug info
  if (renderer.debug) {
    renderDebug(renderer, world);
  }
}

function getViewBounds(renderer) {
  const cam = renderer.camera;
  const canvas = renderer.canvas;
  const margin = renderer.cullMargin / cam.zoom;
  
  return {
    minX: cam.x - canvas.width / (2 * cam.zoom) - margin,
    maxX: cam.x + canvas.width / (2 * cam.zoom) + margin,
    minY: cam.y - canvas.height / (2 * cam.zoom) - margin,
    maxY: cam.y + canvas.height / (2 * cam.zoom) + margin,
  };
}

function isInView(bounds, x, y, radius = 0) {
  return x + radius >= bounds.minX && x - radius <= bounds.maxX &&
         y + radius >= bounds.minY && y - radius <= bounds.maxY;
}

function renderSky(renderer, world, bounds) {
  const ctx = renderer.ctx;
  const hour = (renderer.timeOfDay / 3600) % 24;
  
  // Sky gradient based on time
  const skyColors = getSkyColors(hour, renderer.weather, renderer.weatherTransition, renderer.targetWeather);
  
  // Full screen sky (world space covers entire view)
  const gradient = ctx.createLinearGradient(0, -WORLD.height, 0, WORLD.height);
  gradient.addColorStop(0, skyColors.zenith);
  gradient.addColorStop(0.5, skyColors.mid);
  gradient.addColorStop(1, skyColors.horizon);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(-WORLD.width, -WORLD.height, WORLD.width * 2, WORLD.height * 2);
  
  // Sun/moon
  renderCelestialBody(renderer, hour, skyColors);
  
  // Clouds
  if (renderer.weather !== 'clear' || renderer.targetWeather !== 'clear') {
    renderClouds(renderer, bounds);
  }
  
  // Stars (night)
  if (hour > 20 || hour < 5) {
    renderStars(renderer, hour);
  }
}

function getSkyColors(hour, weather, transition, targetWeather) {
  // Base colors by time
  let zenith, mid, horizon;
  
  if (hour >= 5 && hour < 7) { // Dawn
    zenith = '#2d3a4f';
    mid = '#4a5d7a';
    horizon = '#ff6b35';
  } else if (hour >= 7 && hour < 10) { // Morning
    zenith = '#1a3a5c';
    mid = '#3d6b9e';
    horizon = '#87ceeb';
  } else if (hour >= 10 && hour < 16) { // Day
    zenith = '#0d2a4a';
    mid = '#1e5a8a';
    horizon = '#4db8ff';
  } else if (hour >= 16 && hour < 19) { // Evening
    zenith = '#2d3a4f';
    mid = '#5a4d6b';
    horizon = '#ff6b35';
  } else if (hour >= 19 && hour < 22) { // Dusk
    zenith = '#1a1f2e';
    mid = '#2d2a3e';
    horizon = '#4a3a4a';
  } else { // Night
    zenith = '#080f1a';
    mid = '#0d1a2a';
    horizon = '#1a1f2e';
  }
  
  // Weather modifications
  const weatherMods = {
    clear: { zenith: 0, mid: 0, horizon: 0, alpha: 1 },
    cloudy: { zenith: 0.3, mid: 0.2, horizon: 0.1, alpha: 0.9 },
    rain: { zenith: 0.5, mid: 0.4, horizon: 0.3, alpha: 0.7 },
    storm: { zenith: 0.6, mid: 0.5, horizon: 0.4, alpha: 0.5 },
    fog: { zenith: 0.4, mid: 0.3, horizon: 0.2, alpha: 0.6 },
  };
  
  const currentMod = weatherMods[weather] || weatherMods.clear;
  const targetMod = weatherMods[targetWeather] || weatherMods.clear;
  
  // Interpolate
  const t = transition;
  const mod = {
    zenith: lerp(currentMod.zenith, targetMod.zenith, t),
    mid: lerp(currentMod.mid, targetMod.mid, t),
    horizon: lerp(currentMod.horizon, targetMod.horizon, t),
    alpha: lerp(currentMod.alpha, targetMod.alpha, t),
  };
  
  // Apply modifications (darken for clouds/storm)
  const darken = (color, amount) => {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 255) * (1 - amount));
    const g = Math.max(0, ((num >> 8) & 255) * (1 - amount));
    const b = Math.max(0, (num & 255) * (1 - amount));
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  };
  
  return {
    zenith: darken(zenith, mod.zenith),
    mid: darken(mid, mod.mid),
    horizon: darken(horizon, mod.horizon),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function renderCelestialBody(renderer, hour, skyColors) {
  const ctx = renderer.ctx;
  
  // Sun position
  const sunAngle = ((hour - 6) / 12) * Math.PI; // 6am = 0, 6pm = PI
  const sunRadius = 300;
  const sunX = Math.cos(sunAngle) * sunRadius;
  const sunY = Math.sin(sunAngle) * sunRadius;
  
  if (hour >= 6 && hour < 18) {
    // Sun
    const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
    gradient.addColorStop(0, '#fff8e7');
    gradient.addColorStop(0.3, '#ffd700');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
    ctx.fill();
    
    // Lens flare
    for (let i = 1; i <= 3; i++) {
      const fx = -sunX * i * 0.3;
      const fy = -sunY * i * 0.3;
      const fr = 20 / i;
      const flareGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      flareGrad.addColorStop(0, `rgba(255, 215, 0, ${0.1 / i})`);
      flareGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Moon
    const moonAngle = ((hour - 18) / 12) * Math.PI;
    const moonRadius = 300;
    const moonX = Math.cos(moonAngle) * moonRadius;
    const moonY = Math.sin(moonAngle) * moonRadius;
    
    const gradient = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 50);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(0.5, '#d0d0d0');
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 50, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderClouds(renderer, bounds) {
  const ctx = renderer.ctx;
  const hour = (renderer.timeOfDay / 3600) % 24;
  const isNight = hour > 20 || hour < 5;
  
  // Deterministic cloud positions based on time
  const cloudSeed = Math.floor(renderer.timeOfDay / 100);
  const rng = createSeededRandom(cloudSeed);
  
  const cloudCount = renderer.weather === 'storm' ? 30 : (renderer.weather === 'rain' ? 20 : 10);
  
  for (let i = 0; i < cloudCount; i++) {
    const x = (rng() * WORLD.width * 2 - WORLD.width) % (WORLD.width + 400) - 200;
    const y = (rng() * WORLD.height * 0.5) - 100;
    const scale = 0.5 + rng() * 1.5;
    const alpha = isNight ? 0.15 : (renderer.weather === 'storm' ? 0.6 : 0.3);
    
    if (!isInView(bounds, x, y, 200 * scale)) continue;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale * 0.6);
    
    // Cloud puffs
    const puffCount = 3 + Math.floor(rng() * 4);
    for (let p = 0; p < puffCount; p++) {
      const px = (rng() - 0.5) * 120;
      const py = (rng() - 0.5) * 60;
      const pr = 30 + rng() * 40;
      
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      const cloudColor = isNight ? '#2a2a3a' : '#ffffff';
      grad.addColorStop(0, `${cloudColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(1, `${cloudColor}00`);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

function renderStars(renderer, hour) {
  const ctx = renderer.ctx;
  const nightProgress = hour > 20 ? (hour - 20) / 4 : (hour + 4) / 4;
  const starAlpha = Math.min(1, nightProgress * 2);
  
  if (starAlpha < 0.1) return;
  
  const starSeed = 12345;
  const rng = createSeededRandom(starSeed);
  
  ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha * 0.8})`;
  
  for (let i = 0; i < 200; i++) {
    const x = (rng() - 0.5) * WORLD.width * 2;
    const y = (rng() - 0.5) * WORLD.height;
    const size = rng() * 1.5 + 0.5;
    const twinkle = Math.sin(Date.now() / 1000 + i * 10) * 0.5 + 0.5;
    
    ctx.globalAlpha = starAlpha * twinkle;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function renderWater(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Ocean around the city
  const waterColor = getWaterColor(renderer.timeOfDay, renderer.weather);
  
  // Large water bodies (simplified - ocean on edges)
  const waterAreas = [
    { x: -500, y: -500, w: WORLD.width + 1000, h: 500 }, // North
    { x: -500, y: WORLD.height, w: WORLD.width + 1000, h: 500 }, // South
    { x: -500, y: -500, w: 500, h: WORLD.height + 1000 }, // West
    { x: WORLD.width, y: -500, w: 500, h: WORLD.height + 1000 }, // East
  ];
  
  for (const water of waterAreas) {
    if (!isInView(bounds, water.x + water.w/2, water.y + water.h/2, Math.max(water.w, water.h))) continue;
    
    ctx.fillStyle = waterColor;
    ctx.fillRect(water.x, water.y, water.w, water.h);
    
    // Water surface animation
    const time = Date.now() / 1000;
    ctx.strokeStyle = lightenColor(waterColor, 0.2) + '40';
    ctx.lineWidth = 1;
    
    for (let wx = water.x; wx < water.x + water.w; wx += 40) {
      ctx.beginPath();
      for (let wy = water.y; wy < water.y + water.h; wy += 20) {
        const wave = Math.sin(wx * 0.01 + time * 2) * 3 + Math.cos(wy * 0.02 + time) * 2;
        if (wy === water.y) ctx.moveTo(wx + wave, wy);
        else ctx.lineTo(wx + wave, wy);
      }
      ctx.stroke();
    }
  }
  
  // Inland water (rivers, lakes) - simplified
  for (const district of DISTRICTS) {
    if (district.type === 'water' || district.type === 'beach') {
      const x = district.x * WORLD.sectorSize;
      const y = district.y * WORLD.sectorSize;
      const w = district.w * WORLD.sectorSize;
      const h = district.h * WORLD.sectorSize;
      
      if (isInView(bounds, x + w/2, y + h/2, Math.max(w, h))) {
        ctx.fillStyle = waterColor;
        ctx.fillRect(x, y, w, h);
      }
    }
  }
}

function getWaterColor(hour, weather) {
  const baseColors = {
    day: '#0d1b2a',
    night: '#050a12',
    dawn: '#1a2a3a',
    dusk: '#1a2a3a',
  };
  
  let base = baseColors.day;
  if (hour >= 5 && hour < 7) base = baseColors.dawn;
  else if (hour >= 19 && hour < 22) base = baseColors.dusk;
  else if (hour >= 22 || hour < 5) base = baseColors.night;
  
  if (weather === 'storm') base = darkenColor(base, 0.3);
  else if (weather === 'rain') base = darkenColor(base, 0.15);
  
  return base;
}

function darkenColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (num & 255) * (1 - amount));
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function lightenColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 255) + 255 * amount);
  const g = Math.min(255, ((num >> 8) & 255) + 255 * amount);
  const b = Math.min(255, (num & 255) + 255 * amount);
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function renderGround(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Base ground color by district
  for (let sy = 0; sy < WORLD.gridSize; sy++) {
    for (let sx = 0; sx < WORLD.gridSize; sx++) {
      const x = sx * WORLD.sectorSize;
      const y = sy * WORLD.sectorSize;
      
      if (!isInView(bounds, x + WORLD.sectorSize/2, y + WORLD.sectorSize/2, WORLD.sectorSize)) continue;
      
      const district = getDistrictAt(x + WORLD.sectorSize/2, y + WORLD.sectorSize/2);
      let groundColor = district.color;
      
      // Add noise/variation
      const sectorSeed = sy * WORLD.gridSize + sx;
      const rng = createSeededRandom(sectorSeed);
      const variation = (rng() - 0.5) * 0.1;
      groundColor = darkenColor(groundColor, -variation);
      
      ctx.fillStyle = groundColor;
      ctx.fillRect(x, y, WORLD.sectorSize, WORLD.sectorSize);
    }
  }
  
  // Grass/dirt patches
  renderGroundDetails(renderer, bounds);
}

function renderGroundDetails(renderer, bounds) {
  const ctx = renderer.ctx;
  
  // Deterministic detail positions
  const detailSeed = 98765;
  const rng = createSeededRandom(detailSeed);
  
  for (let i = 0; i < 5000; i++) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    const district = getDistrictAt(x, y);
    
    if (!isInView(bounds, x, y, 10)) continue;
    
    // Skip roads
    if (isOnRoad({ width: WORLD.width, height: WORLD.height }, x, y)) continue;
    
    let detailColor, detailSize, detailType;
    
    if (district.type === 'grass' || district.type === 'wilderness') {
      detailColor = rng() < 0.5 ? darkenColor(PALETTE.grass, 0.2) : lightenColor(PALETTE.grass, 0.1);
      detailSize = 2 + rng() * 4;
      detailType = 'grass';
    } else if (district.type === 'beach') {
      detailColor = lightenColor(PALETTE.sand, (rng() - 0.5) * 0.2);
      detailSize = 1 + rng() * 2;
      detailType = 'sand';
    } else if (district.type === 'industrial') {
      detailColor = darkenColor(PALETTE.dirt, 0.1);
      detailSize = 3 + rng() * 3;
      detailType = 'dirt';
    } else {
      continue; // Urban areas have less ground detail
    }
    
    ctx.fillStyle = detailColor;
    if (detailType === 'grass') {
      // Small grass tufts
      ctx.beginPath();
      ctx.arc(x, y, detailSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - detailSize/2, y - detailSize/2, detailSize, detailSize);
    }
  }
}

function renderRoads(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  ctx.fillStyle = PALETTE.road;
  
  // Highway ring
  const highwayWidth = ROAD_NETWORK.highwayWidth;
  ctx.fillRect(-highwayWidth/2, -highwayWidth/2, WORLD.width + highwayWidth, highwayWidth); // Top
  ctx.fillRect(-highwayWidth/2, WORLD.height - highwayWidth/2, WORLD.width + highwayWidth, highwayWidth); // Bottom
  ctx.fillRect(-highwayWidth/2, -highwayWidth/2, highwayWidth, WORLD.height + highwayWidth); // Left
  ctx.fillRect(WORLD.width - highwayWidth/2, -highwayWidth/2, highwayWidth, WORLD.height + highwayWidth); // Right
  
  // Main roads (every 4 sectors)
  const mainWidth = ROAD_NETWORK.mainWidth;
  const spacing = ROAD_NETWORK.mainSpacing;
  
  for (let i = 0; i <= WORLD.gridSize; i += spacing) {
    const pos = i * WORLD.sectorSize;
    
    // Vertical
    if (isInView(bounds, pos, WORLD.height/2, mainWidth/2)) {
      ctx.fillRect(pos - mainWidth/2, 0, mainWidth, WORLD.height);
    }
    // Horizontal
    if (isInView(bounds, WORLD.width/2, pos, mainWidth/2)) {
      ctx.fillRect(0, pos - mainWidth/2, WORLD.width, mainWidth);
    }
  }
  
  // Local roads (every sector)
  const localWidth = ROAD_NETWORK.localWidth;
  
  for (let i = 0; i <= WORLD.gridSize; i++) {
    const pos = i * WORLD.sectorSize;
    
    // Vertical
    if (i % spacing !== 0 && isInView(bounds, pos, WORLD.height/2, localWidth/2)) {
      ctx.fillRect(pos - localWidth/2, 0, localWidth, WORLD.height);
    }
    // Horizontal
    if (i % spacing !== 0 && isInView(bounds, WORLD.width/2, pos, localWidth/2)) {
      ctx.fillRect(0, pos - localWidth/2, WORLD.width, localWidth);
    }
  }
  
  // Road lines
  renderRoadLines(renderer, bounds);
  
  // Intersections
  renderIntersections(renderer, bounds);
  
  // Sidewalks
  renderSidewalks(renderer, bounds);
}

function renderRoadLines(renderer, bounds) {
  const ctx = renderer.ctx;
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  
  // Main road center lines
  const spacing = ROAD_NETWORK.mainSpacing;
  
  for (let i = 0; i <= WORLD.gridSize; i += spacing) {
    const pos = i * WORLD.sectorSize;
    
    // Vertical center line
    if (isInView(bounds, pos, WORLD.height/2)) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, WORLD.height);
      ctx.stroke();
    }
    // Horizontal center line
    if (isInView(bounds, WORLD.width/2, pos)) {
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(WORLD.width, pos);
      ctx.stroke();
    }
  }
  
  // Local road lines (solid)
  ctx.setLineDash([]);
  ctx.strokeStyle = PALETTE.roadLine + '80';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= WORLD.gridSize; i++) {
    if (i % spacing === 0) continue;
    const pos = i * WORLD.sectorSize;
    
    if (isInView(bounds, pos, WORLD.height/2)) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, WORLD.height);
      ctx.stroke();
    }
    if (isInView(bounds, WORLD.width/2, pos)) {
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(WORLD.width, pos);
      ctx.stroke();
    }
  }
  
  // Highway lines
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.setLineDash([40, 30]);
  
  const hw = ROAD_NETWORK.highwayWidth;
  // Top highway - 2 lanes each direction
  for (let lane = 0; lane < 2; lane++) {
    const y = -hw/2 + hw/4 + lane * hw/2;
    ctx.beginPath();
    ctx.moveTo(-hw/2, y);
    ctx.lineTo(WORLD.width + hw/2, y);
    ctx.stroke();
  }
  
  ctx.setLineDash([]);
}

function renderIntersections(renderer, bounds) {
  const ctx = renderer.ctx;
  const spacing = ROAD_NETWORK.mainSpacing;
  const interSize = ROAD_NETWORK.intersectionSize;
  
  ctx.fillStyle = PALETTE.road;
  
  for (let sy = 0; sy <= WORLD.gridSize; sy += spacing) {
    for (let sx = 0; sx <= WORLD.gridSize; sx += spacing) {
      const x = sx * WORLD.sectorSize;
      const y = sy * WORLD.sectorSize;
      
      if (!isInView(bounds, x, y, interSize)) continue;
      
      // Intersection square
      ctx.fillRect(x - interSize/2, y - interSize/2, interSize, interSize);
      
      // Crosswalk
      ctx.fillStyle = '#fff4';
      ctx.fillRect(x - interSize/2, y - 8, interSize, 4);
      ctx.fillRect(x - interSize/2, y + 4, interSize, 4);
      ctx.fillRect(x - 8, y - interSize/2, 4, interSize);
      ctx.fillRect(x + 4, y - interSize/2, 4, interSize);
      ctx.fillStyle = PALETTE.road;
    }
  }
}

function renderSidewalks(renderer, bounds) {
  const ctx = renderer.ctx;
  ctx.fillStyle = PALETTE.sidewalk;
  
  const spacing = ROAD_NETWORK.mainSpacing;
  const mainWidth = ROAD_NETWORK.mainWidth;
  const localWidth = ROAD_NETWORK.localWidth;
  const sidewalkWidth = 6;
  
  // Main road sidewalks
  for (let i = 0; i <= WORLD.gridSize; i += spacing) {
    const pos = i * WORLD.sectorSize;
    const halfMain = mainWidth/2 + sidewalkWidth;
    
    // Vertical sidewalks
    if (isInView(bounds, pos, WORLD.height/2, sidewalkWidth)) {
      ctx.fillRect(pos - halfMain, 0, sidewalkWidth, WORLD.height);
      ctx.fillRect(pos + mainWidth/2, 0, sidewalkWidth, WORLD.height);
    }
    // Horizontal sidewalks
    if (isInView(bounds, WORLD.width/2, pos, sidewalkWidth)) {
      ctx.fillRect(0, pos - halfMain, WORLD.width, sidewalkWidth);
      ctx.fillRect(0, pos + mainWidth/2, WORLD.width, sidewalkWidth);
    }
  }
  
  // Local road sidewalks (thinner)
  ctx.fillStyle = PALETTE.sidewalk + '80';
  for (let i = 0; i <= WORLD.gridSize; i++) {
    if (i % spacing === 0) continue;
    const pos = i * WORLD.sectorSize;
    const halfLocal = localWidth/2 + 3;
    
    if (isInView(bounds, pos, WORLD.height/2, 3)) {
      ctx.fillRect(pos - halfLocal, 0, 3, WORLD.height);
      ctx.fillRect(pos + localWidth/2, 0, 3, WORLD.height);
    }
    if (isInView(bounds, WORLD.width/2, pos, 3)) {
      ctx.fillRect(0, pos - halfLocal, WORLD.width, 3);
      ctx.fillRect(0, pos + localWidth/2, WORLD.width, 3);
    }
  }
}

function renderBuildings(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Generate buildings per sector
  for (let sy = 0; sy < WORLD.gridSize; sy++) {
    for (let sx = 0; sx < WORLD.gridSize; sx++) {
      const sectorX = sx * WORLD.sectorSize;
      const sectorY = sy * WORLD.sectorSize;
      const centerX = sectorX + WORLD.sectorSize / 2;
      const centerY = sectorY + WORLD.sectorSize / 2;
      
      if (!isInView(bounds, centerX, centerY, WORLD.sectorSize)) continue;
      
      // Skip road sectors
      if (sx % 4 === 0 || sy % 4 === 0) continue;
      if (sx === 0 || sx === WORLD.gridSize - 1 || sy === 0 || sy === WORLD.gridSize - 1) continue;
      
      const district = getDistrictAt(centerX, centerY);
      const buildingCount = getBuildingCountForDistrict(district);
      const sectorSeed = sy * WORLD.gridSize + sx + 10000;
      const rng = createSeededRandom(sectorSeed);
      
      for (let b = 0; b < buildingCount; b++) {
        renderBuilding(renderer, sectorX, sectorY, district, rng, bounds);
      }
    }
  }
}

function getBuildingCountForDistrict(district) {
  switch (district.type) {
    case 'urban': return 8 + Math.floor(Math.random() * 4);
    case 'downtown': return 10 + Math.floor(Math.random() * 5);
    case 'industrial': return 4 + Math.floor(Math.random() * 3);
    case 'residential': return 6 + Math.floor(Math.random() * 3);
    case 'luxury': return 3 + Math.floor(Math.random() * 2);
    case 'gang': return 5 + Math.floor(Math.random() * 3);
    case 'airport': return 2;
    case 'beach': return 2 + Math.floor(Math.random() * 2);
    default: return 4;
  }
}

function renderBuilding(renderer, sectorX, sectorY, district, rng, bounds) {
  const ctx = renderer.ctx;
  
  // Building position within sector (avoid roads)
  const margin = 20;
  const buildableW = WORLD.sectorSize - ROAD_NETWORK.localWidth - margin * 2;
  const buildableH = WORLD.sectorSize - ROAD_NETWORK.localWidth - margin * 2;
  
  const bx = sectorX + ROAD_NETWORK.localWidth/2 + margin + rng() * buildableW;
  const by = sectorY + ROAD_NETWORK.localWidth/2 + margin + rng() * buildableH;
  
  // Building size
  const baseSize = getBuildingBaseSize(district);
  const width = baseSize * (0.7 + rng() * 0.6);
  const height = baseSize * (0.7 + rng() * 0.6);
  const rotation = rng() < 0.3 ? rng() * Math.PI / 4 : 0;
  
  // Check bounds
  if (!isInView(bounds, bx, by, Math.max(width, height) * 1.5)) return;
  
  // Building colors
  const baseColor = district.color || PALETTE.building;
  const buildingColor = darkenColor(baseColor, 0.1 + rng() * 0.2);
  const roofColor = darkenColor(buildingColor, 0.3);
  const windowColor = rng() < 0.3 ? PALETTE.windowLit : PALETTE.window;
  
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(rotation);
  
  // Building shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(4, 4, width, height);
  
  // Building base
  ctx.fillStyle = buildingColor;
  ctx.fillRect(-width/2, -height/2, width, height);
  
  // Roof (isometric style - top face)
  const roofInset = 3;
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(-width/2 + roofInset, -height/2 + roofInset);
  ctx.lineTo(width/2 - roofInset, -height/2 + roofInset);
  ctx.lineTo(width/2 - roofInset, height/2 - roofInset);
  ctx.lineTo(-width/2 + roofInset, height/2 - roofInset);
  ctx.closePath();
  ctx.fill();
  
  // Roof details (AC units, vents)
  if (width > 40 && height > 40) {
    ctx.fillStyle = darkenColor(roofColor, 0.2);
    const detailCount = Math.floor((width * height) / 2000);
    for (let d = 0; d < detailCount; d++) {
      const dx = (rng() - 0.5) * width * 0.6;
      const dy = (rng() - 0.5) * height * 0.6;
      const dw = 6 + rng() * 10;
      const dh = 6 + rng() * 10;
      ctx.fillRect(dx - dw/2, dy - dh/2, dw, dh);
    }
  }
  
  // Windows
  renderBuildingWindows(ctx, width, height, district, rng, windowColor);
  
  // Entrance
  if (rng() < 0.4) {
    ctx.fillStyle = darkenColor(buildingColor, 0.4);
    const ew = 8;
    const eh = 16;
    const side = Math.floor(rng() * 4);
    let ex, ey;
    switch (side) {
      case 0: ex = 0; ey = -height/2; break;
      case 1: ex = width/2; ey = 0; break;
      case 2: ex = 0; ey = height/2; break;
      case 3: ex = -width/2; ey = 0; break;
    }
    ctx.fillRect(ex - ew/2, ey - eh/2, ew, eh);
  }
  
  ctx.restore();
}

function getBuildingBaseSize(district) {
  switch (district.type) {
    case 'urban': return 60;
    case 'downtown': return 80;
    case 'industrial': return 100;
    case 'residential': return 40;
    case 'luxury': return 70;
    case 'gang': return 50;
    case 'airport': return 200;
    case 'beach': return 30;
    default: return 50;
  }
}

function renderBuildingWindows(ctx, width, height, district, rng, windowColor) {
  const windowSize = 4;
  const windowGap = 8;
  const cols = Math.floor((width - 10) / (windowSize + windowGap));
  const rows = Math.floor((height - 10) / (windowSize + windowGap));
  
  const litChance = district.type === 'urban' || district.type === 'downtown' ? 0.7 :
                    district.type === 'residential' ? 0.5 :
                    district.type === 'industrial' ? 0.3 : 0.6;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng() > litChance) continue;
      
      const wx = -width/2 + 8 + col * (windowSize + windowGap);
      const wy = -height/2 + 8 + row * (windowSize + windowGap);
      
      // Window glow
      const glowColor = rng() < 0.5 ? PALETTE.windowLit : PALETTE.window;
      const alpha = rng() * 0.5 + 0.3;
      
      ctx.fillStyle = glowColor + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillRect(wx, wy, windowSize, windowSize);
    }
  }
}

function renderProps(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Street lights
  renderStreetLights(renderer, bounds);
  
  // Traffic lights
  renderTrafficLights(renderer, bounds);
  
  // Props by district
  renderDistrictProps(renderer, world, bounds);
  
  // Pickups
  renderPickups(renderer, world, bounds);
}

function renderStreetLights(renderer, bounds) {
  const ctx = renderer.ctx;
  const hour = (renderer.timeOfDay / 3600) % 24;
  const isNight = hour > 19 || hour < 6;
  
  if (!isNight) return;
  
  const spacing = ROAD_NETWORK.mainSpacing;
  const mainWidth = ROAD_NETWORK.mainWidth;
  
  ctx.fillStyle = '#ffd700';
  ctx.globalAlpha = 0.8;
  
  for (let i = 0; i <= WORLD.gridSize; i += spacing) {
    const pos = i * WORLD.sectorSize;
    const offset = mainWidth/2 + 10;
    
    // Vertical roads
    if (isInView(bounds, pos - offset, WORLD.height/2)) {
      for (let y = 0; y < WORLD.height; y += 80) {
        renderLightPole(ctx, pos - offset, y);
        renderLightPole(ctx, pos + offset, y);
      }
    }
    // Horizontal roads
    if (isInView(bounds, WORLD.width/2, pos - offset)) {
      for (let x = 0; x < WORLD.width; x += 80) {
        renderLightPole(ctx, x, pos - offset);
        renderLightPole(ctx, x, pos + offset);
      }
    }
  }
  
  ctx.globalAlpha = 1;
}

function renderLightPole(ctx, x, y) {
  // Pole
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 1, y - 30, 2, 30);
  
  // Light
  const gradient = ctx.createRadialGradient(x, y - 35, 0, x, y - 35, 40);
  gradient.addColorStop(0, 'rgba(255, 230, 180, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y - 35, 40, 0, Math.PI * 2);
  ctx.fill();
}

function renderTrafficLights(renderer, bounds) {
  const ctx = renderer.ctx;
  const spacing = ROAD_NETWORK.mainSpacing;
  const interSize = ROAD_NETWORK.intersectionSize;
  const time = Date.now() / 1000;
  
  for (let sy = 0; sy <= WORLD.gridSize; sy += spacing) {
    for (let sx = 0; sx <= WORLD.gridSize; sx += spacing) {
      const x = sx * WORLD.sectorSize;
      const y = sy * WORLD.sectorSize;
      
      if (!isInView(bounds, x, y, interSize)) continue;
      
      // Traffic light cycle
      const cycle = Math.floor((time * 2 + sx * 7 + sy * 11) % 4);
      const nsGreen = cycle < 2;
      
      // Four corners
      const corners = [
        { x: x - interSize/2 - 5, y: y - interSize/2 - 5, ns: true },
        { x: x + interSize/2 + 5, y: y - interSize/2 - 5, ns: true },
        { x: x - interSize/2 - 5, y: y + interSize/2 + 5, ns: true },
        { x: x + interSize/2 + 5, y: y + interSize/2 + 5, ns: true },
      ];
      
      for (const corner of corners) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(corner.x - 3, corner.y - 25, 6, 25);
        
        // Lights
        const red = !nsGreen;
        const green = nsGreen;
        const yellow = false; // Simplified
        
        // Red
        ctx.fillStyle = red ? '#ff0000' : '#330000';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y - 18, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Yellow
        ctx.fillStyle = yellow ? '#ffff00' : '#333300';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y - 9, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Green
        ctx.fillStyle = green ? '#00ff00' : '#003300';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow
        if (red || green) {
          const glowColor = red ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 0, 0.5)';
          const gradient = ctx.createRadialGradient(corner.x, corner.y - (red ? 18 : 0), 0, corner.x, corner.y - (red ? 18 : 0), 15);
          gradient.addColorStop(0, glowColor);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(corner.x, corner.y - (red ? 18 : 0), 15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

function renderDistrictProps(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Simplified - render some district-specific props
  for (const district of DISTRICTS) {
    if (district.ring) continue;
    
    const x = district.x * WORLD.sectorSize;
    const y = district.y * WORLD.sectorSize;
    const w = district.w * WORLD.sectorSize;
    const h = district.h * WORLD.sectorSize;
    
    if (!isInView(bounds, x + w/2, y + h/2, Math.max(w, h))) continue;
    
    const rng = createSeededRandom(district.x * 1000 + district.y + 20000);
    const propCount = Math.floor((w * h) / 50000);
    
    for (let i = 0; i < propCount; i++) {
      const px = x + rng() * w;
      const py = y + rng() * h;
      
      if (isOnRoad({ width: WORLD.width, height: WORLD.height }, px, py)) continue;
      
      renderDistrictProp(ctx, px, py, district.type, rng);
    }
  }
}

function renderDistrictProp(ctx, x, y, districtType, rng) {
  ctx.save();
  ctx.translate(x, y);
  
  switch (districtType) {
    case 'beach':
      // Palm trees
      if (rng() < 0.7) renderPalmTree(ctx, rng);
      // Umbrellas
      else if (rng() < 0.4) renderBeachUmbrella(ctx, rng);
      break;
    case 'wilderness':
    case 'everglades':
      // Trees
      renderTree(ctx, rng);
      break;
    case 'industrial':
      // Containers, pipes
      if (rng() < 0.5) renderContainer(ctx, rng);
      else renderPipe(ctx, rng);
      break;
    case 'luxury':
      // Fountains, statues
      if (rng() < 0.3) renderFountain(ctx, rng);
      break;
    case 'airport':
      // Hangars, radar
      if (rng() < 0.3) renderRadar(ctx, rng);
      break;
    default:
      // Generic props
      if (rng() < 0.3) renderTree(ctx, rng);
  }
  
  ctx.restore();
}

function renderPalmTree(ctx, rng) {
  const height = 30 + rng() * 20;
  const lean = (rng() - 0.5) * 0.3;
  
  // Trunk
  ctx.strokeStyle = '#8b6b4a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= 5; i++) {
    const py = -height * i / 5;
    const px = Math.sin(i * 0.5 + lean) * 3;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  
  // Fronds
  ctx.fillStyle = '#2d5a27';
  for (let f = 0; f < 5; f++) {
    const angle = (f / 5) * Math.PI * 2;
    const length = 15 + rng() * 10;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -height);
    ctx.quadraticCurveTo(Math.cos(angle) * length, -height - length/2, 0, -height - length);
    ctx.quadraticCurveTo(-Math.cos(angle) * length, -height - length/2, 0, -height);
    ctx.fill();
    ctx.restore();
  }
}

function renderBeachUmbrella(ctx, rng) {
  const colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];
  const color = colors[Math.floor(rng() * colors.length)];
  
  // Pole
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -25);
  ctx.stroke();
  
  // Canopy
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-15, -25);
  ctx.lineTo(0, -30);
  ctx.lineTo(15, -25);
  ctx.closePath();
  ctx.fill();
}

function renderTree(ctx, rng) {
  const type = rng() < 0.5 ? 'pine' : 'oak';
  const height = 20 + rng() * 20;
  const width = 15 + rng() * 15;
  
  if (type === 'pine') {
    // Trunk
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(-2, 0, 4, height * 0.4);
    
    // Foliage (triangles)
    ctx.fillStyle = '#1e3d1a';
    for (let i = 0; i < 3; i++) {
      const y = -height * (0.4 + i * 0.2);
      const w = width * (1 - i * 0.2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(-w/2, y + height * 0.25);
      ctx.lineTo(w/2, y + height * 0.25);
      ctx.fill();
    }
  } else {
    // Trunk
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(-3, 0, 6, height * 0.3);
    
    // Canopy
    ctx.fillStyle = '#2d5a27';
    ctx.beginPath();
    ctx.arc(0, -height * 0.3, width, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-width/2, -height * 0.5, width * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width/2, -height * 0.5, width * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderContainer(ctx, rng) {
  const w = 30;
  const h = 60;
  const colors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#2c3e50'];
  const color = colors[Math.floor(rng() * colors.length)];
  
  ctx.fillStyle = color;
  ctx.fillRect(-w/2, -h/2, w, h);
  
  // Doors
  ctx.fillStyle = darkenColor(color, 0.3);
  ctx.fillRect(-w/2 + 2, -h/2 + 2, w - 4, 8);
  ctx.fillRect(-w/2 + 2, h/2 - 10, w - 4, 8);
  
  // Details
  ctx.strokeStyle = darkenColor(color, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(-w/2, -h/2, w, h);
}

function renderPipe(ctx, rng) {
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo((rng() - 0.5) * 20, -30);
  ctx.lineTo((rng() - 0.5) * 20, -60);
  ctx.stroke();
  
  // Valve
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(0, -30, 4, 0, Math.PI * 2);
  ctx.fill();
}

function renderFountain(ctx, rng) {
  const r = 15 + rng() * 10;
  
  // Basin
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  
  // Water
  const time = Date.now() / 500;
  ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + time;
    const wx = Math.cos(angle) * r * 0.5;
    const wy = Math.sin(angle) * r * 0.5;
    ctx.beginPath();
    ctx.arc(wx, wy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderRadar(ctx, rng) {
  const time = Date.now() / 200;
  
  // Tower
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -50);
  ctx.stroke();
  
  // Radar dish
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(time);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(-20, -2, 40, 4);
  ctx.restore();
  
  // Sweep
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.lineTo(Math.cos(time) * 60, -50 + Math.sin(time) * 60);
  ctx.stroke();
}

function renderPickups(renderer, world, bounds) {
  const ctx = renderer.ctx;
  const time = Date.now() / 200;
  
  for (const pickup of world.pickups || []) {
    if (!pickup.active) continue;
    if (!isInView(bounds, pickup.x, pickup.y, 30)) continue;
    
    const colors = { health: '#e74c3c', armor: '#3498db', weapon: '#f39c12', money: '#27ae60' };
    const icons = { health: '+', armor: '◆', weapon: '■', money: '$' };
    const color = colors[pickup.type] || '#fff';
    const icon = icons[pickup.type] || '?';
    
    const bob = Math.sin(time + pickup.bobOffset) * 4;
    
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.rotate(time * 0.5);
    
    // Glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    gradient.addColorStop(0, color + '80');
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Pickup shape (rotating cube/coin)
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    if (pickup.type === 'money') {
      // Coin
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 3);
    } else {
      // Cube
      const size = 10;
      ctx.fillRect(-size/2, -size/2, size, size);
      ctx.strokeRect(-size/2, -size/2, size, size);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 3);
    }
    
    ctx.restore();
  }
}

function renderVehicles(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  // Sort vehicles by Y for proper draw order
  const vehicles = (world.vehicles || []).filter(v => v.active).sort((a, b) => a.y - b.y);
  
  for (const vehicle of vehicles) {
    if (!isInView(bounds, vehicle.x, vehicle.y, Math.max(vehicle.width, vehicle.length))) continue;
    
    renderVehicle(renderer, vehicle, world);
  }
}

function renderVehicle(renderer, vehicle, world) {
  const ctx = renderer.ctx;
  
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle);
  
  const hw = vehicle.width / 2;
  const hl = vehicle.length / 2;
  const isPlayer = world.player.inVehicle && world.player.vehicleId === vehicle.id;
  const isPolice = vehicle.isPolice;
  
  // Vehicle shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 3, hw * 0.8, hl * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body
  const bodyColor = vehicle.bodyColor || (isPolice ? '#1a1a2e' : PALETTE.carColors[0]);
  const roofColor = vehicle.roofColor || darkenColor(bodyColor, 0.3);
  const windowColor = vehicle.windowColor || PALETTE.window;
  
  // Main body (isometric box)
  drawVehicleBody(ctx, hw, hl, bodyColor, roofColor, windowColor, vehicle.type);
  
  // Wheels
  drawVehicleWheels(ctx, hw, hl, vehicle);
  
  // Lights
  drawVehicleLights(ctx, hw, hl, vehicle);
  
  // Police details
  if (isPolice) {
    drawPoliceDetails(ctx, hw, hl, vehicle);
  }
  
  // Damage
  if (vehicle.health < vehicle.maxHealth) {
    drawVehicleDamage(ctx, hw, hl, vehicle);
  }
  
  // Siren lights
  if (vehicle.siren && Math.floor(Date.now() / 150) % 2 === 0) {
    drawSirenLights(ctx, hw, hl, vehicle);
  }
  
  ctx.restore();
}

function drawVehicleBody(ctx, hw, hl, bodyColor, roofColor, windowColor, vType) {
  // Bottom face (shadowed)
  ctx.fillStyle = darkenColor(bodyColor, 0.4);
  ctx.beginPath();
  ctx.moveTo(-hw, -hl);
  ctx.lineTo(hw, -hl);
  ctx.lineTo(hw * 0.8, hl);
  ctx.lineTo(-hw * 0.8, hl);
  ctx.closePath();
  ctx.fill();
  
  // Top face (roof)
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.7, -hl * 0.7);
  ctx.lineTo(hw * 0.7, -hl * 0.7);
  ctx.lineTo(hw * 0.5, hl * 0.5);
  ctx.lineTo(-hw * 0.5, hl * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Side faces (3D effect)
  // Front
  ctx.fillStyle = darkenColor(bodyColor, 0.2);
  ctx.beginPath();
  ctx.moveTo(-hw, -hl);
  ctx.lineTo(hw, -hl);
  ctx.lineTo(hw * 0.7, -hl * 0.7);
  ctx.lineTo(-hw * 0.7, -hl * 0.7);
  ctx.closePath();
  ctx.fill();
  
  // Rear
  ctx.fillStyle = darkenColor(bodyColor, 0.3);
  ctx.beginPath();
  ctx.moveTo(-hw * 0.8, hl);
  ctx.lineTo(hw * 0.8, hl);
  ctx.lineTo(hw * 0.5, hl * 0.5);
  ctx.lineTo(-hw * 0.5, hl * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Left side
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-hw, -hl);
  ctx.lineTo(-hw * 0.7, -hl * 0.7);
  ctx.lineTo(-hw * 0.5, hl * 0.5);
  ctx.lineTo(-hw * 0.8, hl);
  ctx.closePath();
  ctx.fill();
  
  // Right side
  ctx.fillStyle = lightenColor(bodyColor, 0.1);
  ctx.beginPath();
  ctx.moveTo(hw, -hl);
  ctx.lineTo(hw * 0.7, -hl * 0.7);
  ctx.lineTo(hw * 0.5, hl * 0.5);
  ctx.lineTo(hw * 0.8, hl);
  ctx.closePath();
  ctx.fill();
  
  // Windows
  ctx.fillStyle = windowColor;
  // Front window
  ctx.beginPath();
  ctx.moveTo(-hw * 0.6, -hl * 0.6);
  ctx.lineTo(hw * 0.6, -hl * 0.6);
  ctx.lineTo(hw * 0.4, -hl * 0.2);
  ctx.lineTo(-hw * 0.4, -hl * 0.2);
  ctx.fill();
  // Rear window
  ctx.beginPath();
  ctx.moveTo(-hw * 0.4, hl * 0.2);
  ctx.lineTo(hw * 0.4, hl * 0.2);
  ctx.lineTo(hw * 0.3, hl * 0.4);
  ctx.lineTo(-hw * 0.3, hl * 0.4);
  ctx.fill();
  // Side windows
  ctx.beginPath();
  ctx.moveTo(-hw * 0.7, -hl * 0.7);
  ctx.lineTo(-hw * 0.3, -hl * 0.3);
  ctx.lineTo(-hw * 0.3, hl * 0.3);
  ctx.lineTo(-hw * 0.7, hl * 0.7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hw * 0.7, -hl * 0.7);
  ctx.lineTo(hw * 0.3, -hl * 0.3);
  ctx.lineTo(hw * 0.3, hl * 0.3);
  ctx.lineTo(hw * 0.7, hl * 0.7);
  ctx.fill();
  
  // Door lines
  ctx.strokeStyle = darkenColor(bodyColor, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.1, -hl * 0.7);
  ctx.lineTo(-hw * 0.1, hl * 0.5);
  ctx.moveTo(hw * 0.1, -hl * 0.7);
  ctx.lineTo(hw * 0.1, hl * 0.5);
  ctx.stroke();
}

function drawVehicleWheels(ctx, hw, hl, vehicle) {
  const wheelR = Math.min(hw, hl) * 0.35;
  const wheelW = wheelR * 0.6;
  const positions = [
    { x: -hw * 0.9, y: -hl * 0.9 }, // FL
    { x: hw * 0.9, y: -hl * 0.9 },  // FR
    { x: -hw * 0.9, y: hl * 0.9 },  // RL
    { x: hw * 0.9, y: hl * 0.9 },   // RR
  ];
  
  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    const angle = vehicle.wheelAngles?.[i] || 0;
    
    // Tire
    ctx.fillStyle = vehicle.wheelColor || '#1a1a1a';
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, wheelR, wheelW, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rim
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(0, 0, wheelR * 0.6, wheelW * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rim spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (let s = 0; s < 5; s++) {
      const spokeAngle = s * Math.PI * 2 / 5 + angle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(spokeAngle) * wheelR * 0.5, Math.sin(spokeAngle) * wheelW * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    
    // Suspension
    const susp = vehicle.suspension?.[i] || 0;
    if (susp !== 0) {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - wheelR);
      ctx.lineTo(pos.x, pos.y - wheelR - susp * 5);
      ctx.stroke();
    }
  }
}

function drawVehicleLights(ctx, hw, hl, vehicle) {
  // Headlights
  if (vehicle.headlights || vehicle.speed > 0) {
    const gradient = ctx.createLinearGradient(0, -hl, 0, -hl - 100);
    gradient.addColorStop(0, 'rgba(255, 255, 220, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, -hl);
    ctx.lineTo(-hw * 0.3, -hl);
    ctx.lineTo(-hw * 0.4, -hl - 100);
    ctx.lineTo(-hw * 0.6, -hl - 100);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(hw * 0.3, -hl);
    ctx.lineTo(hw * 0.5, -hl);
    ctx.lineTo(hw * 0.6, -hl - 100);
    ctx.lineTo(hw * 0.4, -hl - 100);
    ctx.closePath();
    ctx.fill();
    
    // Light source
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.4, -hl, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hw * 0.4, -hl, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Taillights
  if (vehicle.brakeLights || vehicle.reverseLights) {
    ctx.fillStyle = vehicle.reverseLights ? '#fff' : '#ff0000';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.6, hl, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hw * 0.6, hl, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Brake light glow
    if (vehicle.brakeLights) {
      const gradient = ctx.createRadialGradient(0, hl, 0, 0, hl, 30);
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, hl, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPoliceDetails(ctx, hw, hl, vehicle) {
  // Police stripe
  ctx.fillStyle = '#fff';
  ctx.fillRect(-hw, -hl * 0.8, hw * 2, 3);
  
  // "POLICE" text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 0, -hl * 0.5);
  
  // Light bar on roof
  ctx.fillStyle = '#111';
  ctx.fillRect(-hw * 0.6, -hl * 0.7, hw * 1.2, 6);
  
  // Siren lights (drawn in drawSirenLights)
}

function drawSirenLights(ctx, hw, hl, vehicle) {
  const time = Date.now() / 100;
  const flash = Math.floor(time) % 2 === 0;
  
  // Light bar
  const barY = -hl * 0.7;
  const barW = hw * 1.2;
  
  if (flash) {
    // Red left, blue right
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-barW/2, barY, barW/2, 6);
    
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, barY, barW/2, 6);
    
    // Glow
    const redGlow = ctx.createRadialGradient(-barW/4, barY + 3, 0, -barW/4, barY + 3, 30);
    redGlow.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
    redGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = redGlow;
    ctx.beginPath();
    ctx.arc(-barW/4, barY + 3, 30, 0, Math.PI * 2);
    ctx.fill();
    
    const blueGlow = ctx.createRadialGradient(barW/4, barY + 3, 0, barW/4, barY + 3, 30);
    blueGlow.addColorStop(0, 'rgba(0, 0, 255, 0.6)');
    blueGlow.addColorStop(1, 'rgba(0, 0, 255, 0)');
    ctx.fillStyle = blueGlow;
    ctx.beginPath();
    ctx.arc(barW/4, barY + 3, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Swapped
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(-barW/2, barY, barW/2, 6);
    
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, barY, barW/2, 6);
  }
}

function drawVehicleDamage(ctx, hw, hl, vehicle) {
  const damageRatio = 1 - vehicle.health / vehicle.maxHealth;
  
  // Smoke
  if (vehicle.smokeLevel > 0) {
    ctx.globalAlpha = vehicle.smokeLevel * 0.5;
    ctx.fillStyle = '#555';
    for (let i = 0; i < 3; i++) {
      const sx = (Math.random() - 0.5) * hw;
      const sy = -hl + Math.random() * hl * 0.5;
      const sr = 5 + Math.random() * 10 * vehicle.smokeLevel;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  // Fire
  if (vehicle.fireLevel > 0) {
    ctx.globalAlpha = vehicle.fireLevel;
    const fireColors = ['#ff4400', '#ff8800', '#ffff00'];
    for (let i = 0; i < 5 * vehicle.fireLevel; i++) {
      const fx = (Math.random() - 0.5) * hw;
      const fy = -hl + Math.random() * hl;
      const fr = 3 + Math.random() * 8;
      const fc = fireColors[Math.floor(Math.random() * fireColors.length)];
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  // Damage decals
  for (const dmg of vehicle.damageParts || []) {
    ctx.fillStyle = dmg.type === 'dent' ? '#333' : '#1a1a1a';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(dmg.x, dmg.y, dmg.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function renderPeds(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  const peds = (world.peds || []).filter(p => p.active && p.state !== 'dead').sort((a, b) => a.y - b.y);
  
  for (const ped of peds) {
    if (!isInView(bounds, ped.x, ped.y, Math.max(ped.width, ped.height))) continue;
    
    renderPed(renderer, ped, world);
  }
  
  // Dead peds (render last so they're on top)
  const deadPeds = (world.peds || []).filter(p => p.active && p.state === 'dead');
  for (const ped of deadPeds) {
    if (!isInView(bounds, ped.x, ped.y, Math.max(ped.width, ped.height))) continue;
    renderDeadPed(renderer, ped);
  }
}

function renderPed(renderer, ped, world) {
  const ctx = renderer.ctx;
  const isPlayer = ped === world.player;
  
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 2, ped.width / 3, ped.height / 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  const bodyColor = ped.clothingColor || ped.color || PALETTE.pedColors[0];
  const skinColor = '#fdbcb4';
  
  // Body (simplified humanoid)
  // Torso
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-ped.width/2, -ped.height/2, ped.width, ped.height * 0.6);
  
  // Legs
  const legW = ped.width / 3;
  const legH = ped.height * 0.4;
  const walkCycle = ped.velocityX !== 0 || ped.velocityY !== 0 ? Date.now() / 100 : 0;
  const legOffset = Math.sin(walkCycle) * 3;
  
  ctx.fillStyle = darkenColor(bodyColor, 0.2);
  ctx.fillRect(-ped.width/2, ped.height * 0.1, legW, legH + legOffset);
  ctx.fillRect(ped.width/2 - legW, ped.height * 0.1, legW, legH - legOffset);
  
  // Arms
  const armW = ped.width / 4;
  const armH = ped.height * 0.5;
  const armOffset = Math.sin(walkCycle + Math.PI) * 3;
  
  ctx.fillStyle = skinColor;
  ctx.fillRect(-ped.width/2 - armW, -ped.height/2, armW, armH + armOffset);
  ctx.fillRect(ped.width/2, -ped.height/2, armW, armH - armOffset);
  
  // Head
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, -ped.height/2 - 4, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair/hat
  if (ped.type === 2) { // Gang
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.arc(0, -ped.height/2 - 6, 7, 0, Math.PI);
    ctx.fill();
  }
  
  // Health bar (enemies)
  if (ped.health < ped.maxHealth && ped.combatTarget) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-15, -ped.height/2 - 20, 30, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-15, -ped.height/2 - 20, 30 * (ped.health / ped.maxHealth), 4);
  }
  
  ctx.restore();
}

function renderDeadPed(renderer, ped) {
  const ctx = renderer.ctx;
  
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle + Math.PI/2); // Lying down
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, ped.width / 2, ped.height / 6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  const bodyColor = ped.clothingColor || ped.color || PALETTE.pedColors[0];
  const skinColor = '#fdbcb4';
  
  // Body lying down
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-ped.height/2, -ped.width/2, ped.height, ped.width);
  
  // Head
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(-ped.height/2 - 4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function renderEffects(renderer, world, bounds) {
  const ctx = renderer.ctx;
  
  for (const effect of renderer.effects) {
    if (!isInView(bounds, effect.x, effect.y, effect.radius || 50)) continue;
    
    switch (effect.type) {
      case 'explosion':
        renderExplosionEffect(ctx, effect);
        break;
      case 'heli_crash':
        renderHeliCrashEffect(ctx, effect);
        break;
      case 'smoke':
        renderSmokeEffect(ctx, effect);
        break;
      case 'fire':
        renderFireEffect(ctx, effect);
        break;
      case 'blood':
        renderBloodEffect(ctx, effect);
        break;
    }
  }
}

function renderExplosionEffect(ctx, effect) {
  const progress = effect.timer / effect.duration;
  const radius = effect.maxRadius * progress;
  const alpha = 1 - progress;
  
  // Shockwave
  ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.8})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Fireball
  const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
  gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
  gradient.addColorStop(0.3, `rgba(255, 100, 0, ${alpha * 0.7})`);
  gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Debris
  ctx.fillStyle = `rgba(100, 50, 20, ${alpha})`;
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + progress * 5;
    const dx = Math.cos(angle) * radius * 1.2;
    const dy = Math.sin(angle) * radius * 1.2;
    ctx.beginPath();
    ctx.arc(effect.x + dx, effect.y + dy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderHeliCrashEffect(ctx, effect) {
  const progress = effect.timer / effect.duration;
  const alpha = 1 - progress;
  
  // Smoke trail
  ctx.fillStyle = `rgba(50, 50, 50, ${alpha * 0.5})`;
  for (let i = 0; i < 20; i++) {
    const px = effect.x + (Math.random() - 0.5) * 100;
    const py = effect.y + (Math.random() - 0.5) * 100 - progress * 50;
    const pr = 5 + Math.random() * 15;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Fire
  ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.8})`;
  for (let i = 0; i < 10; i++) {
    const px = effect.x + (Math.random() - 0.5) * 60;
    const py = effect.y + (Math.random() - 0.5) * 60;
    const pr = 3 + Math.random() * 10;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderSmokeEffect(ctx, effect) {
  const progress = effect.timer / effect.duration;
  const alpha = (1 - progress) * (effect.alpha || 0.5);
  
  ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
  for (let i = 0; i < 5; i++) {
    const px = effect.x + (Math.random() - 0.5) * 30;
    const py = effect.y - progress * 30 + (Math.random() - 0.5) * 20;
    const pr = 10 + progress * 20;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderFireEffect(ctx, effect) {
  const progress = effect.timer / effect.duration;
  const alpha = (1 - progress) * (effect.alpha || 1);
  
  const colors = ['#ff4400', '#ff8800', '#ffaa00', '#ffff00'];
  for (let i = 0; i < 8; i++) {
    const px = effect.x + (Math.random() - 0.5) * 20;
    const py = effect.y - progress * 40 + (Math.random() - 0.5) * 10;
    const pr = 3 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderBloodEffect(ctx, effect) {
  ctx.fillStyle = `rgba(139, 0, 0, ${0.7})`;
  for (let i = 0; i < 5; i++) {
    const px = effect.x + (Math.random() - 0.5) * 10;
    const py = effect.y + (Math.random() - 0.5) * 10;
    const pr = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderHUDOverlay(renderer, world) {
  // HUD is rendered by hud.js separately
  // This is for any world-space HUD elements
}

function renderDebug(renderer, world) {
  const ctx = renderer.ctx;
  const canvas = renderer.canvas;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 250, 150);
  
  ctx.fillStyle = '#0f0';
  ctx.font = '12px monospace';
  ctx.fillText(`FPS: ${Math.round(1 / (world.lastDt || 0.016))}`, 20, 30);
  ctx.fillText(`Entities: ${(world.vehicles||[]).filter(v=>v.active).length}V ${(world.peds||[]).filter(p=>p.active).length}P`, 20, 50);
  ctx.fillText(`Player: ${Math.round(world.player.x)}, ${Math.round(world.player.y)}`, 20, 70);
  ctx.fillText(`Wanted: ${world.player.wantedLevel}`, 20, 90);
  ctx.fillText(`Vehicle: ${world.player.inVehicle ? 'YES' : 'NO'}`, 20, 110);
  ctx.fillText(`Time: ${Math.floor(world.timeOfDay/3600)}:${String(Math.floor((world.timeOfDay%3600)/60)).padStart(2,'0')}`, 20, 130);
  ctx.fillText(`Weather: ${world.weather}`, 20, 150);
}

export function worldToScreen(renderer, worldX, worldY) {
  const cam = renderer.camera;
  const canvas = renderer.canvas;
  
  return {
    x: canvas.width / 2 + (worldX - cam.x) * cam.zoom,
    y: canvas.height / 2 + (worldY - cam.y) * cam.zoom,
  };
}

export function screenToWorld(renderer, screenX, screenY) {
  const cam = renderer.camera;
  const canvas = renderer.canvas;
  
  return {
    x: cam.x + (screenX - canvas.width / 2) / cam.zoom,
    y: cam.y + (screenY - canvas.height / 2) / cam.zoom,
  };
}