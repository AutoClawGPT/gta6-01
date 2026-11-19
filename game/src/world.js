// GTA 6 Style Open-World Simulation
// The game's rules and state: city, player, vehicles, pedestrians, police, missions, time, weather
import {
  WORLD, PLAYER, VEHICLE, PEDESTRIAN, TRAFFIC, POLICE, MISSION, WEAPON,
  STEP, MAX_FRAME, PALETTE, DISTRICTS, ROAD_NETWORK, TIME, WEATHER, SAVE,
  CHEATS
} from './config.js';
import { createRandom } from './random.js';

let input = { up:false, down:false, left:false, right:false, sprint:false, action:false, attack:false, aim:false, enterVehicle:false, pause:false, map:false, lights:false, reload:false, cheatTimer:0, weapon:0 };

// Re-export for main.js
export { STEP, MAX_FRAME };

// Entity kinds
export const KIND_PLAYER = 0;
export const KIND_VEHICLE = 1;
export const KIND_PED = 2;
export const KIND_POLICE = 3;
export const KIND_MISSION_MARKER = 4;
export const KIND_CHECKPOINT = 5;
export const KIND_PICKUP = 6;

// Vehicle types
export const VEH_TYPE_CAR = 0;
export const VEH_TYPE_MOTORCYCLE = 1;
export const VEH_TYPE_TRUCK = 2;
export const VEH_TYPE_POLICE = 3;

// Mission types
export const MISSION_STORY = 0;
export const MISSION_SIDE = 1;
export const MISSION_STRANGER = 2;
export const MISSION_RACE = 3;

// Wanted levels
export const WANTED_NONE = 0;
export const WANTED_LOW = 1;
export const WANTED_MEDIUM = 2;
export const WANTED_HIGH = 3;
export const WANTED_VERY_HIGH = 4;
export const WANTED_MAX = 5;

// Events
export const EVENT_ENTER_VEHICLE = 1;
export const EVENT_EXIT_VEHICLE = 2;
export const EVENT_MISSION_START = 4;
export const EVENT_MISSION_COMPLETE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_WANTED_CHANGE = 32;
export const EVENT_PLAYER_DEATH = 64;
export const EVENT_PLAYER_WASTED = 128;
export const EVENT_CHECKPOINT = 256;
export const EVENT_PICKUP = 512;

// Helper functions
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

export function normalizeAngle(angle) {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

function angleDiff(a, b) {
  const diff = normalizeAngle(b - a);
  return diff;
}

// Road network queries
export function isOnRoad(world, x, y) {
  const sectorX = Math.floor(x / WORLD.sectorSize);
  const sectorY = Math.floor(y / WORLD.sectorSize);
  if (sectorX < 0 || sectorX >= WORLD.gridSize || sectorY < 0 || sectorY >= WORLD.gridSize) return false;
  
  const localX = x % WORLD.sectorSize;
  const localY = y % WORLD.sectorSize;
  const spacing = ROAD_NETWORK.mainSpacing;
  const mainWidth = ROAD_NETWORK.mainWidth;
  const localWidth = ROAD_NETWORK.localWidth;
  const highwayWidth = ROAD_NETWORK.highwayWidth;
  
  // Highway ring
  if (sectorX === 0 || sectorX === WORLD.gridSize - 1 || sectorY === 0 || sectorY === WORLD.gridSize - 1) {
    const edgeDist = Math.min(
      localX, WORLD.sectorSize - localX,
      localY, WORLD.sectorSize - localY
    );
    if (edgeDist < highwayWidth / 2) return true;
  }
  
  // Main roads
  if (sectorX % spacing === 0) {
    if (localX < mainWidth / 2 || localX > WORLD.sectorSize - mainWidth / 2) return true;
  }
  if (sectorY % spacing === 0) {
    if (localY < mainWidth / 2 || localY > WORLD.sectorSize - mainWidth / 2) return true;
  }
  
  // Local roads (every sector boundary)
  if (localX < localWidth / 2 || localX > WORLD.sectorSize - localWidth / 2) return true;
  if (localY < localWidth / 2 || localY > WORLD.sectorSize - localWidth / 2) return true;
  
  return false;
}

export function getRoadDirection(world, x, y) {
  // Returns the dominant road direction at this position: 0=N/S, 1=E/W, -1=none/intersection
  const sectorX = Math.floor(x / WORLD.sectorSize);
  const sectorY = Math.floor(y / WORLD.sectorSize);
  const localX = x % WORLD.sectorSize;
  const localY = y % WORLD.sectorSize;
  const spacing = ROAD_NETWORK.mainSpacing;
  const mainWidth = ROAD_NETWORK.mainWidth;
  const localWidth = ROAD_NETWORK.localWidth;
  
  const onNS = (sectorX % spacing === 0 && (localX < mainWidth / 2 || localX > WORLD.sectorSize - mainWidth / 2)) ||
               (localX < localWidth / 2 || localX > WORLD.sectorSize - localWidth / 2);
  const onEW = (sectorY % spacing === 0 && (localY < mainWidth / 2 || localY > WORLD.sectorSize - mainWidth / 2)) ||
               (localY < localWidth / 2 || localY > WORLD.sectorSize - localWidth / 2);
  
  if (onNS && onEW) return -1; // Intersection
  if (onNS) return 0; // North-South
  if (onEW) return 1; // East-West
  return -1;
}

export function getDistrictAt(x, y) {
  const sectorX = Math.floor(x / WORLD.sectorSize);
  const sectorY = Math.floor(y / WORLD.sectorSize);
  
  for (const d of DISTRICTS) {
    if (d.ring) continue;
    if (sectorX >= d.x && sectorX < d.x + d.w && sectorY >= d.y && sectorY < d.y + d.h) {
      return d;
    }
  }
  // Check highway ring
  for (const d of DISTRICTS) {
    if (d.ring) return d;
  }
  return DISTRICTS[0];
}

export function findRoadPosition(world, nearX, nearY, maxDist = 200) {
  // Find nearest road position to given coordinates
  let bestX = nearX;
  let bestY = nearY;
  let bestDist = Infinity;
  
  const searchRadius = Math.ceil(maxDist / WORLD.sectorSize) + 1;
  const startSX = Math.floor(nearX / WORLD.sectorSize);
  const startSY = Math.floor(nearY / WORLD.sectorSize);
  
  for (let sy = -searchRadius; sy <= searchRadius; sy++) {
    for (let sx = -searchRadius; sx <= searchRadius; sx++) {
      const sectorX = startSX + sx;
      const sectorY = startSY + sy;
      if (sectorX < 0 || sectorX >= WORLD.gridSize || sectorY < 0 || sectorY >= WORLD.gridSize) continue;
      
      // Check sector center and boundaries
      const checks = [
        { x: sectorX * WORLD.sectorSize + WORLD.sectorSize / 2, y: sectorY * WORLD.sectorSize + WORLD.sectorSize / 2 },
        { x: sectorX * WORLD.sectorSize, y: sectorY * WORLD.sectorSize + WORLD.sectorSize / 2 },
        { x: sectorX * WORLD.sectorSize + WORLD.sectorSize, y: sectorY * WORLD.sectorSize + WORLD.sectorSize / 2 },
        { x: sectorX * WORLD.sectorSize + WORLD.sectorSize / 2, y: sectorY * WORLD.sectorSize },
        { x: sectorX * WORLD.sectorSize + WORLD.sectorSize / 2, y: sectorY * WORLD.sectorSize + WORLD.sectorSize },
      ];
      
      for (const pos of checks) {
        if (isOnRoad(world, pos.x, pos.y)) {
          const d = distanceSq(nearX, nearY, pos.x, pos.y);
          if (d < bestDist) {
            bestDist = d;
            bestX = pos.x;
            bestY = pos.y;
          }
        }
      }
    }
  }
  
  return { x: bestX, y: bestY, found: bestDist !== Infinity };
}

// Entity pools
function createPool(size, factory) {
  const pool = [];
  for (let i = 0; i < size; i++) {
    pool.push(factory());
  }
  return pool;
}

function acquire(pool) {
  for (const item of pool) {
    if (!item.active) {
      item.active = true;
      return item;
    }
  }
  return null;
}

function release(item) {
  item.active = false;
}

export function createWorld(random, saveData = null) {
  const rng = random || createRandom(Math.floor(Math.random() * 4294967296));
  
  // Player
  const player = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    width: PLAYER.width,
    height: PLAYER.height,
    angle: 0,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
    health: PLAYER.maxHealth,
    armor: PLAYER.maxArmor,
    stamina: PLAYER.maxStamina,
    inVehicle: false,
    vehicleId: -1,
    vehicleSeat: 0, // 0 = driver
    wantedLevel: 0,
    wantedStars: 0,
    wantedCooldown: 0,
    wantedDecayTimer: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    hiddenTimer: 0,
    isHidden: false,
    weapon: 'fist',
    ammo: { fist: Infinity, pistol: 12, smg: 30, rifle: 30, shotgun: 8, sniper: 5 },
    money: 5000,
    currentMission: -1,
    missionProgress: 0,
    stats: { kills: 0, distanceFoot: 0, distanceVehicle: 0, vehiclesStolen: 0, missionsCompleted: 0 },
    invulnerable: 0,
    wasted: false,
    wastedTimer: 0,
    input: { left: false, right: false, up: false, down: false, sprint: false, action: false, attack: false, aim: false, enterVehicle: false, pause: false, map: false },
  };
  
  // Camera
  const camera = { x: player.x, y: player.y, targetX: player.x, targetY: player.y, shake: 0, shakeTime: 0 };
  
  // Time & Weather
  const timeOfDay = saveData?.timeOfDay ?? TIME.startHour * 3600;
  const weather = saveData?.weather ?? 'clear';
  const weatherTransition = 0;
  const targetWeather = weather;
  
  // Vehicles
  const vehiclePoolSize = TRAFFIC.maxVehicles + POLICE.maxUnits + 20;
  const vehicles = createPool(vehiclePoolSize, () => ({
    active: false,
    id: -1,
    type: VEH_TYPE_CAR,
    x: 0, y: 0,
    angle: 0,
    speed: 0,
    velocityX: 0, velocityY: 0,
    angularVelocity: 0,
    width: 0, length: 0,
    maxSpeed: 0, acceleration: 0, brakeForce: 0, turnSpeed: 0, driftFactor: 0, mass: 0,
    health: 0, maxHealth: 0,
    driver: null, // ped index or 'player'
    passengers: [],
    isPolice: false,
    policeState: 'patrol', // patrol, pursue, ram, blockade
    targetX: 0, targetY: 0,
    path: [],
    pathIndex: 0,
    lane: 0,
    laneOffset: 0,
    siren: false,
    stuckTimer: 0,
    lastRoadX: 0, lastRoadY: 0,
    color: '#ffffff',
  }));
  
  // Pedestrians
  const pedPoolSize = PEDESTRIAN.maxPerSector * 16;
  const peds = createPool(pedPoolSize, () => ({
    active: false,
    id: -1,
    type: 0,
    x: 0, y: 0,
    angle: 0,
    speed: 0,
    velocityX: 0, velocityY: 0,
    width: PEDESTRIAN.width,
    height: PEDESTRIAN.height,
    health: 100,
    maxHealth: 100,
    state: 'walk', // walk, run, flee, combat, dead
    targetX: 0, targetY: 0,
    wanderTimer: 0,
    wanderAngle: 0,
    fleeFrom: null,
    combatTarget: null,
    attackCooldown: 0,
    isGang: false,
    gangId: -1,
    color: '#ffffff',
    clothingColor: '#ffffff',
  }));
  
  // Police units (separate tracking)
  const policeUnits = [];
  
  // Missions
  const missions = [];
  const missionMarkers = [];
  
  // Pickups
  const pickups = createPool(50, () => ({
    active: false,
    id: -1,
    type: 'health', // health, armor, weapon, money
    x: 0, y: 0,
    value: 0,
    weapon: null,
    respawnTime: 0,
    respawnTimer: 0,
    bobOffset: 0,
  }));
  
  // Checkpoints
  const checkpoints = [];
  
  // World state
  const state = {
    player,
    camera,
    vehicles,
    peds,
    policeUnits,
    missions,
    missionMarkers,
    pickups,
    checkpoints,
    timeOfDay,
    weather,
    weatherTransition,
    targetWeather,
    rng,
    frame: 0,
    elapsed: 0,
    paused: false,
    screen: 'play', // play, paused, mission, map, wasted, busted
    gpsRoute: [],
    gpsTarget: null,
    zoneName: '',
    zoneNameTimer: 0,
    messages: [],
    messageTimer: 0,
    cheatBuffer: '',
    cheatTimer: 0,
    saveVersion: SAVE.version,
  };
  const s = state;
  
  // Initialize from save data if provided
  if (saveData) {
    loadSaveData(state, saveData);
  } else {
    initializeWorld(state);
  }
  
  function initializeWorld(s) {
    // Spawn player at a good location
    const startPos = findRoadPosition(s, WORLD.width / 2, WORLD.height / 2, 500);
    s.player.x = startPos.x;
    s.player.y = startPos.y;
    s.camera.x = s.player.x;
    s.camera.y = s.player.y;
    s.camera.targetX = s.player.x;
    s.camera.targetY = s.player.y;
    
    // Spawn initial traffic
    spawnInitialTraffic(s);
    
    // Spawn initial pedestrians
    spawnInitialPeds(s);
    
    // Create missions
    createMissions(s);
    
    // Create pickups
    createPickups(s);
    
    updateZoneName(s);
  }
  
  function loadSaveData(s, data) {
    // Restore player
    Object.assign(s.player, data.player);
    
    // Restore camera
    Object.assign(s.camera, data.camera);
    
    // Restore time/weather
    s.timeOfDay = data.timeOfDay;
    s.weather = data.weather;
    s.targetWeather = data.targetWeather;
    
    // Restore vehicles
    for (let i = 0; i < data.vehicles.length; i++) {
      const vData = data.vehicles[i];
      const v = acquire(s.vehicles);
      if (v) {
        v.id = vData.id;
        Object.assign(v, vData);
        v.active = true;
      }
    }
    
    // Restore peds
    for (let i = 0; i < data.peds.length; i++) {
      const pData = data.peds[i];
      const p = acquire(s.peds);
      if (p) {
        p.id = pData.id;
        Object.assign(p, pData);
        p.active = true;
      }
    }
    
    // Restore missions
    for (let i = 0; i < data.missions.length; i++) {
      s.missions.push({ ...data.missions[i] });
    }
    
    // Restore pickups
    for (let i = 0; i < data.pickups.length; i++) {
      const pData = data.pickups[i];
      const p = acquire(s.pickups);
      if (p) {
        Object.assign(p, pData);
        p.active = true;
      }
    }
    
    // Restore GPS
    s.gpsRoute = data.gpsRoute || [];
    s.gpsTarget = data.gpsTarget || null;
    
    // Restore stats
    if (data.stats) {
      Object.assign(s.player.stats, data.stats);
    }
    
    updateZoneName(s);
  }
  
  function spawnInitialTraffic(s) {
    const count = Math.min(TRAFFIC.maxVehicles, 20);
    for (let i = 0; i < count; i++) {
      spawnTrafficVehicle(s);
    }
  }
  
  function spawnTrafficVehicle(s) {
    const v = acquire(s.vehicles);
    if (!v) return null;
    
    // Find a road position
    const attempts = 10;
    let pos = null;
    for (let a = 0; a < attempts; a++) {
      const sectorX = Math.floor(s.rng() * WORLD.gridSize);
      const sectorY = Math.floor(s.rng() * WORLD.gridSize);
      const localX = s.rng() * WORLD.sectorSize;
      const localY = s.rng() * WORLD.sectorSize;
      const wx = sectorX * WORLD.sectorSize + localX;
      const wy = sectorY * WORLD.sectorSize + localY;
      
      if (isOnRoad(s, wx, wy)) {
        pos = { x: wx, y: wy };
        break;
      }
    }
    
    if (!pos) {
      release(v);
      return null;
    }
    
    const typeIndex = Math.floor(s.rng() * TRAFFIC.vehicleTypes.length);
    const typeName = TRAFFIC.vehicleTypes[typeIndex];
    const type = VEHICLE[typeName] || VEHICLE.car;
    const isMoto = typeName === 'motorcycle';
    const isTruck = typeName === 'truck';
    
    v.id = s.frame * 1000 + s.vehicles.indexOf(v);
    v.type = isMoto ? VEH_TYPE_MOTORCYCLE : (isTruck ? VEH_TYPE_TRUCK : VEH_TYPE_CAR);
    v.x = pos.x;
    v.y = pos.y;
    v.angle = getRoadDirection(s, pos.x, pos.y) === 0 ? (s.rng() > 0.5 ? 0 : Math.PI) : (s.rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    v.speed = 0;
    v.velocityX = 0;
    v.velocityY = 0;
    v.angularVelocity = 0;
    v.width = type.width;
    v.length = type.length;
    v.maxSpeed = type.maxSpeed * (0.7 + s.rng() * TRAFFIC.speedVariance);
    v.acceleration = type.acceleration;
    v.brakeForce = type.brakeForce;
    v.turnSpeed = type.turnSpeed;
    v.driftFactor = type.driftFactor;
    v.mass = type.mass;
    v.health = type.maxHealth;
    v.maxHealth = type.maxHealth;
    v.driver = { type: 'ai', pedId: -1 };
    v.passengers = [];
    v.isPolice = false;
    v.policeState = 'patrol';
    v.targetX = 0;
    v.targetY = 0;
    v.path = [];
    v.pathIndex = 0;
    v.lane = 0;
    v.laneOffset = (s.rng() - 0.5) * ROAD_NETWORK.laneOffset;
    v.siren = false;
    v.stuckTimer = 0;
    v.lastRoadX = pos.x;
    v.lastRoadY = pos.y;
    v.color = PALETTE.carColors[Math.floor(s.rng() * PALETTE.carColors.length)];
    
    // Create driver ped
    const ped = spawnPed(s, pos.x, pos.y, 'civilian');
    if (ped) {
      v.driver.pedId = ped.id;
      ped.state = 'drive';
    }
    
    return v;
  }
  
  function spawnInitialPeds(s) {
    const sectorsToSpawn = Math.min(16, WORLD.gridSize * WORLD.gridSize / 4);
    for (let i = 0; i < sectorsToSpawn; i++) {
      const sectorX = Math.floor(s.rng() * WORLD.gridSize);
      const sectorY = Math.floor(s.rng() * WORLD.gridSize);
      spawnPedsInSector(s, sectorX, sectorY);
    }
  }
  
  function spawnPedsInSector(s, sectorX, sectorY) {
    if (sectorX < 0 || sectorX >= WORLD.gridSize || sectorY < 0 || sectorY >= WORLD.gridSize) return;
    
    const district = getDistrictAt(sectorX * WORLD.sectorSize, sectorY * WORLD.sectorSize);
    const count = Math.floor(PEDESTRIAN.maxPerSector * (0.5 + s.rng() * 0.5));
    
    for (let i = 0; i < count; i++) {
      const localX = s.rng() * WORLD.sectorSize;
      const localY = s.rng() * WORLD.sectorSize;
      const wx = sectorX * WORLD.sectorSize + localX;
      const wy = sectorY * WORLD.sectorSize + localY;
      
      // Prefer sidewalk areas
      if (!isOnRoad(s, wx, wy) || s.rng() < 0.3) {
        spawnPed(s, wx, wy, getPedTypeForDistrict(district, s.rng));
      }
    }
  }
  
  function getPedTypeForDistrict(district, rng) {
    const types = ['civilian', 'business', 'gang', 'tourist'];
    const weights = { 
      urban: [0.4, 0.3, 0.1, 0.2],
      residential: [0.5, 0.2, 0.1, 0.2],
      beach: [0.3, 0.1, 0.05, 0.55],
      industrial: [0.2, 0.1, 0.4, 0.3],
      wilderness: [0.1, 0.05, 0.2, 0.65],
      luxury: [0.2, 0.5, 0.0, 0.3],
      gang: [0.1, 0.05, 0.7, 0.15],
      airport: [0.3, 0.4, 0.05, 0.25],
      highway: [0.6, 0.2, 0.1, 0.1],
    };
    const w = weights[district.type] || weights.urban;
    const r = rng();
    let sum = 0;
    for (let i = 0; i < types.length; i++) {
      sum += w[i];
      if (r < sum) return types[i];
    }
    return 'civilian';
  }
  
  function spawnPed(s, x, y, typeName) {
    const p = acquire(s.peds);
    if (!p) return null;
    
    const typeInfo = PEDESTRIAN.types.find(t => t.name === typeName) || PEDESTRIAN.types[0];
    
    p.id = s.frame * 1000 + s.peds.indexOf(p);
    p.type = PEDESTRIAN.types.findIndex(t => t.name === typeName);
    p.x = x;
    p.y = y;
    p.angle = s.rng() * Math.PI * 2;
    p.speed = 0;
    p.velocityX = 0;
    p.velocityY = 0;
    p.width = PEDESTRIAN.width;
    p.height = PEDESTRIAN.height;
    p.health = 100;
    p.maxHealth = 100;
    p.state = 'walk';
    p.targetX = x;
    p.targetY = y;
    p.wanderTimer = s.rng() * 5;
    p.wanderAngle = s.rng() * Math.PI * 2;
    p.fleeFrom = null;
    p.combatTarget = null;
    p.attackCooldown = 0;
    p.isGang = typeName === 'gang';
    p.gangId = typeName === 'gang' ? Math.floor(s.rng() * 3) : -1;
    p.color = typeInfo.color;
    p.clothingColor = PALETTE.pedColors[Math.floor(s.rng() * PALETTE.pedColors.length)];
    
    return p;
  }
  
  function createMissions(s) {
    // Story missions
    s.missions.push({
      id: 0,
      type: MISSION_STORY,
      title: 'Welcome to Vesper Bay',
      description: 'Meet your contact at the downtown club.',
      giver: 'Lance',
      location: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'goto', text: 'Drive to the club', target: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 }, radius: 20 },
        { type: 'enter', text: 'Enter the club', target: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 }, radius: 15 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 5000,
      unlocks: [1],
    });
    
    s.missions.push({
      id: 1,
      type: MISSION_STORY,
      title: 'The Exchange',
      description: 'Pick up the package from the port and deliver it to Star Island.',
      giver: 'Lance',
      location: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'goto', text: 'Go to Port Vice', target: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 }, radius: 30 },
        { type: 'pickup', text: 'Collect the package', target: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 }, radius: 10 },
        { type: 'deliver', text: 'Deliver to Star Island', target: { x: 26 * WORLD.sectorSize + 100, y: 8 * WORLD.sectorSize + 100 }, radius: 30 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 15000,
      unlocks: [2],
      requiredMission: 0,
    });
    
    s.missions.push({
      id: 2,
      type: MISSION_STORY,
      title: 'Heat Wave',
      description: 'Survive a 3-star wanted level for 2 minutes.',
      giver: 'Ricardo',
      location: { x: 8 * WORLD.sectorSize + 200, y: 22 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'survive_wanted', text: 'Survive 3-star wanted level for 2:00', target: { stars: 3, duration: 120 }, radius: 0 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 25000,
      unlocks: [3],
      requiredMission: 1,
    });
    
    // Side missions
    s.missions.push({
      id: 3,
      type: MISSION_SIDE,
      title: 'Taxi Driver',
      description: 'Drive passengers to their destinations.',
      giver: 'Taxi Depot',
      location: { x: 12 * WORLD.sectorSize + 50, y: 12 * WORLD.sectorSize + 50 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'taxi', text: 'Complete 5 fares', target: { count: 5 }, radius: 0 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 10000,
      repeatable: true,
    });
    
    s.missions.push({
      id: 4,
      type: MISSION_RACE,
      title: 'Beach Sprint',
      description: 'Race along Vice Beach coastline.',
      giver: 'Race Organizer',
      location: { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'race', text: 'Finish 1st in the beach race', target: { checkpoints: [
          { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
          { x: 26 * WORLD.sectorSize + 50, y: 6 * WORLD.sectorSize + 50 },
          { x: 24 * WORLD.sectorSize + 50, y: 12 * WORLD.sectorSize + 50 },
          { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
        ]}, radius: 0 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 8000,
      repeatable: true,
    });
    
    // Stranger missions
    s.missions.push({
      id: 5,
      type: MISSION_STRANGER,
      title: 'Lost Tourist',
      description: 'Help a tourist find their hotel.',
      giver: '???',
      location: { x: 20 * WORLD.sectorSize + 100, y: 6 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      objectives: [
        { type: 'escort', text: 'Escort the tourist to Star Island Hotel', target: { x: 26 * WORLD.sectorSize + 150, y: 8 * WORLD.sectorSize + 150 }, radius: 20 },
      ],
      currentObjective: 0,
      completed: false,
      failed: false,
      reward: 3000,
    });
    
    // Create mission markers
    for (const m of s.missions) {
      if (!m.completed && (!m.requiredMission || s.missions[m.requiredMission]?.completed)) {
        createMissionMarker(s, m);
      }
    }
  }
  
  function createMissionMarker(s, mission) {
    const marker = {
      id: s.missionMarkers.length,
      missionId: mission.id,
      x: mission.location.x,
      y: mission.location.y,
      type: mission.type,
      pulse: 0,
      active: true,
    };
    s.missionMarkers.push(marker);
    return marker;
  }
  
  function createPickups(s) {
    const pickupTypes = ['health', 'armor', 'weapon', 'money'];
    const weaponTypes = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];
    
    for (let i = 0; i < 30; i++) {
      const sectorX = Math.floor(s.rng() * WORLD.gridSize);
      const sectorY = Math.floor(s.rng() * WORLD.gridSize);
      const localX = s.rng() * WORLD.sectorSize;
      const localY = s.rng() * WORLD.sectorSize;
      const wx = sectorX * WORLD.sectorSize + localX;
      const wy = sectorY * WORLD.sectorSize + localY;
      
      const type = pickupTypes[Math.floor(s.rng() * pickupTypes.length)];
      const p = acquire(s.pickups);
      if (p) {
        p.id = s.pickups.indexOf(p);
        p.type = type;
        p.x = wx;
        p.y = wy;
        p.value = type === 'health' ? 50 : type === 'armor' ? 50 : type === 'money' ? Math.floor(100 + s.rng() * 500) : 0;
        p.weapon = type === 'weapon' ? weaponTypes[Math.floor(s.rng() * weaponTypes.length)] : null;
        p.respawnTime = 60 + s.rng() * 120;
        p.respawnTimer = 0;
        p.bobOffset = s.rng() * Math.PI * 2;
        p.active = true;
      }
    }
  }
  
  function updateZoneName(s) {
    const district = getDistrictAt(s.player.x, s.player.y);
    if (district.name !== s.zoneName) {
      s.zoneName = district.name;
      s.zoneNameTimer = 4;
      addMessage(s, district.name, 4000);
    }
  }
  
  function addMessage(s, text, duration = 3000) {
    s.messages.push({ text, timer: duration, alpha: 1 });
    if (s.messages.length > 5) s.messages.shift();
  }
  
  // ========== MAIN STEP FUNCTION ==========
  function step(dt, nextInput) {
    input = nextInput ?? input;
    if (s.paused) return 0;
    
    let events = 0;
    s.elapsed += dt;
    s.frame++;
    s.player.input = { ...input };
    
    // Update time
    s.timeOfDay += dt * (86400 / TIME.dayLength);
    if (s.timeOfDay >= 86400) s.timeOfDay -= 86400;
    
    // Update weather
    if (s.weather !== s.targetWeather) {
      s.weatherTransition += dt / WEATHER.transitionTime;
      if (s.weatherTransition >= 1) {
        s.weather = s.targetWeather;
        s.weatherTransition = 0;
      }
    } else if (s.rng() < 0.0001) {
      // Random weather change
      const types = WEATHER.types;
      const weights = [WEATHER.probabilities.clear, WEATHER.probabilities.cloudy, WEATHER.probabilities.rain, WEATHER.probabilities.storm, WEATHER.probabilities.fog];
      let r = s.rng();
      let sum = 0;
      for (let i = 0; i < types.length; i++) {
        sum += weights[i];
        if (r < sum && types[i] !== s.weather) {
          s.targetWeather = types[i];
          break;
        }
      }
    }
    
    // Camera shake decay
    if (s.camera.shake > 0) {
      s.camera.shakeTime -= dt;
      if (s.camera.shakeTime <= 0) s.camera.shake = 0;
    }
    
    // Zone name timer
    if (s.zoneNameTimer > 0) s.zoneNameTimer -= dt;
    
    // Messages
    for (let i = s.messages.length - 1; i >= 0; i--) {
      s.messages[i].timer -= dt * 1000;
      s.messages[i].alpha = Math.max(0, s.messages[i].timer / 1000);
      if (s.messages[i].timer <= 0) s.messages.splice(i, 1);
    }
    
    // Cheat buffer
    if (s.cheatTimer > 0) s.cheatTimer -= dt;
    
    // Player invulnerability
    if (s.player.invulnerable > 0) s.player.invulnerable -= dt;
    
    // Wasted/Busted handling
    if (s.player.wasted) {
      s.player.wastedTimer -= dt;
      if (s.player.wastedTimer <= 0) {
        respawnPlayer(s);
      }
      return events;
    }
    
    if (s.screen === 'wasted' || s.screen === 'busted') return events;
    
    // Update player
    events |= updatePlayer(s, dt);
    
    // Update camera
    updateCamera(s, dt);
    
    // Update vehicles
    events |= updateVehicles(s, dt);
    
    // Update pedestrians
    updatePeds(s, dt);
    
    // Update police
    events |= updatePolice(s, dt);
    
    // Update missions
    events |= updateMissions(s, dt);
    
    // Update pickups
    updatePickups(s, dt);
    
    // Update checkpoints
    updateCheckpoints(s, dt);
    
    // Spawn/despawn management
    managePopulation(s);
    
    // GPS routing
    if (s.gpsTarget && s.gpsRoute.length === 0) {
      calculateRoute(s);
    }
    
    // Auto-save
    if (s.frame % (SAVE.autoSaveInterval / (STEP * 1000)) === 0) {
      // Save would happen here in a real implementation
    }
    
    return events;
  }
  
  function updatePlayer(s, dt) {
    const p = s.player;
    let events = 0;
    
    // Handle cheat codes
    if (CHEATS.enabled) {
      handleCheats(s);
    }
    
    if (p.inVehicle) {
      events |= updatePlayerInVehicle(s, dt);
    } else {
      events |= updatePlayerOnFoot(s, dt);
    }
    
    // Common actions
    if (input.action && !p.inVehicle) {
      events |= tryEnterVehicle(s);
    }
    
    if (input.attack && !p.inVehicle) {
      events |= playerAttack(s);
    }
    
    if (input.aim && !p.inVehicle) {
      // Aim mode - slow movement
    }
    
    // Weapon switching (number keys would be handled in input)
    
    // Stamina
    if (p.stamina < PLAYER.maxStamina && !p.inVehicle) {
      p.stamina = Math.min(PLAYER.maxStamina, p.stamina + dt * 20);
    }
    
    // Health regen (slow)
    if (p.health < PLAYER.maxHealth && p.health > 0) {
      p.health = Math.min(PLAYER.maxHealth, p.health + dt * 0.5);
    }
    
    // Wanted system
    updateWanted(s, dt);
    
    // Update zone name
    updateZoneName(s);
    
    // Check death
    if (p.health <= 0 && !p.wasted) {
      p.wasted = true;
      p.wastedTimer = 5;
      s.screen = 'wasted';
      events |= EVENT_PLAYER_WASTED;
      addMessage(s, 'WASTED', 5000);
      s.camera.shake = 20;
      s.camera.shakeTime = 1;
    }
    
    return events;
  }
  
  function updatePlayerOnFoot(s, dt) {
    const p = s.player;
    let events = 0;
    let dx = 0, dy = 0;
    
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      
      const isSprinting = input.sprint && p.stamina > 10;
      const speed = isSprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;
      
      if (isSprinting) {
        p.stamina = Math.max(0, p.stamina - dt * 30);
      }
      
      p.velocityX = dx * speed;
      p.velocityY = dy * speed;
      p.angle = Math.atan2(dy, dx);
      p.speed = speed;
      
      // Distance stat
      p.stats.distanceFoot += speed * dt;
    } else {
      p.velocityX = 0;
      p.velocityY = 0;
      p.speed = 0;
    }
    
    // Move
    const newX = p.x + p.velocityX * dt;
    const newY = p.y + p.velocityY * dt;
    
    // Collision with world bounds
    p.x = clamp(newX, p.width / 2, WORLD.width - p.width / 2);
    p.y = clamp(newY, p.height / 2, WORLD.height - p.height / 2);
    
    // Collision with buildings (simplified)
    if (!isWalkable(s, p.x, p.y)) {
      p.x = clamp(p.x - p.velocityX * dt, p.width / 2, WORLD.width - p.width / 2);
      p.y = clamp(p.y - p.velocityY * dt, p.height / 2, WORLD.height - p.height / 2);
    }
    
    return events;
  }
  
  function updatePlayerInVehicle(s, dt) {
    const p = s.player;
    const v = s.vehicles.find(v => v.id === p.vehicleId);
    if (!v) {
      exitVehicle(s);
      return 0;
    }
    
    let events = 0;
    
    // Vehicle controls
    const throttle = input.up ? 1 : (input.down ? -1 : 0);
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const brake = input.down && !input.up ? 1 : 0;
    const handbrake = input.action; // Space for handbrake
    
    // Apply physics
    const config = getVehicleConfig(v);
    
    // Forward/backward acceleration
    if (throttle !== 0) {
      const accel = config.acceleration * throttle * dt;
      v.speed = clamp(v.speed + accel, -config.maxSpeed * 0.3, config.maxSpeed);
    }
    
    // Braking
    if (brake > 0) {
      const brakeForce = config.brakeForce * dt;
      if (v.speed > 0) v.speed = Math.max(0, v.speed - brakeForce);
      else if (v.speed < 0) v.speed = Math.min(0, v.speed + brakeForce);
    } else {
      // Natural deceleration
      const drag = 50 * dt;
      if (v.speed > 0) v.speed = Math.max(0, v.speed - drag);
      else if (v.speed < 0) v.speed = Math.min(0, v.speed + drag);
    }
    
    // Steering
    if (v.speed !== 0) {
      const steerRate = config.turnSpeed * (v.speed / config.maxSpeed) * steer * dt;
      v.angle += steerRate;
      
      // Drift
      if (handbrake && Math.abs(v.speed) > 50) {
        v.angularVelocity += steer * config.driftFactor * 5 * dt;
      }
    }
    
    v.angle += v.angularVelocity * dt;
    v.angularVelocity *= 0.95;
    
    // Velocity from speed and angle
    v.velocityX = Math.cos(v.angle) * v.speed;
    v.velocityY = Math.sin(v.angle) * v.speed;
    
    // Move
    v.x += v.velocityX * dt;
    v.y += v.velocityY * dt;
    
    // World bounds
    v.x = clamp(v.x, v.width / 2, WORLD.width - v.width / 2);
    v.y = clamp(v.y, v.length / 2, WORLD.height - v.length / 2);
    
    // Collision with other vehicles
    for (const other of s.vehicles) {
      if (!other.active || other.id === v.id) continue;
      if (checkVehicleCollision(v, other)) {
        resolveVehicleCollision(v, other, dt);
      }
    }
    
    // Collision with peds
    for (const ped of s.peds) {
      if (!ped.active || ped.state === 'dead') continue;
      if (checkVehiclePedCollision(v, ped)) {
        hitPedWithVehicle(v, ped);
      }
    }
    
    // Player distance stat
    p.stats.distanceVehicle += Math.abs(v.speed) * dt;
    
    // Exit vehicle
    if (input.enterVehicle) {
      exitVehicle(s);
      events |= EVENT_EXIT_VEHICLE;
    }
    
    // Vehicle health
    if (v.health <= 0) {
      explodeVehicle(s, v);
      exitVehicle(s);
    }
    
    // Update player position to match vehicle
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;
    
    return events;
  }
  
  function tryEnterVehicle(s) {
    const p = s.player;
    const range = PLAYER.vehicleEnterRange * PLAYER.vehicleEnterRange;
    
    for (const v of s.vehicles) {
      if (!v.active) continue;
      if (v.isPolice && s.player.wantedLevel > 0) continue; // Can't steal police cars when wanted
      
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < range) {
        // Check if driver seat is available
        if (v.driver && v.driver.type === 'ai') {
          // Kick out driver
          const driverPed = s.peds.find(p => p.id === v.driver.pedId);
          if (driverPed) {
            driverPed.state = 'flee';
            driverPed.fleeFrom = { x: p.x, y: p.y };
            driverPed.wanderTimer = 10;
          }
        }
        
        enterVehicle(s, v);
        p.stats.vehiclesStolen++;
        return EVENT_ENTER_VEHICLE;
      }
    }
    
    return 0;
  }
  
  function enterVehicle(s, vehicle) {
    const p = s.player;
    p.inVehicle = true;
    p.vehicleId = vehicle.id;
    p.vehicleSeat = 0;
    vehicle.driver = { type: 'player' };
    s.camera.shake = 5;
    s.camera.shakeTime = 0.2;
    addMessage(s, 'Vehicle entered', 1500);
  }
  
  function exitVehicle(s) {
    const p = s.player;
    const v = s.vehicles.find(v => v.id === p.vehicleId);
    if (v) {
      v.driver = { type: 'none' };
      // Place player beside vehicle
      const angle = v.angle + Math.PI / 2;
      p.x = v.x + Math.cos(angle) * (v.width / 2 + p.width / 2 + 5);
      p.y = v.y + Math.sin(angle) * (v.width / 2 + p.width / 2 + 5);
    }
    p.inVehicle = false;
    p.vehicleId = -1;
    p.vehicleSeat = 0;
    s.camera.shake = 3;
    s.camera.shakeTime = 0.15;
  }
  
  function playerAttack(s) {
    const p = s.player;
    const weapon = WEAPON[p.weapon];
    if (!weapon) return 0;
    
    if (p.ammo[p.weapon] <= 0 && weapon.ammo !== Infinity) {
      addMessage(s, 'Out of ammo!', 1000);
      return 0;
    }
    
    // Cooldown handled in world step via weapon state
    // For simplicity, we'll use a simple cooldown on player
    if (p.attackCooldown > 0) return 0;
    p.attackCooldown = weapon.cooldown;
    
    if (weapon.type === 'melee') {
      // Melee attack
      for (const ped of s.peds) {
        if (!ped.active || ped.state === 'dead') continue;
        const dx = ped.x - p.x;
        const dy = ped.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < weapon.range) {
          ped.health -= weapon.damage;
          ped.state = 'combat';
          ped.combatTarget = 'player';
          if (ped.health <= 0) {
            ped.state = 'dead';
            ped.velocityX = Math.cos(p.angle) * 5;
            ped.velocityY = Math.sin(p.angle) * 5;
            p.stats.kills++;
            addWanted(s, 1);
          }
          s.camera.shake = 8;
          s.camera.shakeTime = 0.1;
        }
      }
      
      // Check vehicles
      for (const v of s.vehicles) {
        if (!v.active) continue;
        const dx = v.x - p.x;
        const dy = v.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < weapon.range + v.width) {
          v.health -= weapon.damage * 0.5;
          if (v.health <= 0) explodeVehicle(s, v);
        }
      }
    } else {
      // Ranged attack
      const spread = weapon.spread || 0;
      const pellets = weapon.pellets || 1;
      
      for (let i = 0; i < pellets; i++) {
        const bulletAngle = p.angle + (s.rng() - 0.5) * spread * 2;
        const range = weapon.range;
        
        // Raycast to find hit
        let hitEntity = null;
        let hitDist = range;
        
        // Check peds
        for (const ped of s.peds) {
          if (!ped.active || ped.state === 'dead') continue;
          const dx = ped.x - p.x;
          const dy = ped.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hitDist) {
            // Check if in line of fire
            const angleToPed = Math.atan2(dy, dx);
            const diff = Math.abs(normalizeAngle(angleToPed - bulletAngle));
            if (diff < 0.15) { // ~8 degrees
              hitEntity = ped;
              hitDist = dist;
            }
          }
        }
        
        // Check vehicles
        for (const v of s.vehicles) {
          if (!v.active) continue;
          const dx = v.x - p.x;
          const dy = v.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hitDist) {
            const angleToVeh = Math.atan2(dy, dx);
            const diff = Math.abs(normalizeAngle(angleToVeh - bulletAngle));
            if (diff < 0.2) {
              hitEntity = v;
              hitDist = dist;
            }
          }
        }
        
        if (hitEntity) {
          if (hitEntity.health !== undefined) { // Ped
            hitEntity.health -= weapon.damage;
            hitEntity.state = 'combat';
            hitEntity.combatTarget = 'player';
            if (hitEntity.health <= 0) {
              hitEntity.state = 'dead';
              hitEntity.velocityX = Math.cos(bulletAngle) * 8;
              hitEntity.velocityY = Math.sin(bulletAngle) * 8;
              p.stats.kills++;
              addWanted(s, 1);
            }
          } else { // Vehicle
            hitEntity.health -= weapon.damage * 0.3;
            if (hitEntity.health <= 0) explodeVehicle(s, hitEntity);
          }
        }
      }
    }
    
    if (weapon.ammo !== Infinity) {
      p.ammo[p.weapon] = Math.max(0, p.ammo[p.weapon] - (weapon.pellets || 1));
    }
    
    s.camera.shake = Math.max(s.camera.shake, weapon.type === 'melee' ? 5 : 12);
    s.camera.shakeTime = 0.15;
    
    return 0;
  }
  
  function updateWanted(s, dt) {
    const p = s.player;
    
    if (p.wantedLevel > 0) {
      // Decay when hidden
      if (p.isHidden) {
        p.hiddenTimer += dt;
        if (p.hiddenTimer > 3) {
          p.wantedDecayTimer += dt;
          if (p.wantedDecayTimer > 1 / PLAYER.wantedDecayRate) {
            p.wantedDecayTimer = 0;
            setWantedLevel(s, p.wantedLevel - 1);
          }
        }
      } else {
        p.hiddenTimer = 0;
        p.wantedDecayTimer = 0;
      }
      
      // Update stars display
      p.wantedStars = p.wantedLevel;
    } else {
      p.wantedStars = 0;
      p.isHidden = false;
      p.hiddenTimer = 0;
    }
    
    // Update last seen position
    if (p.wantedLevel > 0 && !p.isHidden) {
      p.lastSeenX = p.x;
      p.lastSeenY = p.y;
    }
  }
  
  function addWanted(s, amount) {
    const p = s.player;
    const oldLevel = p.wantedLevel;
    p.wantedLevel = clamp(p.wantedLevel + amount, 0, PLAYER.wantedMaxStars);
    if (p.wantedLevel !== oldLevel) {
      p.wantedDecayTimer = 0;
      p.hiddenTimer = 0;
      p.isHidden = false;
      addMessage(s, `Wanted Level: ${p.wantedLevel} ${'★'.repeat(p.wantedLevel)}`, 3000);
      s.camera.shake = 15;
      s.camera.shakeTime = 0.5;
      return EVENT_WANTED_CHANGE;
    }
    return 0;
  }
  
  function setWantedLevel(s, level) {
    const p = s.player;
    const oldLevel = p.wantedLevel;
    p.wantedLevel = clamp(level, 0, PLAYER.wantedMaxStars);
    if (p.wantedLevel !== oldLevel) {
      addMessage(s, p.wantedLevel > 0 ? `Wanted Level: ${p.wantedLevel} ${'★'.repeat(p.wantedLevel)}` : 'Wanted Level Cleared', 3000);
      return EVENT_WANTED_CHANGE;
    }
    return 0;
  }
  
  function clearWanted(s) {
    setWantedLevel(s, 0);
    s.player.lastSeenX = 0;
    s.player.lastSeenY = 0;
  }
  
  function updateCamera(s, dt) {
    const p = s.player;
    const cam = s.camera;
    
    // Target follows player
    cam.targetX = p.x;
    cam.targetY = p.y;
    
    // Smooth follow
    cam.x = lerp(cam.x, cam.targetX, 1 - Math.pow(1 - WORLD.cameraLerp, dt * 60));
    cam.y = lerp(cam.y, cam.targetY, 1 - Math.pow(1 - WORLD.cameraLerp, dt * 60));
    
    // Clamp to world bounds
    const viewW = 1280; // logical view width
    const viewH = 720;
    cam.x = clamp(cam.x, viewW / 2, WORLD.width - viewW / 2);
    cam.y = clamp(cam.y, viewH / 2, WORLD.height - viewH / 2);
    
    // Shake
    if (cam.shake > 0 && cam.shakeTime > 0) {
      cam.x += (s.rng() - 0.5) * cam.shake;
      cam.y += (s.rng() - 0.5) * cam.shake;
    }
  }
  
  function updateVehicles(s, dt) {
    let events = 0;
    
    for (const v of s.vehicles) {
      if (!v.active) continue;
      if (v.id === s.player.vehicleId) continue; // Player vehicle handled separately
      
      if (v.isPolice) {
        events |= updatePoliceVehicle(s, v, dt);
      } else {
        updateTrafficVehicle(s, v, dt);
      }
      
      // Despawn check
      const dx = v.x - s.player.x;
      const dy = v.y - s.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > TRAFFIC.despawnRange * TRAFFIC.despawnRange) {
        // Despawn traffic vehicles far away
        if (!v.isPolice) {
          releaseVehicle(s, v);
        }
      }
    }
    
    return events;
  }
  
  function updateTrafficVehicle(s, v, dt) {
    const config = getVehicleConfig(v);
    
    // Simple AI: follow road, avoid obstacles
    const roadDir = getRoadDirection(s, v.x, v.y);
    
    if (roadDir !== -1) {
      // On road
      v.lastRoadX = v.x;
      v.lastRoadY = v.y;
      v.stuckTimer = 0;
      
      // Target speed
      const targetSpeed = v.maxSpeed * (0.8 + s.rng() * 0.2);
      
      // Accelerate/brake
      if (v.speed < targetSpeed) {
        v.speed = Math.min(targetSpeed, v.speed + config.acceleration * dt);
      } else if (v.speed > targetSpeed) {
        v.speed = Math.max(targetSpeed, v.speed - config.brakeForce * 0.5 * dt);
      }
      
      // Steering to follow road
      let targetAngle;
      if (roadDir === 0) { // N/S
        targetAngle = v.velocityY >= 0 ? Math.PI / 2 : -Math.PI / 2;
      } else { // E/W
        targetAngle = v.velocityX >= 0 ? 0 : Math.PI;
      }
      
      const angleDiff = normalizeAngle(targetAngle - v.angle);
      v.angle += angleDiff * 0.1 * dt * 60;
      
      // Lane keeping
      const laneCenter = getLaneCenter(s, v.x, v.y, v.lane);
      if (laneCenter) {
        const toLane = laneCenter - (roadDir === 0 ? v.x : v.y);
        v.laneOffset = lerp(v.laneOffset, toLane, 0.05 * dt * 60);
      }
      
    } else {
      // Off road - try to get back
      v.stuckTimer += dt;
      if (v.stuckTimer > 5) {
        // Teleport to nearest road
        const pos = findRoadPosition(s, v.x, v.y, 200);
        if (pos.found) {
          v.x = pos.x;
          v.y = pos.y;
          v.angle = getRoadDirection(s, pos.x, pos.y) === 0 ? (s.rng() > 0.5 ? 0 : Math.PI) : (s.rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
          v.speed = 0;
          v.stuckTimer = 0;
        }
      } else {
        // Slow down
        v.speed = Math.max(0, v.speed - config.brakeForce * 0.2 * dt);
      }
    }
    
    // Avoid other vehicles
    for (const other of s.vehicles) {
      if (!other.active || other.id === v.id) continue;
      const dx = other.x - v.x;
      const dy = other.y - v.y;
      const distSq = dx * dx + dy * dy;
      const minDist = (v.width + other.width) * 0.7;
      if (distSq < minDist * minDist && distSq > 0.1) {
        const dist = Math.sqrt(distSq);
        const pushX = (dx / dist) * (minDist - dist) * 0.5;
        const pushY = (dy / dist) * (minDist - dist) * 0.5;
        v.x -= pushX;
        v.y -= pushY;
        other.x += pushX;
        other.y += pushY;
        v.speed *= 0.5;
      }
    }
    
    // Avoid player
    const pdx = s.player.x - v.x;
    const pdy = s.player.y - v.y;
    const pdistSq = pdx * pdx + pdy * pdy;
    if (pdistSq < 4000) { // 63 units
      const pdist = Math.sqrt(pdistSq);
      if (pdist > 0) {
        v.x -= (pdx / pdist) * 5;
        v.y -= (pdy / pdist) * 5;
        v.speed *= 0.3;
      }
    }
    
    // Apply velocity
    v.velocityX = Math.cos(v.angle) * v.speed;
    v.velocityY = Math.sin(v.angle) * v.speed;
    v.x += v.velocityX * dt;
    v.y += v.velocityY * dt;
    
    // World bounds
    v.x = clamp(v.x, v.width / 2, WORLD.width - v.width / 2);
    v.y = clamp(v.y, v.length / 2, WORLD.height - v.length / 2);
  }
  
  function updatePoliceVehicle(s, v, dt) {
    const config = getVehicleConfig(v);
    const p = s.player;
    
    // Police AI based on wanted level
    if (p.wantedLevel === 0) {
      // Patrol
      v.policeState = 'patrol';
      updateTrafficVehicle(s, v, dt);
      v.siren = false;
      return;
    }
    
    v.siren = true;
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Determine behavior based on wanted level and distance
    if (dist < 30 && p.wantedLevel >= 3) {
      v.policeState = 'ram';
    } else if (dist < 100 && p.wantedLevel >= 2) {
      v.policeState = 'pursue';
    } else {
      v.policeState = 'pursue';
    }
    
    switch (v.policeState) {
      case 'pursue':
        // Chase player
        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = normalizeAngle(targetAngle - v.angle);
        v.angle += angleDiff * 0.15 * dt * 60;
        
        const pursueSpeed = config.maxSpeed * POLICE.pursuitSpeed;
        if (v.speed < pursueSpeed) {
          v.speed = Math.min(pursueSpeed, v.speed + config.acceleration * 1.2 * dt);
        }
        break;
        
      case 'ram':
        // Aggressive ramming
        const ramAngle = Math.atan2(dy, dx);
        const ramAngleDiff = normalizeAngle(ramAngle - v.angle);
        v.angle += ramAngleDiff * 0.3 * dt * 60;
        v.speed = config.maxSpeed;
        break;
        
      case 'blockade':
        // Try to get ahead
        const aheadX = p.x + Math.cos(p.angle) * 100;
        const aheadY = p.y + Math.sin(p.angle) * 100;
        const blockDx = aheadX - v.x;
        const blockDy = aheadY - v.y;
        const blockAngle = Math.atan2(blockDy, blockDx);
        const blockAngleDiff = normalizeAngle(blockAngle - v.angle);
        v.angle += blockAngleDiff * 0.1 * dt * 60;
        v.speed = config.maxSpeed * 0.8;
        break;
    }
    
    // Shooting
    if (p.wantedLevel >= 2 && dist < POLICE.shootRange) {
      v.shootTimer = (v.shootTimer || 0) - dt;
      if (v.shootTimer <= 0) {
        v.shootTimer = POLICE.shootCooldown;
        if (s.rng() < POLICE.shootAccuracy) {
          // Shoot at player
          p.health -= 10;
          s.camera.shake = 10;
          s.camera.shakeTime = 0.1;
          if (p.health <= 0) {
            p.wasted = true;
            p.wastedTimer = 5;
            s.screen = 'wasted';
          }
        }
      }
    }
    
    // Avoid other police
    for (const other of s.vehicles) {
      if (!other.active || other.id === v.id || !other.isPolice) continue;
      const odx = other.x - v.x;
      const ody = other.y - v.y;
      const odistSq = odx * odx + ody * ody;
      const minDist = 40;
      if (odistSq < minDist * minDist && odistSq > 0.1) {
        const odist = Math.sqrt(odistSq);
        v.x -= (odx / odist) * 2;
        v.y -= (ody / odist) * 2;
      }
    }
    
    // Apply velocity
    v.velocityX = Math.cos(v.angle) * v.speed;
    v.velocityY = Math.sin(v.angle) * v.speed;
    v.x += v.velocityX * dt;
    v.y += v.velocityY * dt;
    
    // World bounds
    v.x = clamp(v.x, v.width / 2, WORLD.width - v.width / 2);
    v.y = clamp(v.y, v.length / 2, WORLD.height - v.length / 2);
  }
  
  function updatePeds(s, dt) {
    for (const ped of s.peds) {
      if (!ped.active) continue;
      
      // Despawn check
      const dx = ped.x - s.player.x;
      const dy = ped.y - s.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > PEDESTRIAN.despawnRange * PEDESTRIAN.despawnRange) {
        release(ped);
        continue;
      }
      
      if (ped.state === 'dead') {
        ped.velocityX *= 0.95;
        ped.velocityY *= 0.95;
        ped.x += ped.velocityX * dt;
        ped.y += ped.velocityY * dt;
        ped.deathTimer = (ped.deathTimer || 0) + dt;
        if (ped.deathTimer > 30) {
          release(ped);
        }
        continue;
      }
      
      // State machine
      switch (ped.state) {
        case 'walk':
          updatePedWalk(s, ped, dt);
          break;
        case 'run':
          updatePedRun(s, ped, dt);
          break;
        case 'flee':
          updatePedFlee(s, ped, dt);
          break;
        case 'combat':
          updatePedCombat(s, ped, dt);
          break;
        case 'drive':
          // Driven by vehicle
          break;
      }
      
      // React to player
      if (ped.state !== 'drive' && ped.state !== 'dead') {
        const pdx = s.player.x - ped.x;
        const pdy = s.player.y - ped.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        
        if (pdist < 30 && s.player.wantedLevel > 0) {
          // Flee from wanted player
          ped.state = 'flee';
          ped.fleeFrom = { x: s.player.x, y: s.player.y };
        }
        
        if (pdist < 20 && ped.combatTarget === 'player') {
          ped.state = 'combat';
        }
      }
    }
  }
  
  function updatePedWalk(s, ped, dt) {
    ped.wanderTimer -= dt;
    if (ped.wanderTimer <= 0) {
      // New wander direction
      ped.wanderAngle += (s.rng() - 0.5) * Math.PI * 0.5;
      ped.wanderTimer = 2 + s.rng() * 5;
      
      // Sometimes stop
      if (s.rng() < 0.1) {
        ped.speed = 0;
        ped.wanderTimer = 1 + s.rng() * 3;
        return;
      }
    }
    
    if (ped.speed > 0) {
      ped.velocityX = Math.cos(ped.wanderAngle) * PEDESTRIAN.walkSpeed;
      ped.velocityY = Math.sin(ped.wanderAngle) * PEDESTRIAN.walkSpeed;
      ped.angle = ped.wanderAngle;
    } else {
      ped.velocityX = 0;
      ped.velocityY = 0;
    }
    
    // Move
    ped.x += ped.velocityX * dt;
    ped.y += ped.velocityY * dt;
    
    // Keep on walkable areas
    if (!isWalkable(s, ped.x, ped.y)) {
      ped.x -= ped.velocityX * dt;
      ped.y -= ped.velocityY * dt;
      ped.wanderAngle += Math.PI;
      ped.wanderTimer = 0.5;
    }
    
    // World bounds
    ped.x = clamp(ped.x, ped.width / 2, WORLD.width - ped.width / 2);
    ped.y = clamp(ped.y, ped.height / 2, WORLD.height - ped.height / 2);
  }
  
  function updatePedRun(s, ped, dt) {
    // Run towards target
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 10) {
      ped.state = 'walk';
      ped.wanderTimer = 1;
      return;
    }
    
    const angle = Math.atan2(dy, dx);
    ped.velocityX = Math.cos(angle) * PEDESTRIAN.runSpeed;
    ped.velocityY = Math.sin(angle) * PEDESTRIAN.runSpeed;
    ped.angle = angle;
    
    ped.x += ped.velocityX * dt;
    ped.y += ped.velocityY * dt;
    
    // World bounds
    ped.x = clamp(ped.x, ped.width / 2, WORLD.width - ped.width / 2);
    ped.y = clamp(ped.y, ped.height / 2, WORLD.height - ped.height / 2);
  }
  
  function updatePedFlee(s, ped, dt) {
    if (!ped.fleeFrom) {
      ped.state = 'walk';
      return;
    }
    
    const dx = ped.x - ped.fleeFrom.x;
    const dy = ped.y - ped.fleeFrom.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 100) {
      ped.state = 'walk';
      ped.fleeFrom = null;
      return;
    }
    
    const angle = Math.atan2(dy, dx);
    ped.velocityX = Math.cos(angle) * PEDESTRIAN.runSpeed;
    ped.velocityY = Math.sin(angle) * PEDESTRIAN.runSpeed;
    ped.angle = angle;
    
    ped.x += ped.velocityX * dt;
    ped.y += ped.velocityY * dt;
    
    // World bounds
    ped.x = clamp(ped.x, ped.width / 2, WORLD.width - ped.width / 2);
    ped.y = clamp(ped.y, ped.height / 2, WORLD.height - ped.height / 2);
  }
  
  function updatePedCombat(s, ped, dt) {
    if (ped.combatTarget !== 'player') {
      ped.state = 'walk';
      return;
    }
    
    const dx = s.player.x - ped.x;
    const dy = s.player.y - ped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 50) {
      // Chase player
      const angle = Math.atan2(dy, dx);
      ped.velocityX = Math.cos(angle) * PEDESTRIAN.runSpeed;
      ped.velocityY = Math.sin(angle) * PEDESTRIAN.runSpeed;
      ped.angle = angle;
    } else {
      // Attack
      ped.velocityX = 0;
      ped.velocityY = 0;
      ped.attackCooldown -= dt;
      if (ped.attackCooldown <= 0) {
        ped.attackCooldown = 1.5;
        // Melee attack on player
        if (dist < 25) {
          s.player.health -= 10;
          s.camera.shake = 8;
          s.camera.shakeTime = 0.1;
          if (s.player.health <= 0) {
            s.player.wasted = true;
            s.player.wastedTimer = 5;
            s.screen = 'wasted';
          }
        }
      }
    }
    
    ped.x += ped.velocityX * dt;
    ped.y += ped.velocityY * dt;
    
    // World bounds
    ped.x = clamp(ped.x, ped.width / 2, WORLD.width - ped.width / 2);
    ped.y = clamp(ped.y, ped.height / 2, WORLD.height - ped.height / 2);
  }
  
  function updatePolice(s, dt) {
    let events = 0;
    
    // Spawn police based on wanted level
    const targetPolice = Math.min(POLICE.maxUnits, s.player.wantedLevel * 3);
    const activePolice = s.vehicles.filter(v => v.active && v.isPolice).length;
    
    if (activePolice < targetPolice && s.player.wantedLevel > 0) {
      spawnPoliceVehicle(s);
    }
    
    // Update police units array for reference
    s.policeUnits = s.vehicles.filter(v => v.active && v.isPolice);
    
    // Helicopter
    if (POLICE.helicopter.enabled && s.player.wantedLevel >= POLICE.helicopter.spawnAtStars) {
      // Helicopter logic would go here
    }
    
    return events;
  }
  
  function spawnPoliceVehicle(s) {
    const v = acquire(s.vehicles);
    if (!v) return null;
    
    // Spawn near player but out of sight
    const angle = s.rng() * Math.PI * 2;
    const dist = 300 + s.rng() * 200;
    const spawnX = s.player.x + Math.cos(angle) * dist;
    const spawnY = s.player.y + Math.sin(angle) * dist;
    
    // Find road near spawn
    const pos = findRoadPosition(s, spawnX, spawnY, 100);
    if (!pos.found) {
      release(v);
      return null;
    }
    
    const type = VEHICLE.police;
    v.id = s.frame * 1000 + s.vehicles.indexOf(v);
    v.type = VEH_TYPE_POLICE;
    v.x = pos.x;
    v.y = pos.y;
    v.angle = Math.atan2(s.player.y - pos.y, s.player.x - pos.x);
    v.speed = 0;
    v.velocityX = 0;
    v.velocityY = 0;
    v.angularVelocity = 0;
    v.width = type.width;
    v.length = type.length;
    v.maxSpeed = type.maxSpeed;
    v.acceleration = type.acceleration;
    v.brakeForce = type.brakeForce;
    v.turnSpeed = type.turnSpeed;
    v.driftFactor = type.driftFactor;
    v.mass = type.mass;
    v.health = type.maxHealth;
    v.maxHealth = type.maxHealth;
    v.driver = { type: 'ai', pedId: -1 };
    v.passengers = [];
    v.isPolice = true;
    v.policeState = 'pursue';
    v.targetX = s.player.x;
    v.targetY = s.player.y;
    v.path = [];
    v.pathIndex = 0;
    v.lane = 0;
    v.laneOffset = 0;
    v.siren = true;
    v.stuckTimer = 0;
    v.lastRoadX = pos.x;
    v.lastRoadY = pos.y;
    v.color = '#1a1a2e'; // Dark police color
    v.shootTimer = 0;
    
    // Create police peds
    for (let i = 0; i < 2; i++) {
      const ped = spawnPed(s, pos.x, pos.y, 'police');
      if (ped) {
        ped.isGang = false;
        ped.color = '#1a1a2e';
        if (i === 0) v.driver.pedId = ped.id;
      }
    }
    
    return v;
  }
  
  function updateMissions(s, dt) {
    let events = 0;
    
    for (const mission of s.missions) {
      if (mission.completed || mission.failed) continue;
      if (mission.requiredMission !== undefined && !s.missions[mission.requiredMission].completed) continue;
      
      const obj = mission.objectives[mission.currentObjective];
      if (!obj) continue;
      
      const p = s.player;
      const dx = obj.target.x - p.x;
      const dy = obj.target.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      switch (obj.type) {
        case 'goto':
          if (dist < obj.radius) {
            mission.currentObjective++;
            addMessage(s, `Objective complete: ${obj.text}`, 3000);
            if (mission.currentObjective >= mission.objectives.length) {
              completeMission(s, mission);
              events |= EVENT_MISSION_COMPLETE;
            } else {
              // Update GPS
              const nextObj = mission.objectives[mission.currentObjective];
              s.gpsTarget = { x: nextObj.target.x, y: nextObj.target.y };
              s.gpsRoute = [];
            }
          }
          break;
          
        case 'enter':
          if (dist < obj.radius && input.action) {
            mission.currentObjective++;
            addMessage(s, `Objective complete: ${obj.text}`, 3000);
          }
          break;
          
        case 'pickup':
          if (dist < obj.radius) {
            mission.currentObjective++;
            addMessage(s, `Objective complete: ${obj.text}`, 3000);
            // Give item
          }
          break;
          
        case 'deliver':
          if (dist < obj.radius) {
            mission.currentObjective++;
            addMessage(s, `Objective complete: ${obj.text}`, 3000);
          }
          break;
          
        case 'survive_wanted':
          if (p.wantedLevel >= obj.target.stars) {
            obj.target.duration -= dt;
            if (obj.target.duration <= 0) {
              mission.currentObjective++;
              addMessage(s, `Objective complete: ${obj.text}`, 3000);
            }
          } else if (p.wantedLevel === 0 && obj.target.duration < obj.target.duration + dt) {
            // Failed - lost wanted level
            failMission(s, mission, 'You lost the heat!');
            events |= EVENT_MISSION_FAIL;
          }
          break;
          
        case 'taxi':
          // Simplified taxi mission
          if (!mission.fareCount) mission.fareCount = 0;
          if (dist < 30 && p.inVehicle) {
            mission.fareCount++;
            addMessage(s, `Fare complete! (${mission.fareCount}/${obj.target.count})`, 2000);
            p.money += 200;
            if (mission.fareCount >= obj.target.count) {
              mission.currentObjective++;
              addMessage(s, `Objective complete: ${obj.text}`, 3000);
            } else {
              // New random fare
              obj.target.x = s.rng() * WORLD.width;
              obj.target.y = s.rng() * WORLD.height;
              s.gpsTarget = { x: obj.target.x, y: obj.target.y };
              s.gpsRoute = [];
            }
          }
          break;
          
        case 'race':
          // Check checkpoint progression
          if (!mission.checkpointIndex) mission.checkpointIndex = 0;
          const cp = obj.target.checkpoints[mission.checkpointIndex];
          if (cp) {
            const cdx = cp.x - p.x;
            const cdy = cp.y - p.y;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (cdist < 30) {
              mission.checkpointIndex++;
              addMessage(s, `Checkpoint ${mission.checkpointIndex}/${obj.target.checkpoints.length}`, 2000);
              if (mission.checkpointIndex >= obj.target.checkpoints.length) {
                mission.currentObjective++;
                addMessage(s, `Objective complete: ${obj.text}`, 3000);
              }
            }
          }
          break;
          
        case 'escort':
          // Check if escorted ped is with player
          if (dist < obj.radius && mission.escortPed) {
            const ped = s.peds.find(p => p.id === mission.escortPed);
            if (ped && ped.active) {
              const pdx = ped.x - obj.target.x;
              const pdy = ped.y - obj.target.y;
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
              if (pdist < obj.radius) {
                mission.currentObjective++;
                addMessage(s, `Objective complete: ${obj.text}`, 3000);
              }
            }
          }
          break;
      }
    }
    
    return events;
  }
  
  function completeMission(s, mission) {
    mission.completed = true;
    s.player.money += mission.reward;
    s.player.stats.missionsCompleted++;
    addMessage(s, `MISSION COMPLETE! +$${mission.reward}`, 5000);
    
    // Unlock next missions
    for (const unlockId of mission.unlocks || []) {
      const m = s.missions.find(m => m.id === unlockId);
      if (m && !m.markerCreated) {
        createMissionMarker(s, m);
        m.markerCreated = true;
      }
    }
    
    // Remove marker
    const markerIdx = s.missionMarkers.findIndex(m => m.missionId === mission.id);
    if (markerIdx >= 0) s.missionMarkers.splice(markerIdx, 1);
    
    // Clear GPS
    s.gpsTarget = null;
    s.gpsRoute = [];
  }
  
  function failMission(s, mission, reason) {
    mission.failed = true;
    addMessage(s, `MISSION FAILED: ${reason}`, 5000);
    
    // Remove marker
    const markerIdx = s.missionMarkers.findIndex(m => m.missionId === mission.id);
    if (markerIdx >= 0) s.missionMarkers.splice(markerIdx, 1);
    
    // Clear GPS
    s.gpsTarget = null;
    s.gpsRoute = [];
  }
  
  function updatePickups(s, dt) {
    for (const p of s.pickups) {
      if (!p.active) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.active = true;
          p.bobOffset = s.rng() * Math.PI * 2;
        }
        continue;
      }
      
      p.bobOffset += dt * 3;
      
      // Check player pickup
      const dx = s.player.x - p.x;
      const dy = s.player.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 20) {
        collectPickup(s, p);
      }
    }
  }
  
  function collectPickup(s, pickup) {
    const p = s.player;
    
    switch (pickup.type) {
      case 'health':
        p.health = Math.min(PLAYER.maxHealth, p.health + pickup.value);
        addMessage(s, `Health +${pickup.value}`, 2000);
        break;
      case 'armor':
        p.armor = Math.min(PLAYER.maxArmor, p.armor + pickup.value);
        addMessage(s, `Armor +${pickup.value}`, 2000);
        break;
      case 'weapon':
        if (pickup.weapon && WEAPON[pickup.weapon]) {
          p.weapon = pickup.weapon;
          p.ammo[pickup.weapon] = Math.min(WEAPON[pickup.weapon].maxAmmo, (p.ammo[pickup.weapon] || 0) + WEAPON[pickup.weapon].ammo);
          addMessage(s, `Got ${pickup.weapon}!`, 2000);
        }
        break;
      case 'money':
        p.money += pickup.value;
        addMessage(s, `+$${pickup.value}`, 2000);
        break;
    }
    
    pickup.active = false;
    pickup.respawnTimer = pickup.respawnTime;
    events |= EVENT_PICKUP;
  }
  
  function updateCheckpoints(s, dt) {
    for (let i = s.checkpoints.length - 1; i >= 0; i--) {
      const cp = s.checkpoints[i];
      cp.timer -= dt;
      if (cp.timer <= 0) {
        s.checkpoints.splice(i, 1);
      }
    }
  }
  
  function managePopulation(s) {
    // Maintain traffic count
    const activeTraffic = s.vehicles.filter(v => v.active && !v.isPolice).length;
    if (activeTraffic < TRAFFIC.maxVehicles * 0.5 && s.rng() < 0.02) {
      spawnTrafficVehicle(s);
    }
    
    // Maintain ped count per sector
    // (Simplified - would track per sector in full implementation)
    const activePeds = s.peds.filter(p => p.active).length;
    const targetPeds = Math.min(pedPoolSize, 100);
    if (activePeds < targetPeds && s.rng() < 0.01) {
      const sectorX = Math.floor(s.rng() * WORLD.gridSize);
      const sectorY = Math.floor(s.rng() * WORLD.gridSize);
      spawnPedsInSector(s, sectorX, sectorY);
    }
  }
  
  function calculateRoute(s) {
    // Simplified A* pathfinding on road network
    // For now, just create a straight line with road snapping
    if (!s.gpsTarget) return;
    
    const start = { x: s.player.x, y: s.player.y };
    const end = { x: s.gpsTarget.x, y: s.gpsTarget.y };
    
    // Simple waypoint generation
    s.gpsRoute = [start];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = lerp(start.x, end.x, t);
      const y = lerp(start.y, end.y, t);
      // Snap to nearest road
      const roadPos = findRoadPosition(s, x, y, 100);
      if (roadPos.found) {
        s.gpsRoute.push({ x: roadPos.x, y: roadPos.y });
      } else {
        s.gpsRoute.push({ x, y });
      }
    }
    s.gpsRoute.push(end);
  }
  
  function respawnPlayer(s) {
    const p = s.player;
    p.wasted = false;
    p.health = PLAYER.maxHealth;
    p.armor = 0;
    p.wantedLevel = 0;
    p.wantedStars = 0;
    p.money = Math.floor(p.money * 0.9); // Lose 10% money
    p.inVehicle = false;
    p.vehicleId = -1;
    
    // Respawn at hospital/police station
    const hospitals = [
      { x: 10 * WORLD.sectorSize, y: 10 * WORLD.sectorSize },
      { x: 26 * WORLD.sectorSize, y: 8 * WORLD.sectorSize },
      { x: 4 * WORLD.sectorSize, y: 22 * WORLD.sectorSize },
    ];
    const hosp = hospitals[Math.floor(s.rng() * hospitals.length)];
    const pos = findRoadPosition(s, hosp.x, hosp.y, 200);
    p.x = pos.x;
    p.y = pos.y;
    p.velocityX = 0;
    p.velocityY = 0;
    
    s.camera.x = p.x;
    s.camera.y = p.y;
    s.camera.targetX = p.x;
    s.camera.targetY = p.y;
    
    s.screen = 'play';
    addMessage(s, 'You were wasted. Lost $' + Math.floor(p.money * 0.1), 4000);
  }
  
  function isWalkable(s, x, y) {
    // Water check
    const sectorX = Math.floor(x / WORLD.sectorSize);
    const sectorY = Math.floor(y / WORLD.sectorSize);
    if (sectorX < 0 || sectorX >= WORLD.gridSize || sectorY < 0 || sectorY >= WORLD.gridSize) return false;
    
    const district = getDistrictAt(x, y);
    if (district.type === 'water') return false;
    
    // Building check (simplified)
    // In a real implementation, this would check against building geometry
    return true;
  }
  
  function getVehicleConfig(v) {
    switch (v.type) {
      case VEH_TYPE_MOTORCYCLE: return VEHICLE.motorcycle;
      case VEH_TYPE_TRUCK: return VEHICLE.truck;
      case VEH_TYPE_POLICE: return VEHICLE.police;
      default: return VEHICLE.car;
    }
  }
  
  function checkVehicleCollision(v1, v2) {
    // Simplified AABB collision
    const hw1 = v1.width / 2, hl1 = v1.length / 2;
    const hw2 = v2.width / 2, hl2 = v2.length / 2;
    
    // Rotate corners (simplified - just use AABB for now)
    return Math.abs(v1.x - v2.x) < hw1 + hw2 && Math.abs(v1.y - v2.y) < hl1 + hl2;
  }
  
  function resolveVehicleCollision(v1, v2, dt) {
    // Simple separation
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const overlap = (v1.width + v2.width) * 0.5 - dist;
    if (overlap > 0) {
      v1.x -= (dx / dist) * overlap * 0.5;
      v1.y -= (dy / dist) * overlap * 0.5;
      v2.x += (dx / dist) * overlap * 0.5;
      v2.y += (dy / dist) * overlap * 0.5;
    }
    
    // Transfer momentum
    const totalMass = v1.mass + v2.mass;
    const v1x = v1.velocityX, v1y = v1.velocityY;
    const v2x = v2.velocityX, v2y = v2.velocityY;
    
    v1.velocityX = (v1x * (v1.mass - v2.mass) + 2 * v2.mass * v2x) / totalMass;
    v1.velocityY = (v1y * (v1.mass - v2.mass) + 2 * v2.mass * v2y) / totalMass;
    v2.velocityX = (v2x * (v2.mass - v1.mass) + 2 * v1.mass * v1x) / totalMass;
    v2.velocityY = (v2y * (v2.mass - v1.mass) + 2 * v1.mass * v1y) / totalMass;
    
    // Damage
    const impactSpeed = Math.sqrt((v1x - v2x) ** 2 + (v1y - v2y) ** 2);
    const damage = impactSpeed * 0.1;
    v1.health -= damage;
    v2.health -= damage;
  }
  
  function checkVehiclePedCollision(v, ped) {
    const hw = v.width / 2, hl = v.length / 2;
    return Math.abs(v.x - ped.x) < hw + ped.width / 2 && Math.abs(v.y - ped.y) < hl + ped.height / 2;
  }
  
  function hitPedWithVehicle(v, ped) {
    ped.health -= 50;
    ped.state = 'dead';
    ped.velocityX = v.velocityX * 0.5;
    ped.velocityY = v.velocityY * 0.5;
    ped.deathTimer = 0;
    s.player.stats.kills++;
    addWanted(s, 1);
  }
  
  function explodeVehicle(s, v) {
    // Explosion effect
    addMessage(s, 'Vehicle destroyed!', 2000);
    s.camera.shake = 30;
    s.camera.shakeTime = 0.5;
    
    // Damage nearby
    for (const ped of s.peds) {
      if (!ped.active || ped.state === 'dead') continue;
      const dx = ped.x - v.x;
      const dy = ped.y - v.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 50) {
        ped.health -= 100;
        if (ped.health <= 0) {
          ped.state = 'dead';
          ped.velocityX = (dx / dist) * 10;
          ped.velocityY = (dy / dist) * 10;
        }
      }
    }
    
    for (const other of s.vehicles) {
      if (!other.active || other.id === v.id) continue;
      const dx = other.x - v.x;
      const dy = other.y - v.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60) {
        other.health -= 100;
      }
    }
    
    releaseVehicle(s, v);
  }
  
  function releaseVehicle(s, v) {
    v.active = false;
    // Release driver ped
    if (v.driver && v.driver.type === 'ai' && v.driver.pedId >= 0) {
      const ped = s.peds.find(p => p.id === v.driver.pedId);
      if (ped) release(ped);
    }
  }
  
  function getLaneCenter(s, x, y, lane) {
    // Simplified - return center of current lane
    const roadDir = getRoadDirection(s, x, y);
    if (roadDir === -1) return null;
    
    const sectorX = Math.floor(x / WORLD.sectorSize);
    const sectorY = Math.floor(y / WORLD.sectorSize);
    const localX = x % WORLD.sectorSize;
    const localY = y % WORLD.sectorSize;
    
    if (roadDir === 0) { // N/S road
      return sectorX * WORLD.sectorSize + WORLD.sectorSize / 2 + lane * ROAD_NETWORK.laneOffset;
    } else { // E/W road
      return sectorY * WORLD.sectorSize + WORLD.sectorSize / 2 + lane * ROAD_NETWORK.laneOffset;
    }
  }
  
  function handleCheats(s) {
    // Cheat handling would go here
    // For now, just clear buffer periodically
    if (s.cheatBuffer.length > 20) s.cheatBuffer = s.cheatBuffer.slice(-20);
  }
  
  // Save/Load
  function getSaveData(s) {
    return {
      version: SAVE.version,
      player: { ...s.player, input: undefined },
      camera: { ...s.camera },
      timeOfDay: s.timeOfDay,
      weather: s.weather,
      targetWeather: s.targetWeather,
      vehicles: s.vehicles.filter(v => v.active).map(v => ({ ...v })),
      peds: s.peds.filter(p => p.active).map(p => ({ ...p })),
      missions: s.missions.map(m => ({ ...m })),
      pickups: s.pickups.filter(p => p.active).map(p => ({ ...p })),
      gpsRoute: s.gpsRoute,
      gpsTarget: s.gpsTarget,
      stats: { ...s.player.stats },
    };
  }
  
  // Public API
  return {
    ...state,
    step,
    getSaveData,
    addWanted,
    clearWanted,
    setWantedLevel,
    spawnTrafficVehicle,
    spawnPoliceVehicle,
    spawnPed,
    createMissionMarker,
    addMessage,
    findRoadPosition,
    isOnRoad,
    getDistrictAt,
    distance,
    distanceSq,
    angleTo,
    normalizeAngle,
    clamp,
    lerp,
  };
}