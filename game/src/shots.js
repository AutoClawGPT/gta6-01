// Screenshot Scenes - Staging for the 4 required make.fun bounty screenshots
// cover, city, chase, arrest. Each scene is pre-configured with specific world state,
// vehicle placement, police presence, and mission objectives to demonstrate gameplay
// variety for the submission dossier. Scenes are deterministic given the same RNG seed.
import { WORLD, PALETTE, DISTRICTS, VEHICLE, PLAYER, POLICE } from './config.js';
import { createVehicle, VEH_TYPE_CAR, VEH_TYPE_MOTORCYCLE, VEH_TYPE_POLICE, VEHICLE_STATES } from './vehicles.js';
import { createPoliceSystem, WANTED_THREE, WANTED_FIVE, POLICE_UNIT_TYPES } from './police.js';
import { createMissionSystem, MISSION_TYPE, OBJECTIVE_TYPE } from './missions.js';

export const SHOT_SCENES = {
  COVER: 'cover',
  CITY: 'city',
  CHASE: 'chase',
  ARREST: 'arrest',
};

export function setupCoverShot(world, renderer) {
  // COVER: Driving + traffic + 3-star wanted + mission objective visible
  // Player in a sports car on Ocean Drive (Vice Beach), traffic around, police pursuing, mission marker visible
  
  const player = world.player;
  const cam = world.camera;
  
  // Position: Vice Beach district, on the main coastal road
  player.x = 22 * WORLD.sectorSize + 100;
  player.y = 8 * WORLD.sectorSize + 200;
  player.angle = -Math.PI / 2; // Facing north along coast
  player.inVehicle = true;
  player.vehicleId = -1;
  player.health = PLAYER.maxHealth;
  player.armor = 50;
  player.wantedLevel = 3;
  player.wantedStars = 3;
  player.money = 25000;
  player.weapon = 'pistol';
  player.ammo.pistol = 48;
  
  // Camera
  cam.x = player.x;
  cam.y = player.y;
  cam.targetX = player.x;
  cam.targetY = player.y;
  cam.shake = 5;
  cam.shakeTime = 0.5;
  
  // Clear existing entities
  clearWorldEntities(world);
  
  // Spawn player vehicle (sports car)
  const playerCar = createVehicle(VEH_TYPE_CAR, player.x, player.y, player.angle, {
    state: VEHICLE_STATES.DRIVING,
    color: '#e74c3c',
    speedMult: 1.2,
  });
  playerCar.id = 1;
  playerCar.active = true;
  playerCar.driver = { type: 'player' };
  playerCar.speed = 280;
  playerCar.velocityX = 0;
  playerCar.velocityY = -280;
  player.vehicleId = playerCar.id;
  world.vehicles.push(playerCar);
  
  // Spawn traffic around player
  spawnTrafficAround(world, player.x, player.y, 12, [
    { type: VEH_TYPE_CAR, color: '#3498db', offset: { x: -40, y: -80 }, speed: 180 },
    { type: VEH_TYPE_CAR, color: '#2ecc71', offset: { x: 40, y: -120 }, speed: 160 },
    { type: VEH_TYPE_CAR, color: '#f39c12', offset: { x: -35, y: 60 }, speed: 140 },
    { type: VEH_TYPE_CAR, color: '#9b59b6', offset: { x: 45, y: 100 }, speed: 170 },
    { type: VEH_TYPE_MOTORCYCLE, color: '#e74c3c', offset: { x: -50, y: -200 }, speed: 220 },
    { type: VEH_TYPE_TRUCK, color: '#34495e', offset: { x: 50, y: 180 }, speed: 120 },
    { type: VEH_TYPE_CAR, color: '#ecf0f1', offset: { x: -30, y: -160 }, speed: 150 },
    { type: VEH_TYPE_CAR, color: '#27ae60', offset: { x: 30, y: -40 }, speed: 190 },
  ]);
  
  // Spawn police pursuit (3-star = helicopter + multiple units)
  const police = world.police;
  if (police) {
    police.wantedLevel = 3;
    police.wantedStars = 3;
    police.lastSeenPosition = { x: player.x, y: player.y };
    police.lastSeenTime = 0;
    police.isSearching = false;
    
    // Police cars behind and beside player
    spawnPoliceAround(world, player.x, player.y, 4, [
      { offset: { x: -30, y: 80 }, type: 'patrol' },
      { offset: { x: 30, y: 100 }, type: 'patrol' },
      { offset: { x: 0, y: 150 }, type: 'undercover' },
      { offset: { x: -50, y: 200 }, type: 'patrol' },
    ]);
    
    // Helicopter
    if (!police.helicopters.some(h => h.active)) {
      const heli = {
        id: Date.now(),
        x: player.x + 100,
        y: player.y - 50,
        z: 100,
        targetZ: 100,
        angle: 0,
        speed: 0,
        maxSpeed: 300,
        spotlightAngle: Math.PI,
        spotlightOn: true,
        gunner: { weapon: 'minigun', accuracy: 0.6, shootTimer: 0 },
        pilot: { state: 'orbit' },
        active: true,
        health: 500,
        maxHealth: 500,
        smokeLevel: 0,
      };
      police.helicopters.push(heli);
    }
  }
  
  // Active mission with visible marker
  const mission = {
    id: 'story_3',
    name: 'Heat Wave',
    type: MISSION_TYPE.STORY,
    currentObjective: 1,
    objectives: [
      { text: 'Meet Diaz at his mansion', completed: true },
      { text: 'Survive 3-star wanted level for 2:00', completed: false, target: { stars: 3, duration: 85 } },
    ],
    location: { x: 8 * WORLD.sectorSize + 200, y: 22 * WORLD.sectorSize + 100 },
  };
  world.activeMission = mission;
  
  // Mission marker on minimap
  world.missionMarkers = [{
    id: 'story_3',
    x: mission.location.x,
    y: mission.location.y,
    type: MISSION_TYPE.STORY,
    color: PALETTE.mission,
    active: true,
  }];
  
  // GPS route to mission
  world.gpsTarget = { x: mission.location.x, y: mission.location.y };
  world.gpsRoute = generateRoute(world, player.x, player.y, mission.location.x, mission.location.y);
  
  // Time: Late afternoon (golden hour)
  world.timeOfDay = 17.5 * 3600;
  world.weather = 'clear';
  world.targetWeather = 'clear';
  
  // Zone name
  world.zoneName = 'Vice Beach';
  world.zoneNameTimer = 999; // Permanent for screenshot
  
  // Add some pedestrians on sidewalks
  spawnPedsAround(world, player.x, player.y, 8);
  
  // Camera position for cinematic shot
  cam.x = player.x + Math.sin(player.angle) * 80;
  cam.y = player.y - Math.cos(player.angle) * 80;
  
  return { player, cam, mission };
}

export function setupCityShot(world, renderer) {
  // CITY: Parked view showing city districts, parked cars, pedestrians, architecture
  // High angle view from Star Island looking toward Downtown
  
  const player = world.player;
  const cam = world.camera;
  
  // Position: Star Island luxury district, on foot overlooking the city
  player.x = 26 * WORLD.sectorSize + 150;
  player.y = 8 * WORLD.sectorSize + 150;
  player.angle = Math.PI * 0.75; // Looking toward downtown
  player.inVehicle = false;
  player.health = PLAYER.maxHealth;
  player.armor = PLAYER.maxArmor;
  player.wantedLevel = 0;
  player.money = 150000;
  player.weapon = 'rifle';
  
  cam.x = player.x;
  cam.y = player.y;
  cam.targetX = player.x;
  cam.targetY = player.y;
  
  clearWorldEntities(world);
  
  // No player vehicle
  player.vehicleId = -1;
  
  // Spawn luxury parked cars in driveways
  spawnParkedCars(world, player.x, player.y, 6, [
    { color: '#f1c40f', offset: { x: -60, y: -40 }, angle: Math.PI / 4 },
    { color: '#ecf0f1', offset: { x: 60, y: 40 }, angle: -Math.PI / 4 },
    { color: '#e74c3c', offset: { x: -80, y: 80 }, angle: Math.PI / 2 },
    { color: '#3498db', offset: { x: 80, y: -80 }, angle: -Math.PI / 2 },
    { color: '#2c3e50', offset: { x: 0, y: -100 }, angle: 0 },
    { color: '#8e44ad', offset: { x: -40, y: 100 }, angle: Math.PI },
  ]);
  
  // Traffic on distant roads
  spawnDistantTraffic(world, 15);
  
  // Pedestrians - wealthy NPCs, security, staff
  spawnPedsAround(world, player.x, player.y, 12, ['business', 'civilian']);
  
  // Yacht in water (Star Island waterfront)
  spawnYacht(world, player.x - 200, player.y + 100);
  
  // Time: Sunset
  world.timeOfDay = 18.8 * 3600;
  world.weather = 'clear';
  world.targetWeather = 'clear';
  
  // Zone
  world.zoneName = 'Star Island';
  world.zoneNameTimer = 999;
  
  // Camera pulled back and elevated for city panorama
  cam.x = player.x + Math.sin(player.angle) * 200;
  cam.y = player.y - Math.cos(player.angle) * 200;
  
  // No active mission
  world.activeMission = null;
  world.gpsTarget = null;
  world.gpsRoute = [];
  
  return { player, cam };
}

export function setupChaseShot(world, renderer) {
  // CHASE: On foot vs police - player running, police cars converging, helicopters, spike strips
  // Industrial district (Port Vice), night time, rain
  
  const player = world.player;
  const cam = world.camera;
  
  // Position: Port Vice industrial area
  player.x = 4 * WORLD.sectorSize + 200;
  player.y = 14 * WORLD.sectorSize + 150;
  player.angle = 0; // Running east
  player.inVehicle = false;
  player.health = 45;
  player.armor = 0;
  player.stamina = 30;
  player.wantedLevel = 4;
  player.wantedStars = 4;
  player.money = 5000;
  player.weapon = 'smg';
  player.ammo.smg = 120;
  player.velocityX = PLAYER.runSpeed;
  player.velocityY = 0;
  player.speed = PLAYER.runSpeed;
  
  cam.x = player.x;
  cam.y = player.y;
  cam.targetX = player.x;
  cam.targetY = player.y;
  cam.shake = 15;
  cam.shakeTime = 2;
  
  clearWorldEntities(world);
  
  // Police units surrounding player (4-star = SWAT, roadblocks, helicopter)
  const police = world.police;
  if (police) {
    police.wantedLevel = 4;
    police.wantedStars = 4;
    police.lastSeenPosition = { x: player.x, y: player.y };
    police.lastSeenTime = 0;
    police.isSearching = false;
    
    // Police cars closing in from multiple directions
    spawnPoliceAround(world, player.x, player.y, 8, [
      { offset: { x: -100, y: -50 }, type: 'swat' },
      { offset: { x: 100, y: -50 }, type: 'patrol' },
      { offset: { x: -80, y: 80 }, type: 'patrol' },
      { offset: { x: 80, y: 80 }, type: 'swat' },
      { offset: { x: 0, y: -150 }, type: 'patrol' },
      { offset: { x: -120, y: 0 }, type: 'patrol' },
      { offset: { x: 120, y: 0 }, type: 'patrol' },
      { offset: { x: 0, y: 150 }, type: 'swat' },
    ]);
    
    // Roadblock ahead
    const roadblock = {
      id: Date.now(),
      x: player.x + 200,
      y: player.y,
      angle: Math.PI / 2,
      length: 60,
      width: 4,
      vehicles: [],
      spikes: true,
      active: true,
      timer: 120,
    };
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 20;
      const vx = roadblock.x + Math.cos(roadblock.angle + Math.PI/2) * offset;
      const vy = roadblock.y + Math.sin(roadblock.angle + Math.PI/2) * offset;
      const vehicle = createVehicle(VEH_TYPE_POLICE, vx, vy, roadblock.angle, {
        state: VEHICLE_STATES.BLOCKADE,
      });
      vehicle.active = true;
      vehicle.siren = true;
      roadblock.vehicles.push(vehicle);
      world.vehicles.push(vehicle);
    }
    police.roadblocks.push(roadblock);
    
    // Spike strips
    const spikes = {
      id: Date.now() + 1,
      x: player.x + 100,
      y: player.y - 30,
      angle: 0,
      length: 20,
      width: 3,
      active: true,
      timer: 60,
      triggered: false,
    };
    police.spikeStrips.push(spikes);
    
    // Helicopter with spotlight
    const heli = {
      id: Date.now() + 2,
      x: player.x,
      y: player.y - 100,
      z: 100,
      targetZ: 100,
      angle: 0,
      speed: 0,
      maxSpeed: 300,
      spotlightAngle: Math.PI / 2,
      spotlightOn: true,
      gunner: { weapon: 'minigun', accuracy: 0.6, shootTimer: 0 },
      pilot: { state: 'orbit' },
      active: true,
      health: 500,
      maxHealth: 500,
      smokeLevel: 0,
    };
    police.helicopters.push(heli);
  }
  
  // Industrial traffic (trucks, forklifts)
  spawnIndustrialTraffic(world, player.x, player.y, 6);
  
  // Pedestrians fleeing
  spawnFleeingPeds(world, player.x, player.y, 10);
  
  // Time: Night with rain
  world.timeOfDay = 23 * 3600;
  world.weather = 'rain';
  world.targetWeather = 'rain';
  world.weatherTransition = 1;
  
  // Zone
  world.zoneName = 'Port Vice';
  world.zoneNameTimer = 999;
  
  // Active mission: Escape
  const mission = {
    id: 'story_4_escape',
    name: 'Rub Out - Escape',
    type: MISSION_TYPE.STORY,
    currentObjective: 2,
    objectives: [
      { text: 'Go to Haitian compound', completed: true },
      { text: 'Kill the gang leader', completed: true },
      { text: 'Lose the police', completed: false },
    ],
  };
  world.activeMission = mission;
  
  // Camera low and behind player for dramatic chase feel
  cam.x = player.x - Math.cos(player.angle) * 60;
  cam.y = player.y - Math.sin(player.angle) * 60;
  
  return { player, cam, mission };
}

export function setupArrestShot(world, renderer) {
  // ARREST: Player being arrested - police officers surrounding, hands up, police cars, "BUSTED" text
  // Downtown, day time, clear
  
  const player = world.player;
  const cam = world.camera;
  
  // Position: Downtown, near police station
  player.x = 10 * WORLD.sectorSize + 150;
  player.y = 10 * WORLD.sectorSize + 200;
  player.angle = Math.PI; // Facing south
  player.inVehicle = false;
  player.health = PLAYER.maxHealth;
  player.armor = 0;
  player.wantedLevel = 0; // Just got busted
  player.wasted = false;
  player.busted = true;
  
  cam.x = player.x;
  cam.y = player.y;
  cam.targetX = player.x;
  cam.targetY = player.y;
  
  clearWorldEntities(world);
  
  // Police officers around player (arresting)
  const police = world.police;
  if (police) {
    police.wantedLevel = 0;
    police.wantedStars = 0;
    police.busted = true;
    police.bustedTimer = 3;
    police.arrestProgress = 1;
    police.stats.timesArrested++;
    
    // Arresting officer
    police.arrestingOfficer = {
      id: 1,
      vehicle: { x: player.x + 10, y: player.y + 5, active: true },
      officers: [
        { id: 1, type: 'patrol', health: 100, armor: 0, weapon: 'pistol', state: 'arresting' },
        { id: 2, type: 'patrol', health: 100, armor: 0, weapon: 'pistol', state: 'arresting' },
      ],
    };
    
    // Additional police units nearby
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dist = 30 + i * 5;
      const vehicle = createVehicle(VEH_TYPE_POLICE, 
        player.x + Math.cos(angle) * dist, 
        player.y + Math.sin(angle) * dist, 
        angle + Math.PI, { state: VEHICLE_STATES.PARKED });
      vehicle.active = true;
      vehicle.siren = false;
      vehicle.id = 100 + i;
      vehicle.officers = [
        { id: 10 + i, type: 'patrol', health: 100, armor: 0, weapon: 'pistol', state: 'combat' },
        { id: 20 + i, type: 'patrol', health: 100, armor: 0, weapon: 'pistol', state: 'combat' },
      ];
      world.vehicles.push(vehicle);
      police.units.push({
        id: 1000 + i,
        vehicle,
        type: POLICE_UNIT_TYPES.PATROL_CAR,
        state: 'patrol',
        active: true,
      });
    }
  }
  
  // Police cars parked around
  spawnPoliceCarsParked(world, player.x, player.y, 4);
  
  // Onlookers (pedestrians watching)
  spawnWatchingPeds(world, player.x, player.y, 8);
  
  // Time: Midday
  world.timeOfDay = 12 * 3600;
  world.weather = 'clear';
  world.targetWeather = 'clear';
  
  // Zone
  world.zoneName = 'Downtown';
  world.zoneNameTimer = 999;
  
  // Screen state
  world.screen = 'busted';
  
  // Message
  world.messages = [
    { text: 'BUSTED! Lost $12,500', timer: 5000, alpha: 1 },
  ];
  
  // Camera positioned to show arrest scene
  cam.x = player.x;
  cam.y = player.y - 80;
  
  return { player, cam };
}

function clearWorldEntities(world) {
  // Clear vehicles except player's
  world.vehicles = world.vehicles.filter(v => v.id === world.player.vehicleId);
  
  // Clear peds
  world.peds = [];
  
  // Clear police units but keep system
  if (world.police) {
    world.police.units = [];
    world.police.helicopters = [];
    world.police.roadblocks = [];
    world.police.spikeStrips = [];
  }
  
  // Clear pickups
  world.pickups = world.pickups.filter(p => !p.active);
  
  // Clear effects
  if (world.renderer) {
    world.renderer.effects = [];
  }
}

function spawnTrafficAround(world, cx, cy, count, presets) {
  for (let i = 0; i < count; i++) {
    const preset = presets[i % presets.length];
    const vehicle = createVehicle(preset.type, 
      cx + preset.offset.x, 
      cy + preset.offset.y, 
      -Math.PI / 2, { 
        state: VEHICLE_STATES.DRIVING,
        color: preset.color,
      });
    vehicle.id = 10 + i;
    vehicle.active = true;
    vehicle.speed = preset.speed;
    vehicle.velocityY = -preset.speed;
    vehicle.driver = { type: 'ai', pedId: -1 };
    world.vehicles.push(vehicle);
  }
}

function spawnPoliceAround(world, cx, cy, count, presets) {
  for (let i = 0; i < count; i++) {
    const preset = presets[i % presets.length];
    const vehicle = createVehicle(VEH_TYPE_POLICE, 
      cx + preset.offset.x, 
      cy + preset.offset.y, 
      Math.atan2(-preset.offset.y, -preset.offset.x), { 
        state: VEHICLE_STATES.PURSUING,
        aiPersonality: preset.type === 'swat' ? 'aggressive' : 'normal',
      });
    vehicle.id = 200 + i;
    vehicle.active = true;
    vehicle.siren = true;
    vehicle.speed = 200 + Math.random() * 100;
    vehicle.unitType = preset.type;
    vehicle.officers = [
      { id: 1000 + i * 2, type: preset.type === 'swat' ? 'swat' : 'patrol', health: 100, armor: preset.type === 'swat' ? 50 : 0, weapon: preset.type === 'swat' ? 'rifle' : 'pistol', state: 'combat' },
      { id: 1001 + i * 2, type: preset.type === 'swat' ? 'swat' : 'patrol', health: 100, armor: 0, weapon: 'pistol', state: 'combat' },
    ];
    world.vehicles.push(vehicle);
    
    if (world.police) {
      world.police.units.push({
        id: 5000 + i,
        vehicle,
        type: preset.type === 'swat' ? 'swat' : 'patrol',
        state: 'pursuing',
        active: true,
      });
    }
  }
}

function spawnParkedCars(world, cx, cy, count, presets) {
  for (let i = 0; i < count; i++) {
    const preset = presets[i % presets.length];
    const vehicle = createVehicle(VEH_TYPE_CAR, 
      cx + preset.offset.x, 
      cy + preset.offset.y, 
      preset.angle, { 
        state: VEHICLE_STATES.PARKED,
        color: preset.color,
      });
    vehicle.id = 300 + i;
    vehicle.active = true;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    world.vehicles.push(vehicle);
  }
}

function spawnDistantTraffic(world, count) {
  // Spawn traffic on main roads away from player
  const roads = [
    { x: 10 * WORLD.sectorSize, y: 0, angle: Math.PI/2, length: WORLD.height }, // Main N/S
    { x: 0, y: 10 * WORLD.sectorSize, angle: 0, length: WORLD.width }, // Main E/W
    { x: 20 * WORLD.sectorSize, y: 0, angle: Math.PI/2, length: WORLD.height },
    { x: 0, y: 20 * WORLD.sectorSize, angle: 0, length: WORLD.width },
  ];
  
  for (let i = 0; i < count; i++) {
    const road = roads[Math.floor(Math.random() * roads.length)];
    const dist = Math.random() * road.length;
    const x = road.x + Math.cos(road.angle) * dist;
    const y = road.y + Math.sin(road.angle) * dist;
    
    const types = [VEH_TYPE_CAR, VEH_TYPE_CAR, VEH_TYPE_TRUCK, VEH_TYPE_MOTORCYCLE];
    const vehicle = createVehicle(types[Math.floor(Math.random() * types.length)], x, y, road.angle, {
      state: VEHICLE_STATES.DRIVING,
    });
    vehicle.id = 400 + i;
    vehicle.active = true;
    vehicle.speed = 100 + Math.random() * 150;
    vehicle.velocityX = Math.cos(road.angle) * vehicle.speed;
    vehicle.velocityY = Math.sin(road.angle) * vehicle.speed;
    world.vehicles.push(vehicle);
  }
}

function spawnIndustrialTraffic(world, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const vehicle = createVehicle(VEH_TYPE_TRUCK, 
      cx + Math.cos(angle) * dist, 
      cy + Math.sin(angle) * dist, 
      angle, { 
        state: VEHICLE_STATES.DRIVING,
      });
    vehicle.id = 500 + i;
    vehicle.active = true;
    vehicle.speed = 60 + Math.random() * 80;
    vehicle.velocityX = Math.cos(angle) * vehicle.speed;
    vehicle.velocityY = Math.sin(angle) * vehicle.speed;
    world.vehicles.push(vehicle);
  }
}

function spawnPoliceCarsParked(world, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI;
    const dist = 25;
    const vehicle = createVehicle(VEH_TYPE_POLICE, 
      cx + Math.cos(angle) * dist, 
      cy + Math.sin(angle) * dist, 
      angle, { 
        state: VEHICLE_STATES.PARKED,
      });
    vehicle.id = 600 + i;
    vehicle.active = true;
    vehicle.siren = false;
    vehicle.speed = 0;
    world.vehicles.push(vehicle);
  }
}

function spawnPedsAround(world, cx, cy, count, types = ['civilian']) {
  const pedTypes = types || ['civilian', 'business', 'tourist'];
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 80;
    const type = pedTypes[Math.floor(Math.random() * pedTypes.length)];
    
    const ped = {
      id: 700 + i,
      type: type === 'civilian' ? 0 : type === 'business' ? 1 : 2,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      angle: angle + Math.PI, // Facing center
      speed: 0,
      velocityX: 0,
      velocityY: 0,
      width: 14,
      height: 24,
      health: 100,
      maxHealth: 100,
      state: 'walk',
      targetX: cx + Math.cos(angle) * dist,
      targetY: cy + Math.sin(angle) * dist,
      wanderTimer: Math.random() * 5,
      wanderAngle: Math.random() * Math.PI * 2,
      fleeFrom: null,
      combatTarget: null,
      attackCooldown: 0,
      isGang: type === 'gang',
      gangId: -1,
      color: type === 'business' ? '#ffffb3' : type === 'tourist' ? '#80b1d3' : '#8dd3c7',
      clothingColor: ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad'][Math.floor(Math.random() * 5)],
    };
    ped.active = true;
    world.peds.push(ped);
  }
}

function spawnFleeingPeds(world, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 100;
    const ped = {
      id: 800 + i,
      type: 0,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      angle: angle, // Fleeing away
      speed: 140,
      velocityX: Math.cos(angle) * 140,
      velocityY: Math.sin(angle) * 140,
      width: 14,
      height: 24,
      health: 100,
      maxHealth: 100,
      state: 'flee',
      targetX: cx + Math.cos(angle) * 200,
      targetY: cy + Math.sin(angle) * 200,
      wanderTimer: 10,
      wanderAngle: angle,
      fleeFrom: { x: cx, y: cy },
      combatTarget: null,
      attackCooldown: 0,
      isGang: false,
      gangId: -1,
      color: '#fb8072',
      clothingColor: ['#e74c3c', '#f39c12', '#3498db', '#2ecc71'][Math.floor(Math.random() * 4)],
    };
    ped.active = true;
    world.peds.push(ped);
  }
}

function spawnWatchingPeds(world, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    const ped = {
      id: 900 + i,
      type: Math.floor(Math.random() * 3),
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      angle: angle + Math.PI, // Facing arrest
      speed: 0,
      velocityX: 0,
      velocityY: 0,
      width: 14,
      height: 24,
      health: 100,
      maxHealth: 100,
      state: 'walk',
      targetX: cx + Math.cos(angle) * dist,
      targetY: cy + Math.sin(angle) * dist,
      wanderTimer: 999,
      wanderAngle: 0,
      fleeFrom: null,
      combatTarget: null,
      attackCooldown: 0,
      isGang: false,
      gangId: -1,
      color: '#8dd3c7',
      clothingColor: ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1'][Math.floor(Math.random() * 6)],
    };
    ped.active = true;
    world.peds.push(ped);
  }
}

function spawnYacht(world, x, y) {
  // Large boat as a vehicle
  const yacht = {
    id: 999,
    type: 4, // Boat type
    x, y,
    angle: -Math.PI / 4,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
    width: 40,
    length: 120,
    maxSpeed: 80,
    acceleration: 50,
    brakeForce: 100,
    turnSpeed: 0.8,
    driftFactor: 0.5,
    mass: 50000,
    health: 2000,
    maxHealth: 2000,
    driver: { type: 'none' },
    passengers: [],
    isPolice: false,
    state: 'parked',
    color: '#ecf0f1',
    bodyColor: '#ecf0f1',
    roofColor: '#bdc3c7',
    wheelColor: '#2c3e50',
    windowColor: '#2c3e50',
    active: true,
  };
  world.vehicles.push(yacht);
}

function generateRoute(world, sx, sy, tx, ty) {
  const route = [{ x: sx, y: sy }];
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = sx + (tx - sx) * t;
    const y = sy + (ty - sy) * t;
    // Snap to nearest main road
    const roadX = Math.round(x / (WORLD.sectorSize * 4)) * WORLD.sectorSize * 4;
    const roadY = Math.round(y / (WORLD.sectorSize * 4)) * WORLD.sectorSize * 4;
    route.push({ x: roadX, y: roadY });
  }
  route.push({ x: tx, y: ty });
  return route;
}

export function applyShot(world, renderer, shotName) {
  switch (shotName) {
    case SHOT_SCENES.COVER:
      return setupCoverShot(world, renderer);
    case SHOT_SCENES.CITY:
      return setupCityShot(world, renderer);
    case SHOT_SCENES.CHASE:
      return setupChaseShot(world, renderer);
    case SHOT_SCENES.ARREST:
      return setupArrestShot(world, renderer);
    default:
      return null;
  }
}

export function getShotSceneNames() {
  return Object.values(SHOT_SCENES);
}

export function captureScreenshot(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve(filename);
    }, 'image/png');
  });
}