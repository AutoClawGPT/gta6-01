// GTA 6: Vesper Bay - Main Entry Point
// Open-world crime game for make.fun bounty gta6-01
import { WORLD, PLAYER, VEHICLE, PEDESTRIAN, TRAFFIC, POLICE, MISSION, PALETTE, TIME, WEATHER, SAVE, CHEATS, DISTRICTS, ROAD_NETWORK, FONT, FONT_MONO } from './config.js';
import { createWorld, KIND_PLAYER, KIND_VEHICLE, KIND_PED, KIND_POLICE, KIND_MISSION_MARKER, KIND_CHECKPOINT, KIND_PICKUP, VEH_TYPE_CAR, VEH_TYPE_MOTORCYCLE, VEH_TYPE_TRUCK, VEH_TYPE_POLICE, EVENT_ENTER_VEHICLE, EVENT_EXIT_VEHICLE, EVENT_MISSION_START, EVENT_MISSION_COMPLETE, EVENT_MISSION_FAIL, EVENT_WANTED_CHANGE, EVENT_PLAYER_DEATH, EVENT_PLAYER_WASTED, EVENT_CHECKPOINT, EVENT_PICKUP, STEP, MAX_FRAME, distance, distanceSq, angleTo, normalizeAngle, clamp, lerp, isOnRoad, getRoadDirection, getDistrictAt, findRoadPosition } from './world.js';
import { createVehicle, VEH_TYPE_CAR as V_CAR, VEH_TYPE_MOTORCYCLE as V_MOTO, VEH_TYPE_TRUCK as V_TRUCK, VEH_TYPE_POLICE as V_POLICE, VEHICLE_STATES, updateVehicle, createTrafficVehicle, createPoliceVehicle, getVehicleCorners, getVehicleSpeed, getVehicleGear, explodeVehicle } from './vehicles.js';
import { createPoliceSystem, WANTED_NONE, WANTED_ONE, WANTED_TWO, WANTED_THREE, WANTED_FOUR, WANTED_FIVE, POLICE_STATES, POLICE_UNIT_TYPES, updatePolice, addWanted, setWantedLevel, clearWanted, onPlayerDeath, onPlayerArrested, onPlayerEscaped, getWantedConfig, getPoliceUnitCount, getActiveHelicopterCount, getActiveRoadblockCount, getActiveSpikeStripCount, renderPoliceMinimap } from './police.js';
import { createMissionSystem, MISSION_TYPE, OBJECTIVE_TYPE, MISSION_STATE, initializeMissions, updateMissions, getActiveMission, getMissionProgress, getAvailableMissions, getCompletedMissions, isMissionCompleted, getMissionStats } from './missions.js';
import { createHUD, updateHUD, renderHUD } from './hud.js';
import { createRenderer, updateRenderer, render, addEffect, addScreenShake, worldToScreen, screenToWorld } from './render.js';
import { createRandom } from './random.js';
import { SHOT_SCENES, applyShot, captureScreenshot } from './shots.js';

// ============ GAME STATE ============
const canvas = document.getElementById('game-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');

let gameState = 'loading'; // loading, playing, paused, menu
let lastTime = 0;
let accumulator = 0;
let frameCount = 0;
let fps = 60;
let debugMode = false;

const rng = createRandom(0x67A6B1CE); // GTA6VICE in hex (G=6, T=7, A=A, 6=6, V->B, I=1, C=C, E=E) - valid hex digits only

// World systems
let world = null;
let renderer = null;
let hud = null;
let police = null;
let missions = null;

// Input state
const input = {
  left: false, right: false, up: false, down: false,
  sprint: false, action: false, attack: false, aim: false,
  enterVehicle: false, pause: false, map: false,
  lights: false, reload: false,
  weapon: 1,
  cheatBuffer: '',
  cheatTimer: 0,
};

// Key mapping
const keyMap = {
  'KeyW': 'up', 'ArrowUp': 'up',
  'KeyS': 'down', 'ArrowDown': 'down',
  'KeyA': 'left', 'ArrowLeft': 'left',
  'KeyD': 'right', 'ArrowRight': 'right',
  'ShiftLeft': 'sprint', 'ShiftRight': 'sprint',
  'Space': 'action',
  'KeyE': 'enterVehicle',
  'Escape': 'pause',
  'KeyM': 'map',
  'KeyL': 'lights',
  'KeyR': 'reload',
  'Backquote': 'cheat',
  'Digit1': 'weapon1',
  'Digit2': 'weapon2',
  'Digit3': 'weapon3',
  'Digit4': 'weapon4',
  'Digit5': 'weapon5',
  'Digit6': 'weapon6',
};

// ============ INITIALIZATION ============
async function init() {
  updateLoading(10, 'Creating canvas...');
  
  // Canvas setup
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = false;
  
  updateLoading(20, 'Initializing world...');
  
  // Create world
  world = createWorld(rng);
  world.canvas = canvas;
  world.ctx = ctx;
  world.lastDt = 0;
  
  updateLoading(40, 'Creating renderer...');
  
  // Create renderer
  renderer = createRenderer(canvas);
  world.renderer = renderer;
  
  updateLoading(50, 'Creating HUD...');
  
  // Create HUD
  hud = createHUD(canvas);
  world.hud = hud;
  
  updateLoading(60, 'Initializing police system...');
  
  // Create police system
  police = createPoliceSystem();
  world.police = police;
  
  updateLoading(70, 'Loading missions...');
  
  // Create mission system
  missions = createMissionSystem();
  initializeMissions(missions);
  world.missions = missions;
  world.activeMission = null;
  world.missionMarkers = [];
  world.gpsRoute = [];
  world.gpsTarget = null;
  world.messages = [];
  world.subtitles = [];
  world.zoneName = '';
  world.zoneNameTimer = 0;
  world.addMessage = (text, duration) => {
    world.messages.push({ text, timer: duration, alpha: 1 });
    if (world.messages.length > 5) world.messages.shift();
  };
  
  updateLoading(80, 'Spawning initial entities...');
  
  // Spawn initial traffic and peds
  spawnInitialPopulation(world, rng);
  
  updateLoading(90, 'Setting up input...');
  
  // Setup input handlers
  setupInput();
  
  updateLoading(100, 'Ready!');
  
  // Hide loading screen
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    gameState = 'playing';
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }, 500);
}

function updateLoading(percent, text) {
  loadingProgress.style.width = percent + '%';
  loadingText.textContent = text;
}

function spawnInitialPopulation(world, rng) {
  // Spawn traffic on main roads
  for (let i = 0; i < 20; i++) {
    const vehicle = createTrafficVehicle(world, rng() * WORLD.width, rng() * WORLD.height);
    if (vehicle) {
      vehicle.id = 1000 + i;
      world.vehicles.push(vehicle);
    }
  }
  
  // Spawn peds in residential/commercial areas
  for (let i = 0; i < 50; i++) {
    const sectorX = Math.floor(rng() * WORLD.gridSize);
    const sectorY = Math.floor(rng() * WORLD.gridSize);
    const district = DISTRICTS.find(d => !d.ring && sectorX >= d.x && sectorX < d.x + d.w && sectorY >= d.y && sectorY < d.y + d.h);
    if (district && district.type !== 'industrial' && district.type !== 'wilderness') {
      const x = sectorX * WORLD.sectorSize + rng() * WORLD.sectorSize;
      const y = sectorY * WORLD.sectorSize + rng() * WORLD.sectorSize;
      if (!isOnRoad(world, x, y)) {
        const ped = spawnPed(world, x, y, getPedTypeForDistrict(district));
        if (ped) ped.id = 2000 + i;
      }
    }
  }
}

function getPedTypeForDistrict(district) {
  const types = {
    urban: ['civilian', 'business', 'tourist'],
    residential: ['civilian', 'civilian', 'tourist'],
    beach: ['tourist', 'tourist', 'civilian'],
    luxury: ['business', 'tourist', 'civilian'],
    gang: ['gang', 'civilian'],
    airport: ['business', 'tourist', 'civilian'],
    industrial: ['civilian'],
    wilderness: ['tourist'],
  };
  const list = types[district.type] || ['civilian'];
  return list[Math.floor(rng() * list.length)];
}

function spawnPed(world, x, y, typeName) {
  // Simplified ped creation for initial spawn
  const ped = {
    id: world.peds.length,
    type: typeName === 'civilian' ? 0 : typeName === 'business' ? 1 : typeName === 'gang' ? 2 : 3,
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    velocityX: 0, velocityY: 0,
    width: PEDESTRIAN.width,
    height: PEDESTRIAN.height,
    health: 100, maxHealth: 100,
    state: 'walk',
    targetX: x, targetY: y,
    wanderTimer: rng() * 5,
    wanderAngle: rng() * Math.PI * 2,
    fleeFrom: null, combatTarget: null, attackCooldown: 0,
    isGang: typeName === 'gang', gangId: typeName === 'gang' ? Math.floor(rng() * 3) : -1,
    color: typeName === 'civilian' ? '#8dd3c7' : typeName === 'business' ? '#ffffb3' : typeName === 'gang' ? '#fb8072' : '#80b1d3',
    clothingColor: PALETTE.pedColors[Math.floor(rng() * PALETTE.pedColors.length)],
    active: true,
  };
  world.peds.push(ped);
  return ped;
}

// ============ INPUT HANDLING ============
function setupInput() {
  window.addEventListener('keydown', (e) => {
    const action = keyMap[e.code];
    if (action) {
      e.preventDefault();
      handleKeyDown(action);
    }
  });
  
  window.addEventListener('keyup', (e) => {
    const action = keyMap[e.code];
    if (action) {
      e.preventDefault();
      handleKeyUp(action);
    }
  });
  
  window.addEventListener('blur', () => {
    // Release all keys on blur
    Object.keys(input).forEach(k => { if (typeof input[k] === 'boolean') input[k] = false; });
  });
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    hud = createHUD(canvas);
    world.hud = hud;
    renderer.canvas = canvas;
    renderer.ctx = canvas.getContext('2d');
  });
  
  // Mouse for aiming
  canvas.addEventListener('mousemove', (e) => {
    if (gameState === 'playing' && !world.player.inVehicle) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      world.player.angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    }
  });
  
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.attack = true;
    if (e.button === 2) input.aim = true;
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.attack = false;
    if (e.button === 2) input.aim = false;
  });
  
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Screenshot buttons
  document.querySelectorAll('.screenshot-btn button[data-shot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const shot = btn.dataset.shot;
      if (shot === 'debug') {
        debugMode = !debugMode;
        document.getElementById('debug-overlay').classList.toggle('visible', debugMode);
        btn.textContent = debugMode ? '🐛 Debug ON' : '🐛 Debug';
        return;
      }
      takeScreenshot(shot);
    });
  });
}

function handleKeyDown(action) {
  switch (action) {
    case 'up': input.up = true; break;
    case 'down': input.down = true; break;
    case 'left': input.left = true; break;
    case 'right': input.right = true; break;
    case 'sprint': input.sprint = true; break;
    case 'action': input.action = true; break;
    case 'enterVehicle': input.enterVehicle = true; break;
    case 'pause': input.pause = true; break;
    case 'map': input.map = true; break;
    case 'lights': input.lights = true; break;
    case 'reload': input.reload = true; break;
    case 'cheat': input.cheatTimer = 1; break;
    case 'weapon1': input.weapon = 1; switchWeapon(world.player, 'fist'); break;
    case 'weapon2': input.weapon = 2; switchWeapon(world.player, 'pistol'); break;
    case 'weapon3': input.weapon = 3; switchWeapon(world.player, 'smg'); break;
    case 'weapon4': input.weapon = 4; switchWeapon(world.player, 'rifle'); break;
    case 'weapon5': input.weapon = 5; switchWeapon(world.player, 'shotgun'); break;
    case 'weapon6': input.weapon = 6; switchWeapon(world.player, 'sniper'); break;
  }
}

function handleKeyUp(action) {
  switch (action) {
    case 'up': input.up = false; break;
    case 'down': input.down = false; break;
    case 'left': input.left = false; break;
    case 'right': input.right = false; break;
    case 'sprint': input.sprint = false; break;
    case 'action': input.action = false; break;
    case 'enterVehicle': input.enterVehicle = false; break;
    case 'pause': input.pause = false; break;
    case 'map': input.map = false; break;
    case 'lights': input.lights = false; break;
    case 'reload': input.reload = false; break;
    case 'cheat': 
      if (input.cheatTimer > 0) {
        handleCheatInput(world, input.cheatBuffer);
        input.cheatBuffer = '';
      }
      input.cheatTimer = 0;
      break;
  }
}

function switchWeapon(player, weapon) {
  const weaponNames = { fist: 'fist', pistol: 'pistol', smg: 'smg', rifle: 'rifle', shotgun: 'shotgun', sniper: 'sniper' };
  if (weaponNames[weapon]) {
    player.weapon = weaponNames[weapon];
    world.addMessage(`Weapon: ${weapon.toUpperCase()}`, 1500);
  }
}

function handleCheatInput(world, cheat) {
  const normalized = cheat.toLowerCase().trim();
  const cheatCodes = CHEATS.codes;
  
  if (cheatCodes[normalized]) {
    executeCheat(world, cheatCodes[normalized].action);
    world.addMessage(`Cheat activated: ${cheatCodes[normalized].name}`, 3000);
  } else {
    world.addMessage(`Unknown cheat: ${cheat}`, 2000);
  }
}

function executeCheat(world, action) {
  const player = world.player;
  const police = world.police;
  
  switch (action) {
    case 'fillHealth':
      player.health = PLAYER.maxHealth;
      player.armor = PLAYER.maxArmor;
      break;
    case 'giveWeapons':
      player.weapon = 'rifle';
      player.ammo.pistol = 120;
      player.ammo.smg = 300;
      player.ammo.rifle = 240;
      player.ammo.shotgun = 64;
      player.ammo.sniper = 40;
      break;
    case 'clearWanted':
      clearWanted(police);
      player.wantedLevel = 0;
      break;
    case 'maxWanted':
      setWantedLevel(police, 5);
      break;
    case 'spawnSportsCar':
      spawnPlayerVehicle(world, VEH_TYPE_CAR, '#e74c3c');
      break;
    case 'spawnMotorcycle':
      spawnPlayerVehicle(world, VEH_TYPE_MOTORCYCLE, '#f39c12');
      break;
    case 'advanceTime':
      world.timeOfDay = (world.timeOfDay + 3600) % 86400;
      break;
    case 'toggleWeather':
      const weathers = ['clear', 'cloudy', 'rain', 'storm', 'fog'];
      const idx = weathers.indexOf(world.weather);
      world.targetWeather = weathers[(idx + 1) % weathers.length];
      break;
  }
}

function spawnPlayerVehicle(world, type, color) {
  const player = world.player;
  const vehicle = createVehicle(type, player.x + 20, player.y, player.angle, { state: VEHICLE_STATES.DRIVING, color });
  vehicle.id = Date.now();
  vehicle.active = true;
  vehicle.driver = { type: 'player' };
  world.vehicles.push(vehicle);
  
  if (!player.inVehicle) {
    player.inVehicle = true;
    player.vehicleId = vehicle.id;
    player.stats.vehiclesStolen++;
    world.addMessage('Vehicle spawned!', 2000);
  }
}

// ============ GAME LOOP ============
function gameLoop(currentTime) {
  if (gameState !== 'playing') {
    requestAnimationFrame(gameLoop);
    return;
  }
  
  const dt = Math.min((currentTime - lastTime) / 1000, MAX_FRAME);
  lastTime = currentTime;
  world.lastDt = dt;
  
  // Fixed timestep accumulation
  accumulator += dt;
  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
  }
  
  // Interpolation alpha
  const alpha = accumulator / STEP;
  
  renderFrame(alpha);
  
  // FPS counter
  frameCount++;
  if (frameCount % 60 === 0) {
    fps = Math.round(1 / dt);
  }
  
  // Debug overlay
  if (debugMode) {
    updateDebugOverlay();
  }
  
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  // Handle pause
  if (input.pause) {
    gameState = gameState === 'playing' ? 'paused' : 'playing';
    input.pause = false;
    return;
  }
  
  if (gameState === 'paused') return;
  
  // Update world (core simulation)
  const events = world.step(dt, input);
  
  // Update police
  updatePolice(police, world, dt);
  
  // Update missions
  updateMissions(missions, world, dt);
  
  // Update HUD
  updateHUD(hud, world, dt);
  
  // Update renderer
  updateRenderer(renderer, world, dt);
  
  // Handle events
  handleEvents(events);
  
  // Cheat buffer
  if (input.cheatTimer > 0) {
    input.cheatTimer -= dt;
    if (input.cheatTimer <= 0) input.cheatTimer = 0;
  }
}

function handleEvents(events) {
  if (events & EVENT_PLAYER_WASTED) {
    world.addMessage('WASTED', 5000);
    onPlayerDeath(police);
  }
  if (events & EVENT_WANTED_CHANGE) {
    // Wanted level changed - handled in police update
  }
  if (events & EVENT_MISSION_COMPLETE) {
    // Mission complete - handled in missions update
  }
  if (events & EVENT_ENTER_VEHICLE) {
    world.addMessage('Entered vehicle', 1500);
  }
  if (events & EVENT_EXIT_VEHICLE) {
    world.addMessage('Exited vehicle', 1500);
  }
}

function renderFrame(alpha) {
  // Render world
  render(renderer, world);
  
  // Render HUD (screen space)
  renderHUD(hud, world);
}

function updateDebugOverlay() {
  const overlay = document.getElementById('debug-overlay');
  const player = world.player;
  const cam = world.camera;
  
  overlay.innerHTML = `
    FPS: ${fps}<br>
    Entities: ${world.vehicles.filter(v=>v.active).length}V ${world.peds.filter(p=>p.active).length}P<br>
    Player: ${Math.round(player.x)}, ${Math.round(player.y)}<br>
    Angle: ${player.angle.toFixed(2)}<br>
    Speed: ${player.inVehicle ? getVehicleSpeed(world.vehicles.find(v=>v.id===player.vehicleId) || {speed:0}).toFixed(1) : player.speed.toFixed(1)}<br>
    Health: ${Math.round(player.health)}/${PLAYER.maxHealth}<br>
    Armor: ${Math.round(player.armor)}/${PLAYER.maxArmor}<br>
    Wanted: ${player.wantedLevel}★<br>
    In Vehicle: ${player.inVehicle ? 'YES' : 'NO'}<br>
    Vehicle ID: ${player.vehicleId}<br>
    Time: ${Math.floor(world.timeOfDay/3600)}:${String(Math.floor((world.timeOfDay%3600)/60)).padStart(2,'0')}<br>
    Weather: ${world.weather}${world.weatherTransition > 0 ? ` → ${world.targetWeather} (${(world.weatherTransition*100).toFixed(0)}%)` : ''}<br>
    Zone: ${world.zoneName || 'Unknown'}<br>
    Mission: ${world.activeMission ? world.activeMission.name : 'None'}<br>
    GPS: ${world.gpsTarget ? 'Active' : 'None'}<br>
    Police: ${getPoliceUnitCount(police)} units, ${getActiveHelicopterCount(police)} heli, ${getActiveRoadblockCount(police)} blocks, ${getActiveSpikeStripCount(police)} spikes<br>
    Camera: ${Math.round(cam.x)}, ${Math.round(cam.y)}<br>
    Draw Calls: ${renderer.stats.drawCalls}<br>
  `;
}

// ============ SCREENSHOTS ============
function takeScreenshot(shotName) {
  const world = applyShot(world, renderer, shotName);
  if (!world) return;
  
  // Force render
  renderFrame(0);
  
  // Capture
  const filename = `${shotName}_${Date.now()}.png`;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    world.addMessage(`Screenshot saved: ${filename}`, 3000);
  }, 'image/png');
}

// ============ SAVE/LOAD ============
function saveGame() {
  const saveData = world.getSaveData();
  localStorage.setItem(SAVE.key, JSON.stringify(saveData));
  world.addMessage('Game saved!', 2000);
}

function loadGame() {
  const saveData = JSON.parse(localStorage.getItem(SAVE.key) || 'null');
  if (saveData) {
    world.loadSaveData(saveData);
    world.addMessage('Game loaded!', 2000);
  } else {
    world.addMessage('No save found!', 2000);
  }
}

// Add save/load to cheat codes
CHEATS.codes.save = { name: 'Save Game', action: 'save' };
CHEATS.codes.load = { name: 'Load Game', action: 'load' };

const originalExecuteCheat = executeCheat;
executeCheat = function(world, action) {
  if (action === 'save') saveGame();
  else if (action === 'load') loadGame();
  else originalExecuteCheat(world, action);
};

// ============ START GAME ============
init().catch(err => {
  console.error('Failed to initialize game:', err);
  loadingText.textContent = 'Error: ' + err.message;
  loadingText.style.color = '#e74c3c';
});

// Export for debugging
window.game = { world, renderer, hud, police, missions, input, takeScreenshot, debugMode: () => debugMode = !debugMode };