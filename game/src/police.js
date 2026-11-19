// Police System - Wanted levels, pursuit, arrest, helicopters, roadblocks
import { POLICE, WORLD, PLAYER, VEHICLE, PALETTE } from './config.js';
import { distance, distanceSq, angleTo, normalizeAngle, clamp, lerp, findRoadPosition, isOnRoad, getRoadDirection } from './world.js';
import { createVehicle, VEH_TYPE_POLICE, VEHICLE_STATES, updateVehicle, explodeVehicle } from './vehicles.js';

export const WANTED_NONE = 0;
export const WANTED_ONE = 1;
export const WANTED_TWO = 2;
export const WANTED_THREE = 3;
export const WANTED_FOUR = 4;
export const WANTED_FIVE = 5;

export const POLICE_STATES = {
  IDLE: 'idle',
  PATROL: 'patrol',
  RESPONDING: 'responding',
  PURSUING: 'pursuing',
  SEARCHING: 'searching',
  BLOCKADE: 'blockade',
  HELICOPTER: 'helicopter',
  ARRESTING: 'arresting',
};

export const POLICE_UNIT_TYPES = {
  PATROL_CAR: 'patrol_car',
  UNDERCOVER: 'undercover',
  SWAT: 'swat',
  FBI: 'fbi',
  ARMY: 'army',
  HELICOPTER: 'helicopter',
  BOAT: 'boat',
  ROADBLOCK: 'roadblock',
  SPIKE_STRIP: 'spike_strip',
};

const WANTED_CONFIG = {
  [WANTED_NONE]: { maxUnits: 0, responseTime: 0, searchRadius: 0, helicopter: false, roadblocks: false, spikes: false, swat: false, fbi: false, army: false },
  [WANTED_ONE]: { maxUnits: 3, responseTime: 30, searchRadius: 200, helicopter: false, roadblocks: false, spikes: false, swat: false, fbi: false, army: false },
  [WANTED_TWO]: { maxUnits: 6, responseTime: 20, searchRadius: 300, helicopter: false, roadblocks: true, spikes: false, swat: false, fbi: false, army: false },
  [WANTED_THREE]: { maxUnits: 10, responseTime: 12, searchRadius: 400, helicopter: true, roadblocks: true, spikes: true, swat: false, fbi: false, army: false },
  [WANTED_FOUR]: { maxUnits: 15, responseTime: 6, searchRadius: 500, helicopter: true, roadblocks: true, spikes: true, swat: true, fbi: false, army: false },
  [WANTED_FIVE]: { maxUnits: 20, responseTime: 3, searchRadius: 600, helicopter: true, roadblocks: true, spikes: true, swat: true, fbi: true, army: false },
};

const ARREST_DISTANCE = 3;
const ARREST_TIME = 2; // seconds to arrest when in range

export function createPoliceSystem() {
  return {
    units: [],
    helicopters: [],
    roadblocks: [],
    spikeStrips: [],
    wantedLevel: WANTED_NONE,
    wantedStars: 0,
    wantedDecay: 0,
    lastCrimeTime: 0,
    lastSeenPosition: { x: 0, y: 0 },
    lastSeenTime: 0,
    isSearching: false,
    searchCenter: { x: 0, y: 0 },
    searchRadius: 0,
    searchTimer: 0,
    arrestProgress: 0,
    arrestingOfficer: null,
    busted: false,
    bustedTimer: 0,
    // Statistics
    stats: {
      crimesCommitted: 0,
      vehiclesStolen: 0,
      pedsKilled: 0,
      copsKilled: 0,
      timeWanted: 0,
      timesArrested: 0,
      timesEscaped: 0,
    },
  };
}

export function updatePolice(police, world, dt) {
  const player = world.player;
  const config = WANTED_CONFIG[police.wantedLevel] || WANTED_CONFIG[WANTED_NONE];
  
  // Update wanted level decay
  updateWantedDecay(police, player, dt, config);
  
  // Update search state
  updateSearch(police, player, dt, config);
  
  // Spawn/despawn units
  managePoliceUnits(police, world, dt, config);
  
  // Update each unit
  for (const unit of police.units) {
    if (!unit.active) continue;
    updatePoliceUnit(unit, police, world, dt, config);
  }
  
  // Update helicopters
  for (const heli of police.helicopters) {
    if (!heli.active) continue;
    updateHelicopter(heli, police, world, dt, config);
  }
  
  // Update roadblocks
  for (const block of police.roadblocks) {
    if (!block.active) continue;
    updateRoadblock(block, police, world, dt);
  }
  
  // Update spike strips
  for (const spikes of police.spikeStrips) {
    if (!spikes.active) continue;
    updateSpikeStrip(spikes, world, dt);
  }
  
  // Check arrest
  checkArrest(police, player, dt);
  
  // Check busted
  if (police.busted) {
    police.bustedTimer -= dt;
    if (police.bustedTimer <= 0) {
      onBusted(world);
    }
  }
  
  // Update stats
  if (police.wantedLevel > 0) {
    police.stats.timeWanted += dt;
  }
}

function updateWantedDecay(police, player, dt, config) {
  if (police.wantedLevel === WANTED_NONE) return;
  
  // Decay when hidden and not in line of sight
  if (player.isHidden && police.searchTimer <= 0) {
    police.wantedDecay += dt;
    const decayRate = 1 / (PLAYER.wantedDecayRate * (1 + police.wantedLevel * 0.5));
    if (police.wantedDecay >= decayRate) {
      police.wantedDecay = 0;
      setWantedLevel(police, police.wantedLevel - 1);
    }
  } else {
    police.wantedDecay = 0;
  }
  
  // Update stars display
  police.wantedStars = police.wantedLevel;
}

function updateSearch(police, player, dt, config) {
  if (police.wantedLevel === WANTED_NONE) {
    police.isSearching = false;
    return;
  }
  
  // Update last seen position when player is visible
  const canSeePlayer = canPoliceSeePlayer(police, world, player);
  if (canSeePlayer) {
    police.lastSeenPosition.x = player.x;
    police.lastSeenPosition.y = player.y;
    police.lastSeenTime = 0;
    police.isSearching = false;
    police.searchTimer = 0;
  } else {
    police.lastSeenTime += dt;
    
    // Enter search mode after losing sight
    if (police.lastSeenTime > 5 && !police.isSearching) {
      police.isSearching = true;
      police.searchCenter.x = police.lastSeenPosition.x;
      police.searchCenter.y = police.lastSeenPosition.y;
      police.searchRadius = config.searchRadius;
      police.searchTimer = 30; // Search for 30 seconds
    }
  }
  
  if (police.isSearching) {
    police.searchTimer -= dt;
    police.searchRadius = Math.min(config.searchRadius * 2, police.searchRadius + dt * 50);
    
    if (police.searchTimer <= 0) {
      police.isSearching = false;
      // Reduce wanted level if not found
      if (police.wantedLevel > 0) {
        setWantedLevel(police, police.wantedLevel - 1);
      }
    }
  }
}

function canPoliceSeePlayer(police, world, player) {
  // Check if any police unit has line of sight
  for (const unit of police.units) {
    if (!unit.active) continue;
    const dx = player.x - unit.x;
    const dy = player.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 150) { // Visual range
      // Check line of sight (simplified - no building occlusion)
      return true;
    }
  }
  
  // Helicopter sight
  for (const heli of police.helicopters) {
    if (!heli.active) continue;
    const dx = player.x - heli.x;
    const dy = player.y - heli.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 300) return true;
  }
  
  return false;
}

function managePoliceUnits(police, world, dt, config) {
  const activeUnits = police.units.filter(u => u.active).length;
  const targetUnits = Math.min(config.maxUnits, activeUnits + 1);
  
  // Spawn new units if needed
  if (activeUnits < targetUnits && police.wantedLevel > 0) {
    if (Math.random() < dt * 0.5) { // Spawn rate
      spawnPoliceUnit(police, world, config);
    }
  }
  
  // Despawn units far from player
  for (let i = police.units.length - 1; i >= 0; i--) {
    const unit = police.units[i];
    if (!unit.active) continue;
    
    const dx = unit.x - player.x;
    const dy = unit.y - player.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq > 1000 * 1000) { // 1000 units away
      // Chance to despawn
      if (Math.random() < dt * 0.1) {
        unit.active = false;
      }
    }
  }
  
  // Manage helicopters
  if (config.helicopter && police.helicopters.filter(h => h.active).length === 0) {
    if (Math.random() < dt * 0.2) {
      spawnHelicopter(police, world);
    }
  }
  
  // Manage roadblocks
  if (config.roadblocks && police.roadblocks.filter(r => r.active).length < 3) {
    if (Math.random() < dt * 0.05) {
      spawnRoadblock(police, world);
    }
  }
  
  // Manage spike strips
  if (config.spikes && police.spikeStrips.filter(s => s.active).length < 5) {
    if (Math.random() < dt * 0.1) {
      spawnSpikeStrip(police, world);
    }
  }
}

function spawnPoliceUnit(police, world, config) {
  // Spawn near player but out of sight
  const angle = Math.random() * Math.PI * 2;
  const dist = 300 + Math.random() * 400;
  let spawnX = player.x + Math.cos(angle) * dist;
  let spawnY = player.y + Math.sin(angle) * dist;
  
  // Find road
  const pos = findRoadPosition(world, spawnX, spawnY, 200);
  if (!pos.found) return null;
  
  // Determine unit type based on wanted level
  let unitType = POLICE_UNIT_TYPES.PATROL_CAR;
  if (police.wantedLevel >= 4 && Math.random() < 0.3) unitType = POLICE_UNIT_TYPES.SWAT;
  if (police.wantedLevel >= 5 && Math.random() < 0.2) unitType = POLICE_UNIT_TYPES.FBI;
  
  const vehicle = createVehicle(VEH_TYPE_POLICE, pos.x, pos.y, 0, {
    state: VEHICLE_STATES.RESPONDING,
    aiPersonality: unitType === POLICE_UNIT_TYPES.SWAT ? 'aggressive' : 'normal',
  });
  
  vehicle.unitType = unitType;
  vehicle.isPolice = true;
  vehicle.siren = true;
  vehicle.color = getUnitColor(unitType);
  vehicle.roofColor = getUnitRoofColor(unitType);
  vehicle.health = getUnitHealth(unitType);
  vehicle.maxHealth = vehicle.health;
  
  // Add police officers as passengers
  vehicle.officers = createOfficers(unitType);
  
  const unit = {
    id: Date.now() + Math.random(),
    vehicle,
    type: unitType,
    state: POLICE_STATES.RESPONDING,
    targetX: player.x,
    targetY: player.y,
    lastKnownPlayerX: player.x,
    lastKnownPlayerY: player.y,
    patrolPoint: null,
    patrolIndex: 0,
    shootTimer: 0,
    accuracy: getUnitAccuracy(unitType),
    armor: getUnitArmor(unitType),
    active: true,
  };
  
  police.units.push(unit);
  world.vehicles.push(vehicle);
  vehicle.active = true;
  
  return unit;
}

function getUnitColor(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return '#1a1a2e';
    case POLICE_UNIT_TYPES.UNDERCOVER: return PALETTE.carColors[Math.floor(Math.random() * PALETTE.carColors.length)];
    case POLICE_UNIT_TYPES.SWAT: return '#0d1b2a';
    case POLICE_UNIT_TYPES.FBI: return '#1a1a1a';
    case POLICE_UNIT_TYPES.ARMY: return '#2d5a27';
    default: return '#1a1a2e';
  }
}

function getUnitRoofColor(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return '#ffffff';
    case POLICE_UNIT_TYPES.SWAT: return '#1a1a2e';
    case POLICE_UNIT_TYPES.FBI: return '#0a0a0a';
    case POLICE_UNIT_TYPES.ARMY: return '#1e3d1a';
    default: return '#ffffff';
  }
}

function getUnitHealth(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return 600;
    case POLICE_UNIT_TYPES.UNDERCOVER: return 500;
    case POLICE_UNIT_TYPES.SWAT: return 1000;
    case POLICE_UNIT_TYPES.FBI: return 800;
    case POLICE_UNIT_TYPES.ARMY: return 1500;
    default: return 600;
  }
}

function getUnitAccuracy(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return 0.5;
    case POLICE_UNIT_TYPES.UNDERCOVER: return 0.6;
    case POLICE_UNIT_TYPES.SWAT: return 0.75;
    case POLICE_UNIT_TYPES.FBI: return 0.85;
    case POLICE_UNIT_TYPES.ARMY: return 0.9;
    default: return 0.5;
  }
}

function getUnitArmor(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return 0;
    case POLICE_UNIT_TYPES.UNDERCOVER: return 0;
    case POLICE_UNIT_TYPES.SWAT: return 50;
    case POLICE_UNIT_TYPES.FBI: return 30;
    case POLICE_UNIT_TYPES.ARMY: return 100;
    default: return 0;
  }
}

function createOfficers(type) {
  const count = type === POLICE_UNIT_TYPES.SWAT ? 4 : (type === POLICE_UNIT_TYPES.FBI ? 3 : 2);
  const officers = [];
  for (let i = 0; i < count; i++) {
    officers.push({
      id: Date.now() + i + Math.random(),
      type: type === POLICE_UNIT_TYPES.SWAT ? 'swat' : (type === POLICE_UNIT_TYPES.FBI ? 'fbi' : 'patrol'),
      health: 100,
      armor: getUnitArmor(type),
      weapon: getOfficerWeapon(type),
      state: 'combat',
      target: null,
    });
  }
  return officers;
}

function getOfficerWeapon(type) {
  switch (type) {
    case POLICE_UNIT_TYPES.PATROL_CAR: return 'pistol';
    case POLICE_UNIT_TYPES.UNDERCOVER: return 'pistol';
    case POLICE_UNIT_TYPES.SWAT: return 'rifle';
    case POLICE_UNIT_TYPES.FBI: return 'rifle';
    case POLICE_UNIT_TYPES.ARMY: return 'rifle';
    default: return 'pistol';
  }
}

function spawnHelicopter(police, world) {
  const heli = {
    id: Date.now() + Math.random(),
    x: world.player.x + (Math.random() - 0.5) * 500,
    y: world.player.y + (Math.random() - 0.5) * 500,
    z: 100, // altitude
    targetZ: 100,
    angle: 0,
    speed: 0,
    maxSpeed: 300,
    spotlightAngle: 0,
    spotlightOn: true,
    gunner: { weapon: 'minigun', accuracy: 0.6, shootTimer: 0 },
    pilot: { state: 'orbit' },
    active: true,
    health: 500,
    maxHealth: 500,
    smokeLevel: 0,
  };
  
  police.helicopters.push(heli);
  return heli;
}

function spawnRoadblock(police, world) {
  // Place on major road ahead of player
  const aheadDist = 400;
  const angle = world.player.angle || 0;
  let blockX = world.player.x + Math.cos(angle) * aheadDist;
  let blockY = world.player.y + Math.sin(angle) * aheadDist;
  
  const pos = findRoadPosition(world, blockX, blockY, 150);
  if (!pos.found) return null;
  
  const roadDir = getRoadDirection(world, pos.x, pos.y);
  const blockAngle = roadDir === 0 ? Math.PI / 2 : 0; // Perpendicular to road
  
  const block = {
    id: Date.now() + Math.random(),
    x: pos.x,
    y: pos.y,
    angle: blockAngle,
    length: 60,
    width: 4,
    vehicles: [],
    spikes: false,
    active: true,
    timer: 120, // Lasts 2 minutes
  };
  
  // Place blocking vehicles
  const vehicleCount = 3;
  for (let i = 0; i < vehicleCount; i++) {
    const offset = (i - 1) * 20;
    const vx = pos.x + Math.cos(blockAngle + Math.PI / 2) * offset;
    const vy = pos.y + Math.sin(blockAngle + Math.PI / 2) * offset;
    const vehicle = createVehicle(VEH_TYPE_POLICE, vx, vy, blockAngle, {
      state: VEHICLE_STATES.BLOCKADE,
    });
    vehicle.active = true;
    vehicle.siren = true;
    block.vehicles.push(vehicle);
    world.vehicles.push(vehicle);
  }
  
  police.roadblocks.push(block);
  return block;
}

function spawnSpikeStrip(police, world) {
  const aheadDist = 300 + Math.random() * 300;
  const angle = world.player.angle + (Math.random() - 0.5) * 0.5;
  let spikeX = world.player.x + Math.cos(angle) * aheadDist;
  let spikeY = world.player.y + Math.sin(angle) * aheadDist;
  
  const pos = findRoadPosition(world, spikeX, spikeY, 100);
  if (!pos.found) return null;
  
  const roadDir = getRoadDirection(world, pos.x, pos.y);
  const spikeAngle = roadDir === 0 ? 0 : Math.PI / 2; // Along road
  
  const spikes = {
    id: Date.now() + Math.random(),
    x: pos.x,
    y: pos.y,
    angle: spikeAngle,
    length: 20,
    width: 3,
    active: true,
    timer: 60,
    triggered: false,
  };
  
  police.spikeStrips.push(spikes);
  return spikes;
}

function updatePoliceUnit(unit, police, world, dt, config) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  if (!vehicle.active) {
    unit.active = false;
    return;
  }
  
  // Update unit state machine
  switch (unit.state) {
    case POLICE_STATES.RESPONDING:
      updateResponding(unit, police, world, dt);
      break;
    case POLICE_STATES.PURSUING:
      updatePursuing(unit, police, world, dt, config);
      break;
    case POLICE_STATES.SEARCHING:
      updateSearching(unit, police, world, dt);
      break;
    case POLICE_STATES.BLOCKADE:
      updateBlockade(unit, police, world, dt);
      break;
    case POLICE_STATES.ARRESTING:
      updateArresting(unit, police, world, dt);
      break;
  }
  
  // Shooting
  if (unit.state === POLICE_STATES.PURSUING || unit.state === POLICE_STATES.SEARCHING) {
    updatePoliceShooting(unit, police, world, dt, config);
  }
  
  // Update vehicle AI
  vehicle.aiThrottle = unit.aiThrottle || 0;
  vehicle.aiSteer = unit.aiSteer || 0;
  vehicle.aiBrake = unit.aiBrake || 0;
  vehicle.aiHandbrake = unit.aiHandbrake || false;
  
  updateVehicle(vehicle, dt, world);
}

function updateResponding(unit, police, world, dt) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  const dx = player.x - vehicle.x;
  const dy = player.y - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 100) {
    unit.state = POLICE_STATES.PURSUING;
  } else {
    // Drive to player
    unit.targetX = player.x;
    unit.targetY = player.y;
    vehicle.targetX = player.x;
    vehicle.targetY = player.y;
  }
}

function updatePursuing(unit, police, world, dt, config) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  const dx = player.x - vehicle.x;
  const dy = player.y - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Update last known position
  if (canPoliceSeePlayer(police, world, player)) {
    unit.lastKnownPlayerX = player.x;
    unit.lastKnownPlayerY = player.y;
  }
  
  // Pursuit behavior
  if (dist < 30 && police.wantedLevel >= 3) {
    // Close range - ram
    unit.aiSteer = normalizeAngle(Math.atan2(dy, dx) - vehicle.angle) * 4;
    unit.aiThrottle = 1;
    unit.aiHandbrake = Math.random() < 0.02;
  } else if (dist < 80) {
    // Medium range - pursue aggressively
    unit.aiSteer = normalizeAngle(Math.atan2(dy, dx) - vehicle.angle) * 3;
    unit.aiThrottle = 1;
  } else {
    // Far range - drive to last known position
    const lkdx = unit.lastKnownPlayerX - vehicle.x;
    const lkdy = unit.lastKnownPlayerY - vehicle.y;
    const lkdist = Math.sqrt(lkdx * lkdx + lkdy * lkdy);
    
    if (lkdist > 50) {
      unit.aiSteer = normalizeAngle(Math.atan2(lkdy, lkdx) - vehicle.angle) * 2;
      unit.aiThrottle = 0.8;
    } else {
      unit.state = POLICE_STATES.SEARCHING;
    }
  }
  
  // Avoid other police
  for (const other of police.units) {
    if (!other.active || other.id === unit.id) continue;
    const odx = other.vehicle.x - vehicle.x;
    const ody = other.vehicle.y - vehicle.y;
    const odistSq = odx * odx + ody * ody;
    if (odistSq < 40 * 40) {
      unit.aiSteer += (odx > 0 ? -0.5 : 0.5);
    }
  }
}

function updateSearching(unit, police, world, dt) {
  const vehicle = unit.vehicle;
  
  // Search around last known position
  const searchX = police.searchCenter.x + (Math.random() - 0.5) * police.searchRadius;
  const searchY = police.searchCenter.y + (Math.random() - 0.5) * police.searchRadius;
  
  const dx = searchX - vehicle.x;
  const dy = searchY - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 30) {
    unit.aiSteer = normalizeAngle(Math.atan2(dy, dx) - vehicle.angle) * 2;
    unit.aiThrottle = 0.6;
  } else {
    // Pick new search point
    unit.targetX = searchX;
    unit.targetY = searchY;
  }
  
  // Check if player spotted
  if (canPoliceSeePlayer(police, world, world.player)) {
    unit.state = POLICE_STATES.PURSUING;
  }
}

function updateBlockade(unit, police, world, dt) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  // Position to block player's path
  const aheadX = player.x + Math.cos(player.angle || 0) * 150;
  const aheadY = player.y + Math.sin(player.angle || 0) * 150;
  
  const dx = aheadX - vehicle.x;
  const dy = aheadY - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 20) {
    unit.aiSteer = normalizeAngle(Math.atan2(dy, dx) - vehicle.angle) * 2;
    unit.aiThrottle = 0.7;
  } else {
    unit.aiBrake = 1;
  }
}

function updateArresting(unit, police, world, dt) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  const dx = player.x - vehicle.x;
  const dy = player.y - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > ARREST_DISTANCE) {
    // Move to arrest position
    unit.aiSteer = normalizeAngle(Math.atan2(dy, dx) - vehicle.angle) * 3;
    unit.aiThrottle = 0.5;
  } else {
    unit.aiBrake = 1;
    // Arrest handled in checkArrest
  }
}

function updatePoliceShooting(unit, police, world, dt, config) {
  const vehicle = unit.vehicle;
  const player = world.player;
  
  unit.shootTimer -= dt;
  
  if (unit.shootTimer <= 0) {
    const dx = player.x - vehicle.x;
    const dy = player.y - vehicle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const shootRange = config.swat ? 150 : 100;
    if (dist < shootRange && Math.random() < unit.accuracy) {
      // Shoot at player
      player.health -= 8;
      world.camera.shake = 8;
      world.camera.shakeTime = 0.1;
      
      if (player.health <= 0) {
        player.wasted = true;
        player.wastedTimer = 5;
        world.screen = 'wasted';
      }
    }
    
    unit.shootTimer = config.swat ? 0.5 : 1.5;
  }
}

function updateHelicopter(heli, police, world, dt, config) {
  const player = world.player;
  
  // Orbit player
  const dx = player.x - heli.x;
  const dy = player.y - heli.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const orbitRadius = 150;
  const targetAngle = Math.atan2(dy, dx) + Math.PI / 2; // Orbit counter-clockwise
  const angleDiff = normalizeAngle(targetAngle - heli.angle);
  
  heli.angle += angleDiff * 0.5 * dt;
  heli.x += Math.cos(heli.angle) * heli.maxSpeed * 0.3 * dt;
  heli.y += Math.sin(heli.angle) * heli.maxSpeed * 0.3 * dt;
  
  // Spotlight
  heli.spotlightAngle = Math.atan2(dy, dx);
  
  // Gunner shooting
  heli.gunner.shootTimer -= dt;
  if (heli.gunner.shootTimer <= 0 && dist < 200) {
    if (Math.random() < heli.gunner.accuracy) {
      player.health -= 12;
      world.camera.shake = 10;
      world.camera.shakeTime = 0.15;
      
      if (player.health <= 0) {
        player.wasted = true;
        player.wastedTimer = 5;
        world.screen = 'wasted';
      }
    }
    heli.gunner.shootTimer = 2;
  }
  
  // Altitude
  heli.z = lerp(heli.z, heli.targetZ, 0.1);
  
  // Damage
  if (heli.health <= 0) {
    heli.active = false;
    // Crash effect
    world.effects = world.effects || [];
    world.effects.push({
      type: 'heli_crash',
      x: heli.x,
      y: heli.y,
      timer: 0,
      duration: 2,
    });
  }
}

function updateRoadblock(block, police, world, dt) {
  block.timer -= dt;
  if (block.timer <= 0) {
    block.active = false;
    for (const v of block.vehicles) {
      v.active = false;
    }
  }
  
  // Check if player hits roadblock
  const player = world.player;
  for (const v of block.vehicles) {
    if (!v.active) continue;
    const dx = player.x - v.x;
    const dy = player.y - v.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < v.width) {
      // Crash!
      player.health -= 30;
      world.camera.shake = 25;
      world.camera.shakeTime = 0.5;
      if (player.inVehicle) {
        player.vehicle.health -= 100;
      }
    }
  }
}

function updateSpikeStrip(spikes, world, dt) {
  spikes.timer -= dt;
  if (spikes.timer <= 0) {
    spikes.active = false;
    return;
  }
  
  // Check vehicles
  for (const vehicle of world.vehicles) {
    if (!vehicle.active) continue;
    
    const dx = vehicle.x - spikes.x;
    const dy = vehicle.y - spikes.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Project onto spike strip line
    const cos = Math.cos(-spikes.angle);
    const sin = Math.sin(-spikes.angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    
    if (Math.abs(localX) < spikes.length / 2 && Math.abs(localY) < spikes.width / 2) {
      if (!spikes.triggered) {
        spikes.triggered = true;
        // Pop tires
        vehicle.tiresPopped = true;
        vehicle.maxSpeed *= 0.3;
        vehicle.turnSpeed *= 0.5;
        vehicle.driftFactor *= 2;
      }
    }
  }
}

function checkArrest(police, player, dt) {
  if (police.wantedLevel === WANTED_NONE) return;
  
  // Check if any officer can arrest
  for (const unit of police.units) {
    if (!unit.active || !unit.vehicle.active) continue;
    
    const dx = player.x - unit.vehicle.x;
    const dy = player.y - unit.vehicle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < ARREST_DISTANCE && !player.inVehicle) {
      // Attempt arrest
      police.arrestProgress += dt / ARREST_TIME;
      police.arrestingOfficer = unit;
      
      if (police.arrestProgress >= 1) {
        onBusted(world);
        return;
      }
    } else {
      police.arrestProgress = 0;
      police.arrestingOfficer = null;
    }
  }
  
  // Also check officers on foot
  for (const unit of police.units) {
    if (!unit.active) continue;
    for (const officer of unit.officers) {
      if (officer.state === 'dead') continue;
      // Officer position approximated at vehicle
      const dx = player.x - unit.vehicle.x;
      const dy = player.y - unit.vehicle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < ARREST_DISTANCE && !player.inVehicle) {
        police.arrestProgress += dt / ARREST_TIME;
        if (police.arrestProgress >= 1) {
          onBusted(world);
          return;
        }
      }
    }
  }
}

function onBusted(world) {
  const player = world.player;
  police.busted = true;
  police.bustedTimer = 3;
  police.stats.timesArrested++;
  
  // Penalty
  player.money = Math.floor(player.money * 0.5);
  player.health = PLAYER.maxHealth;
  player.armor = 0;
  player.wantedLevel = WANTED_NONE;
  player.wantedStars = 0;
  player.inVehicle = false;
  player.vehicleId = -1;
  
  // Respawn at police station
  const stations = [
    { x: 10 * WORLD.sectorSize, y: 10 * WORLD.sectorSize },
    { x: 26 * WORLD.sectorSize, y: 8 * WORLD.sectorSize },
  ];
  const station = stations[Math.floor(Math.random() * stations.length)];
  const pos = findRoadPosition(world, station.x, station.y, 100);
  player.x = pos.x;
  player.y = pos.y;
  
  world.camera.x = player.x;
  world.camera.y = player.y;
  world.camera.targetX = player.x;
  world.camera.targetY = player.y;
  
  world.screen = 'busted';
  world.addMessage('BUSTED! Lost $' + Math.floor(player.money * 0.5), 4000);
}

export function addWanted(police, amount, crimeType = 'generic') {
  const oldLevel = police.wantedLevel;
  police.wantedLevel = clamp(police.wantedLevel + amount, WANTED_NONE, WANTED_FIVE);
  
  if (police.wantedLevel !== oldLevel) {
    police.lastCrimeTime = 0;
    police.lastSeenPosition.x = world.player.x;
    police.lastSeenPosition.y = world.player.y;
    police.isSearching = false;
    police.searchTimer = 0;
    
    // Update stats
    police.stats.crimesCommitted++;
    if (crimeType === 'vehicle_theft') police.stats.vehiclesStolen++;
    if (crimeType === 'murder') police.stats.pedsKilled++;
    if (crimeType === 'cop_kill') police.stats.copsKilled++;
  }
  
  return police.wantedLevel;
}

export function setWantedLevel(police, level) {
  police.wantedLevel = clamp(level, WANTED_NONE, WANTED_FIVE);
  police.wantedStars = police.wantedLevel;
  police.wantedDecay = 0;
  
  if (police.wantedLevel === WANTED_NONE) {
    police.isSearching = false;
    police.searchTimer = 0;
    police.lastSeenPosition = { x: 0, y: 0 };
    police.lastSeenTime = 0;
  }
}

export function clearWanted(police) {
  setWantedLevel(police, WANTED_NONE);
  police.lastSeenPosition = { x: 0, y: 0 };
  police.lastSeenTime = 0;
}

export function onPlayerDeath(police) {
  // Player wasted - clear wanted level
  clearWanted(police);
}

export function onPlayerArrested(police) {
  police.stats.timesArrested++;
  clearWanted(police);
}

export function onPlayerEscaped(police) {
  police.stats.timesEscaped++;
  clearWanted(police);
}

export function getWantedConfig(level) {
  return WANTED_CONFIG[level] || WANTED_CONFIG[WANTED_NONE];
}

export function getPoliceUnitCount(police) {
  return police.units.filter(u => u.active).length;
}

export function getActiveHelicopterCount(police) {
  return police.helicopters.filter(h => h.active).length;
}

export function getActiveRoadblockCount(police) {
  return police.roadblocks.filter(r => r.active).length;
}

export function getActiveSpikeStripCount(police) {
  return police.spikeStrips.filter(s => s.active).length;
}

export function renderPoliceMinimap(police, ctx, minimap) {
  // Render police units on minimap
  for (const unit of police.units) {
    if (!unit.active || !unit.vehicle.active) continue;
    const mx = minimap.x + unit.vehicle.x * minimap.zoom;
    const my = minimap.y + unit.vehicle.y * minimap.zoom;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Helicopters
  for (const heli of police.helicopters) {
    if (!heli.active) continue;
    const mx = minimap.x + heli.x * minimap.zoom;
    const my = minimap.y + heli.y * minimap.zoom;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Roadblocks
  for (const block of police.roadblocks) {
    if (!block.active) continue;
    const mx = minimap.x + block.x * minimap.zoom;
    const my = minimap.y + block.y * minimap.zoom;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / minimap.zoom;
    ctx.beginPath();
    ctx.moveTo(mx - 10 / minimap.zoom, my);
    ctx.lineTo(mx + 10 / minimap.zoom, my);
    ctx.stroke();
  }
  
  // Spike strips
  for (const spikes of police.spikeStrips) {
    if (!spikes.active) continue;
    const mx = minimap.x + spikes.x * minimap.zoom;
    const my = minimap.y + spikes.y * minimap.zoom;
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(mx - 5 / minimap.zoom, my - 2 / minimap.zoom, 10 / minimap.zoom, 4 / minimap.zoom);
  }
}