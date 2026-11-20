// Vehicle System - Player cars, NPC traffic, physics, and handling.
// Provides vehicle creation, physics simulation, AI behavior, collision detection,
// damage effects, and wheel animation for all vehicle types including cars,
// motorcycles, trucks, and police vehicles. All physics parameters are configured
// through VEH_CONFIGS for easy tuning and balance.
import { VEHICLE, WORLD, ROAD_NETWORK, PALETTE } from './config.js';
import { distance, distanceSq, angleTo, normalizeAngle, clamp, lerp, isOnRoad, getRoadDirection, findRoadPosition } from './world.js';

export const VEH_TYPE_CAR = 0;
export const VEH_TYPE_MOTORCYCLE = 1;
export const VEH_TYPE_TRUCK = 2;
export const VEH_TYPE_POLICE = 3;
export const VEH_TYPE_BOAT = 4;
export const VEH_TYPE_HELI = 5;

export const VEHICLE_STATES = {
  PARKED: 'parked',
  DRIVING: 'driving',
  PURSUING: 'pursuing',
  FLEEING: 'fleeing',
  BLOCKADE: 'blockade',
  CRASHED: 'crashed',
  EXPLODING: 'exploding',
};

const VEH_CONFIGS = {
  [VEH_TYPE_CAR]: VEHICLE.car,
  [VEH_TYPE_MOTORCYCLE]: VEHICLE.motorcycle,
  [VEH_TYPE_TRUCK]: VEHICLE.truck,
  [VEH_TYPE_POLICE]: VEHICLE.police,
  [VEH_TYPE_BOAT]: {
    width: 30, length: 80, maxSpeed: 180, acceleration: 200, brakeForce: 150,
    turnSpeed: 1.5, driftFactor: 0.4, mass: 2000, health: 400, maxHealth: 400,
  },
  [VEH_TYPE_HELI]: {
    width: 20, length: 20, maxSpeed: 300, acceleration: 400, brakeForce: 300,
    turnSpeed: 3, driftFactor: 0, mass: 1500, health: 500, maxHealth: 500,
  },
};

const CAR_COLORS = PALETTE.carColors;

export function createVehicle(type, x, y, angle, options = {}) {
  const config = VEH_CONFIGS[type] || VEH_CONFIGS[VEH_TYPE_CAR];
  const color = options.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  
  return {
    id: -1,
    type,
    x, y,
    angle: angle || 0,
    speed: 0,
    velocityX: 0, velocityY: 0,
    angularVelocity: 0,
    width: config.width,
    length: config.length,
    maxSpeed: config.maxSpeed * (options.speedMult || 1),
    acceleration: config.acceleration,
    brakeForce: config.brakeForce,
    turnSpeed: config.turnSpeed,
    driftFactor: config.driftFactor,
    mass: config.mass,
    health: config.maxHealth,
    maxHealth: config.maxHealth,
    driver: options.driver || null,
    passengers: [],
    isPolice: type === VEH_TYPE_POLICE,
    state: options.state || VEHICLE_STATES.PARKED,
    targetX: 0, targetY: 0,
    path: [],
    pathIndex: 0,
    lane: options.lane || 0,
    laneOffset: options.laneOffset || 0,
    siren: false,
    stuckTimer: 0,
    lastRoadX: x, lastRoadY: y,
    color,
    // Visual
    bodyColor: color,
    roofColor: darkenColor(color, 0.3),
    wheelColor: '#1a1a1a',
    windowColor: '#1a1a2e',
    // Lights
    headlights: false,
    brakeLights: false,
    reverseLights: false,
    // Damage
    damageParts: [],
    smokeLevel: 0,
    fireLevel: 0,
    // Audio (placeholder)
    enginePitch: 1,
    // Physics
    onGround: true,
    wheelAngles: [0, 0, 0, 0], // FL, FR, RL, RR
    suspension: [0, 0, 0, 0],
    // AI
    aiPersonality: options.aiPersonality || 'normal', // normal, aggressive, cautious, reckless
    targetSpeed: 0,
    followDistance: 40,
    changeLaneTimer: 0,
    currentLane: 0,
  };
}

function darkenColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - amount));
  const b = Math.max(0, (num & 255) * (1 - amount));
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

export function updateVehicle(vehicle, dt, world, input = null) {
  if (!vehicle.active) return;
  
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  const isPlayer = input !== null;
  
  // Handle controls
  let throttle = 0, steer = 0, brake = 0, handbrake = false;
  
  if (isPlayer) {
    throttle = input.up ? 1 : (input.down ? -1 : 0);
    steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    brake = input.down && !input.up ? 1 : 0;
    handbrake = input.action; // Space for handbrake
    vehicle.headlights = input.lights || false;
  } else {
    // AI control
    updateVehicleAI(vehicle, dt, world);
    throttle = vehicle.aiThrottle || 0;
    steer = vehicle.aiSteer || 0;
    brake = vehicle.aiBrake || 0;
    handbrake = vehicle.aiHandbrake || false;
  }
  
  vehicle.brakeLights = brake > 0 || (throttle < 0 && vehicle.speed > 0);
  vehicle.reverseLights = throttle < 0 && vehicle.speed <= 0;
  
  // Physics
  applyVehiclePhysics(vehicle, dt, throttle, steer, brake, handbrake, config);
  
  // Collision detection
  checkVehicleCollisions(vehicle, world);
  
  // Update position
  vehicle.x += vehicle.velocityX * dt;
  vehicle.y += vehicle.velocityY * dt;
  
  // World bounds
  vehicle.x = clamp(vehicle.x, vehicle.width / 2, WORLD.width - vehicle.width / 2);
  vehicle.y = clamp(vehicle.y, vehicle.length / 2, WORLD.height - vehicle.length / 2);
  
  // Wheel animation
  updateWheels(vehicle, dt);
  
  // Damage effects
  updateDamageEffects(vehicle, dt);
  
  // Engine sound pitch
  vehicle.enginePitch = 0.5 + Math.abs(vehicle.speed) / vehicle.maxSpeed * 1.5;
}

function applyVehiclePhysics(v, dt, throttle, steer, brake, handbrake, config) {
  // Forward/backward acceleration
  if (throttle !== 0) {
    const accel = config.acceleration * throttle * dt;
    const maxForward = config.maxSpeed;
    const maxReverse = config.maxSpeed * 0.3;
    v.speed = clamp(v.speed + accel, -maxReverse, maxForward);
  }
  
  // Braking
  if (brake > 0) {
    const brakeForce = config.brakeForce * dt;
    if (v.speed > 0) v.speed = Math.max(0, v.speed - brakeForce);
    else if (v.speed < 0) v.speed = Math.min(0, v.speed + brakeForce);
  } else if (throttle === 0) {
    // Natural deceleration (rolling resistance)
    const drag = 80 * dt;
    if (v.speed > 0) v.speed = Math.max(0, v.speed - drag);
    else if (v.speed < 0) v.speed = Math.min(0, v.speed + drag);
  }
  
  // Steering (only works when moving)
  if (Math.abs(v.speed) > 5) {
    const speedFactor = Math.min(1, Math.abs(v.speed) / (config.maxSpeed * 0.3));
    const steerRate = config.turnSpeed * speedFactor * steer * dt;
    v.angle += steerRate;
    
    // Drift/handbrake
    if (handbrake && Math.abs(v.speed) > 30) {
      v.angularVelocity += steer * config.driftFactor * 8 * dt;
      v.speed *= 0.98; // Slow down during drift
    }
  }
  
  v.angle += v.angularVelocity * dt;
  v.angularVelocity *= 0.92; // Angular damping
  
  // Velocity from speed and angle
  v.velocityX = Math.cos(v.angle) * v.speed;
  v.velocityY = Math.sin(v.angle) * v.speed;
  
  // Off-road penalty
  if (!isOnRoad({ width: WORLD.width, height: WORLD.height }, v.x, v.y)) {
    v.speed *= 0.995; // Gradual slowdown off-road
  }
}

function updateVehicleAI(vehicle, dt, world) {
  const player = world.player;
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  
  vehicle.aiThrottle = 0;
  vehicle.aiSteer = 0;
  vehicle.aiBrake = 0;
  vehicle.aiHandbrake = false;
  
  switch (vehicle.state) {
    case VEHICLE_STATES.PARKED:
      vehicle.aiThrottle = 0;
      vehicle.aiBrake = 1;
      break;
      
    case VEHICLE_STATES.DRIVING:
      updateTrafficAI(vehicle, dt, world);
      break;
      
    case VEHICLE_STATES.PURSUING:
      updatePursuitAI(vehicle, dt, world, player);
      break;
      
    case VEHICLE_STATES.FLEEING:
      updateFleeAI(vehicle, dt, world, player);
      break;
      
    case VEHICLE_STATES.BLOCKADE:
      updateBlockadeAI(vehicle, dt, world, player);
      break;
  }
  
  // Personality modifiers
  switch (vehicle.aiPersonality) {
    case 'aggressive':
      vehicle.targetSpeed *= 1.2;
      vehicle.followDistance *= 0.7;
      break;
    case 'cautious':
      vehicle.targetSpeed *= 0.8;
      vehicle.followDistance *= 1.5;
      break;
    case 'reckless':
      vehicle.targetSpeed *= 1.4;
      vehicle.followDistance *= 0.5;
      break;
  }
}

function updateTrafficAI(vehicle, dt, world) {
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  
  // Find road direction
  const roadDir = getRoadDirection({ width: WORLD.width, height: WORLD.height }, vehicle.x, vehicle.y);
  
  if (roadDir !== -1) {
    vehicle.lastRoadX = vehicle.x;
    vehicle.lastRoadY = vehicle.y;
    vehicle.stuckTimer = 0;
    
    // Determine target speed based on road type
    let baseSpeed = config.maxSpeed * 0.7;
    if (vehicle.type === VEH_TYPE_TRUCK) baseSpeed *= 0.7;
    if (vehicle.type === VEH_TYPE_MOTORCYCLE) baseSpeed *= 1.1;
    vehicle.targetSpeed = baseSpeed * (0.85 + Math.random() * 0.3);
    
    // Target angle based on road
    let targetAngle;
    if (roadDir === 0) { // N/S
      targetAngle = vehicle.velocityY >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else { // E/W
      targetAngle = vehicle.velocityX >= 0 ? 0 : Math.PI;
    }
    
    // Steer towards target angle
    const angleDiff = normalizeAngle(targetAngle - vehicle.angle);
    vehicle.aiSteer = clamp(angleDiff * 3, -1, 1);
    
    // Throttle/brake to reach target speed
    if (vehicle.speed < vehicle.targetSpeed) {
      vehicle.aiThrottle = 0.8;
    } else if (vehicle.speed > vehicle.targetSpeed * 1.1) {
      vehicle.aiBrake = 0.5;
    }
    
    // Lane keeping
    vehicle.changeLaneTimer -= dt;
    if (vehicle.changeLaneTimer <= 0 && Math.random() < 0.002) {
      vehicle.changeLaneTimer = 5 + Math.random() * 10;
      // Check if lane change is safe
      if (canChangeLane(vehicle, world)) {
        vehicle.currentLane = vehicle.currentLane === 0 ? 1 : 0;
      }
    }
    
    // Avoid obstacles
    avoidObstacles(vehicle, world);
    
  } else {
    // Off road - try to get back
    vehicle.stuckTimer += dt;
    if (vehicle.stuckTimer > 3) {
      const pos = findRoadPosition({ width: WORLD.width, height: WORLD.height }, vehicle.x, vehicle.y, 150);
      if (pos.found) {
        vehicle.x = pos.x;
        vehicle.y = pos.y;
        vehicle.angle = getRoadDirection({ width: WORLD.width, height: WORLD.height }, pos.x, pos.y) === 0 
          ? (Math.random() > 0.5 ? 0 : Math.PI) 
          : (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
        vehicle.speed = 0;
        vehicle.stuckTimer = 0;
      }
    } else {
      vehicle.aiBrake = 0.3;
    }
  }
  
  // Avoid player
  const pdx = world.player.x - vehicle.x;
  const pdy = world.player.y - vehicle.y;
  const pdistSq = pdx * pdx + pdy * pdy;
  if (pdistSq < 2500) { // 50 units
    const pdist = Math.sqrt(pdistSq);
    if (pdist > 0) {
      vehicle.x -= (pdx / pdist) * 3;
      vehicle.y -= (pdy / pdist) * 3;
      vehicle.aiBrake = 1;
    }
  }
}

function updatePursuitAI(vehicle, dt, world, player) {
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  
  const dx = player.x - vehicle.x;
  const dy = player.y - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Target angle towards player
  const targetAngle = Math.atan2(dy, dx);
  const angleDiff = normalizeAngle(targetAngle - vehicle.angle);
  vehicle.aiSteer = clamp(angleDiff * 4, -1, 1);
  
  // Speed based on wanted level
  const pursuitMult = 1 + world.player.wantedLevel * 0.15;
  vehicle.targetSpeed = config.maxSpeed * pursuitMult;
  
  if (vehicle.speed < vehicle.targetSpeed) {
    vehicle.aiThrottle = 1;
  }
  
  // Tactical behavior based on wanted level
  if (world.player.wantedLevel >= 4 && dist < 40) {
    // PIT maneuver attempt
    vehicle.aiHandbrake = Math.random() < 0.02;
  }
  
  // Avoid other police
  for (const other of world.vehicles) {
    if (!other.active || other.id === vehicle.id || !other.isPolice) continue;
    const odx = other.x - vehicle.x;
    const ody = other.y - vehicle.y;
    const odistSq = odx * odx + ody * ody;
    if (odistSq < 1600 && odistSq > 0.1) { // 40 units
      const odist = Math.sqrt(odistSq);
      vehicle.aiSteer += (odx / odist) * 0.5;
    }
  }
}

function updateFleeAI(vehicle, dt, world, player) {
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  
  const dx = vehicle.x - player.x;
  const dy = vehicle.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Flee directly away
  const targetAngle = Math.atan2(dy, dx);
  const angleDiff = normalizeAngle(targetAngle - vehicle.angle);
  vehicle.aiSteer = clamp(angleDiff * 3, -1, 1);
  
  vehicle.targetSpeed = config.maxSpeed;
  if (vehicle.speed < vehicle.targetSpeed) {
    vehicle.aiThrottle = 1;
  }
  
  // Try to stay on roads
  const roadDir = getRoadDirection({ width: WORLD.width, height: WORLD.height }, vehicle.x, vehicle.y);
  if (roadDir === -1) {
    const pos = findRoadPosition({ width: WORLD.width, height: WORLD.height }, vehicle.x, vehicle.y, 200);
    if (pos.found) {
      vehicle.aiSteer += normalizeAngle(Math.atan2(pos.y - vehicle.y, pos.x - vehicle.x) - vehicle.angle) * 2;
    }
  }
}

function updateBlockadeAI(vehicle, dt, world, player) {
  // Position ahead of player
  const aheadX = player.x + Math.cos(player.angle) * 120;
  const aheadY = player.y + Math.sin(player.angle) * 120;
  
  const dx = aheadX - vehicle.x;
  const dy = aheadY - vehicle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 30) {
    const targetAngle = Math.atan2(dy, dx);
    const angleDiff = normalizeAngle(targetAngle - vehicle.angle);
    vehicle.aiSteer = clamp(angleDiff * 3, -1, 1);
    vehicle.targetSpeed = 200;
    if (vehicle.speed < vehicle.targetSpeed) vehicle.aiThrottle = 0.8;
  } else {
    vehicle.aiBrake = 1;
    vehicle.targetSpeed = 0;
  }
}

function canChangeLane(vehicle, world) {
  // Simplified - check if adjacent lane is clear
  const checkDist = 60;
  const checkAngle = vehicle.angle + Math.PI / 2;
  const checkX = vehicle.x + Math.cos(checkAngle) * ROAD_NETWORK.laneOffset;
  const checkY = vehicle.y + Math.sin(checkAngle) * ROAD_NETWORK.laneOffset;
  
  for (const other of world.vehicles) {
    if (!other.active || other.id === vehicle.id) continue;
    const dx = other.x - checkX;
    const dy = other.y - checkY;
    if (dx * dx + dy * dy < checkDist * checkDist) return false;
  }
  return true;
}

function avoidObstacles(vehicle, world) {
  const lookAhead = 50 + Math.abs(vehicle.speed) * 0.1;
  const checkX = vehicle.x + Math.cos(vehicle.angle) * lookAhead;
  const checkY = vehicle.y + Math.sin(vehicle.angle) * lookAhead;
  
  for (const other of world.vehicles) {
    if (!other.active || other.id === vehicle.id) continue;
    const dx = other.x - checkX;
    const dy = other.y - checkY;
    const distSq = dx * dx + dy * dy;
    if (distSq < 30 * 30) {
      // Brake and steer around
      vehicle.aiBrake = 1;
      vehicle.aiSteer += (dx > 0 ? -0.5 : 0.5);
    }
  }
  
  // Check peds
  for (const ped of world.peds) {
    if (!ped.active || ped.state === 'dead') continue;
    const dx = ped.x - checkX;
    const dy = ped.y - checkY;
    if (dx * dx + dy * dy < 20 * 20) {
      vehicle.aiBrake = 1;
    }
  }
}

function checkVehicleCollisions(vehicle, world) {
  for (const other of world.vehicles) {
    if (!other.active || other.id === vehicle.id) continue;
    if (checkVehicleVehicleCollision(vehicle, other)) {
      resolveVehicleCollision(vehicle, other);
    }
  }
}

function checkVehicleVehicleCollision(v1, v2) {
  // OBB collision simplified to AABB with rotation consideration
  const hw1 = v1.width / 2, hl1 = v1.length / 2;
  const hw2 = v2.width / 2, hl2 = v2.length / 2;
  
  // Quick distance check
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const maxRadius = Math.max(hw1 + hw2, hl1 + hl2);
  if (dx * dx + dy * dy > maxRadius * maxRadius) return false;
  
  // More accurate: project onto axes
  const cos1 = Math.cos(v1.angle), sin1 = Math.sin(v1.angle);
  const cos2 = Math.cos(v2.angle), sin2 = Math.sin(v2.angle);
  
  // Simplified: just use AABB in world space with inflated bounds
  return Math.abs(dx) < hw1 + hw2 + 5 && Math.abs(dy) < hl1 + hl2 + 5;
}

function resolveVehicleCollision(v1, v2) {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  
  const minDist = (v1.width + v2.width) * 0.5;
  const overlap = minDist - dist;
  
  if (overlap > 0) {
    const pushX = (dx / dist) * overlap * 0.5;
    const pushY = (dy / dist) * overlap * 0.5;
    
    v1.x -= pushX;
    v1.y -= pushY;
    v2.x += pushX;
    v2.y += pushY;
  }
  
  // Momentum transfer
  const totalMass = v1.mass + v2.mass;
  const v1x = v1.velocityX, v1y = v1.velocityY;
  const v2x = v2.velocityX, v2y = v2.velocityY;
  
  // Elastic collision
  v1.velocityX = (v1x * (v1.mass - v2.mass) + 2 * v2.mass * v2x) / totalMass;
  v1.velocityY = (v1y * (v1.mass - v2.mass) + 2 * v2.mass * v2y) / totalMass;
  v2.velocityX = (v2x * (v2.mass - v1.mass) + 2 * v1.mass * v1x) / totalMass;
  v2.velocityY = (v2y * (v2.mass - v1.mass) + 2 * v1.mass * v1y) / totalMass;
  
  // Damage based on impact speed
  const impactSpeed = Math.sqrt((v1x - v2x) ** 2 + (v1y - v2y) ** 2);
  const damage = impactSpeed * 0.15;
  v1.health -= damage;
  v2.health -= damage;
  
  // Visual damage
  addVehicleDamage(v1, damage);
  addVehicleDamage(v2, damage);
}

function addVehicleDamage(vehicle, damage) {
  if (damage < 10) return;
  
  vehicle.damageParts.push({
    x: (Math.random() - 0.5) * vehicle.width,
    y: (Math.random() - 0.5) * vehicle.length,
    size: 5 + damage * 0.1,
    type: damage > 30 ? 'dent' : 'scratch',
  });
  
  if (vehicle.health < vehicle.maxHealth * 0.6) {
    vehicle.smokeLevel = Math.min(1, vehicle.smokeLevel + 0.1);
  }
  if (vehicle.health < vehicle.maxHealth * 0.3) {
    vehicle.fireLevel = Math.min(1, vehicle.fireLevel + 0.05);
  }
}

function updateWheels(vehicle, dt) {
  vehicle.wheelAngles = vehicle.wheelAngles || [0, 0, 0, 0];
  vehicle.suspension = vehicle.suspension || [0, 0, 0, 0];
  const wheelSpeed = vehicle.speed / 30; // Visual rotation speed
  for (let i = 0; i < 4; i++) {
    vehicle.wheelAngles[i] += wheelSpeed * dt * 60;
  }
  
  // Suspension (simplified)
  const targetSuspension = 0; // Would calculate from terrain
  for (let i = 0; i < 4; i++) {
    vehicle.suspension[i] = lerp(vehicle.suspension[i], targetSuspension, 0.2);
  }
}

function updateDamageEffects(vehicle, dt) {
  if (vehicle.smokeLevel > 0) {
    vehicle.smokeLevel = Math.max(0, vehicle.smokeLevel - dt * 0.1);
  }
  if (vehicle.fireLevel > 0) {
    vehicle.fireLevel = Math.min(1, vehicle.fireLevel + dt * 0.2);
    if (vehicle.fireLevel > 0.8) {
      vehicle.health -= dt * 20;
    }
  }
}

export function explodeVehicle(vehicle, world) {
  // Create explosion effect
  world.effects = world.effects || [];
  world.effects.push({
    type: 'explosion',
    x: vehicle.x,
    y: vehicle.y,
    radius: 0,
    maxRadius: 60,
    timer: 0,
    duration: 0.8,
  });
  
  // Damage nearby entities
  for (const other of world.vehicles) {
    if (!other.active || other.id === vehicle.id) continue;
    const dx = other.x - vehicle.x;
    const dy = other.y - vehicle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 80) {
      other.health -= (1 - dist / 80) * 200;
    }
  }
  
  for (const ped of world.peds) {
    if (!ped.active || ped.state === 'dead') continue;
    const dx = ped.x - vehicle.x;
    const dy = ped.y - vehicle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 60) {
      ped.health -= (1 - dist / 60) * 150;
      if (ped.health <= 0) ped.state = 'dead';
    }
  }
  
  // Camera shake
  world.camera.shake = 40;
  world.camera.shakeTime = 1;
  
  vehicle.active = false;
  vehicle.state = VEHICLE_STATES.EXPLODING;
}

export function getVehicleCorners(vehicle) {
  const hw = vehicle.width / 2;
  const hl = vehicle.length / 2;
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  
  return [
    { x: vehicle.x + cos * -hl + sin * -hw, y: vehicle.y + sin * -hl - cos * -hw }, // FL
    { x: vehicle.x + cos * -hl + sin * hw, y: vehicle.y + sin * -hl - cos * hw },  // FR
    { x: vehicle.x + cos * hl + sin * hw, y: vehicle.y + sin * hl - cos * hw },    // RR
    { x: vehicle.x + cos * hl + sin * -hw, y: vehicle.y + sin * hl - cos * -hw },  // RL
  ];
}

export function getVehicleBounds(vehicle) {
  const corners = getVehicleCorners(vehicle);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function isPointInVehicle(vehicle, x, y) {
  // Transform point to vehicle local space
  const dx = x - vehicle.x;
  const dy = y - vehicle.y;
  const cos = Math.cos(-vehicle.angle);
  const sin = Math.sin(-vehicle.angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  
  return Math.abs(localX) < vehicle.width / 2 && Math.abs(localY) < vehicle.length / 2;
}

export function getVehicleSpeed(vehicle) {
  return Math.abs(vehicle.speed);
}

export function getVehicleInfo(vehicle) {
  const config = VEH_CONFIGS[vehicle.type] || VEH_CONFIGS[VEH_TYPE_CAR];
  return {
    type: vehicle.type,
    state: vehicle.state,
    speed: vehicle.speed,
    maxSpeed: config.maxSpeed,
    health: vehicle.health,
    maxHealth: config.maxHealth,
    isPolice: vehicle.isPolice,
    siren: vehicle.siren,
  };
}

export function getVehicleGear(vehicle) {
  // Simplified gear calculation
  if (vehicle.speed <= 0) return vehicle.speed < 0 ? 'R' : 'N';
  const gears = 5;
  const gear = Math.min(gears, Math.floor(vehicle.speed / (vehicle.maxSpeed / gears)) + 1);
  return gear;
}

export function createTrafficVehicle(world, nearX, nearY) {
  const types = [VEH_TYPE_CAR, VEH_TYPE_CAR, VEH_TYPE_CAR, VEH_TYPE_MOTORCYCLE, VEH_TYPE_TRUCK];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const pos = findRoadPosition(world, nearX, nearY, 300);
  if (!pos.found) return null;
  
  const roadDir = getRoadDirection(world, pos.x, pos.y);
  const angle = roadDir === 0 
    ? (Math.random() > 0.5 ? 0 : Math.PI) 
    : (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
  
  const vehicle = createVehicle(type, pos.x, pos.y, angle, {
    state: VEHICLE_STATES.DRIVING,
    aiPersonality: ['normal', 'normal', 'normal', 'cautious', 'aggressive'][Math.floor(Math.random() * 5)],
    lane: Math.floor(Math.random() * 2),
  });
  
  return vehicle;
}

export function createPoliceVehicle(world, nearX, nearY, wantedLevel) {
  const pos = findRoadPosition(world, nearX, nearY, 400);
  if (!pos.found) return null;
  
  const angle = Math.atan2(world.player.y - pos.y, world.player.x - pos.x);
  
  const vehicle = createVehicle(VEH_TYPE_POLICE, pos.x, pos.y, angle, {
    state: VEHICLE_STATES.PURSUING,
    aiPersonality: 'aggressive',
    speedMult: 1 + wantedLevel * 0.1,
  });
  
  vehicle.siren = true;
  return vehicle;
}

export function spawnVehicleAtRoad(world, type, sectorX, sectorY) {
  const x = sectorX * WORLD.sectorSize + WORLD.sectorSize / 2;
  const y = sectorY * WORLD.sectorSize + WORLD.sectorSize / 2;
  const pos = findRoadPosition(world, x, y, 100);
  if (!pos.found) return null;
  
  const roadDir = getRoadDirection(world, pos.x, pos.y);
  const angle = roadDir === 0 
    ? (Math.random() > 0.5 ? 0 : Math.PI) 
    : (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
  
  return createVehicle(type, pos.x, pos.y, angle, { state: VEHICLE_STATES.DRIVING });
}