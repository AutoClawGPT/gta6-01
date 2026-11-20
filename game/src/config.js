// GTA 6 Style Open-World Configuration - Every tuning number in one place
// Used for: world parameters, player stats, vehicle handling, weapon data, police settings,
// mission configuration, palette colors, audio settings, save format, cheat codes, and district definitions.
// Ensures all game systems reference consistent values for balanced gameplay.

export const WORLD = {
  // City grid: 32x32 sectors, each 256x256 logical units
  sectorSize: 256,
  gridSize: 32,
  // Logical world size
  width: 32 * 256,
  height: 32 * 256,
  // Camera follows player with smoothing
  cameraLerp: 0.1,
  // Minimap
  minimap: { size: 200, zoom: 0.05, border: 2 },
};

export const PLAYER = {
  // On foot
  walkSpeed: 120,
  runSpeed: 280,
  swimSpeed: 80,
  width: 16,
  height: 28,
  health: 100,
  maxHealth: 100,
  armor: 0,
  maxArmor: 100,
  stamina: 100,
  maxStamina: 100,
  // In vehicle
  vehicleEnterRange: 24,
  // Combat
  punchDamage: 15,
  punchRange: 20,
  punchCooldown: 0.5,
  // Wanted system
  wantedDecayRate: 0.5, // stars per second when hidden
  wantedMaxStars: 5,
};

export const VEHICLE = {
  car: {
    width: 36,
    length: 60,
    maxSpeed: 400,
    acceleration: 600,
    brakeForce: 800,
    turnSpeed: 3.5,
    driftFactor: 0.3,
    mass: 1500,
    health: 500,
    maxHealth: 500,
  },
  motorcycle: {
    width: 18,
    length: 48,
    maxSpeed: 480,
    acceleration: 800,
    brakeForce: 600,
    turnSpeed: 5.0,
    driftFactor: 0.15,
    mass: 300,
    health: 200,
    maxHealth: 200,
  },
  truck: {
    width: 44,
    length: 80,
    maxSpeed: 280,
    acceleration: 350,
    brakeForce: 1000,
    turnSpeed: 2.0,
    driftFactor: 0.5,
    mass: 4000,
    health: 800,
    maxHealth: 800,
  },
  police: {
    width: 36,
    length: 60,
    maxSpeed: 440,
    acceleration: 700,
    brakeForce: 900,
    turnSpeed: 3.8,
    driftFactor: 0.25,
    mass: 1800,
    health: 600,
    maxHealth: 600,
  },
};

export const PEDESTRIAN = {
  width: 14,
  height: 24,
  walkSpeed: 60,
  runSpeed: 140,
  types: [
    { name: 'civilian', color: '#8dd3c7', weight: 0.6 },
    { name: 'business', color: '#ffffb3', weight: 0.2 },
    { name: 'gang', color: '#fb8072', weight: 0.1 },
    { name: 'tourist', color: '#80b1d3', weight: 0.1 },
  ],
  maxPerSector: 12,
  spawnRange: 400,
  despawnRange: 600,
};

export const TRAFFIC = {
  maxVehicles: 40,
  spawnRange: 500,
  despawnRange: 800,
  laneOffset: 28,
  followDistance: 40,
  speedVariance: 0.3,
  vehicleTypes: ['car', 'car', 'car', 'motorcycle', 'truck'],
};

export const POLICE = {
  maxUnits: 20,
  spawnRange: 600,
  responseTime: { 1: 30, 2: 20, 3: 12, 4: 6, 5: 3 }, // seconds by wanted level
  pursuitSpeed: 1.1,
  ramDamage: 25,
  shootRange: 120,
  shootCooldown: 1.5,
  shootAccuracy: 0.6,
  helicopter: {
    enabled: true,
    spawnAtStars: 3,
    speed: 300,
    spotlightRange: 200,
  },
};

export const MISSION = {
  maxActive: 3,
  markerSize: 32,
  markerPulseSpeed: 3,
  types: {
    story: { color: '#ffd700', icon: '★' },
    side: { color: '#00bfff', icon: '◆' },
    stranger: { color: '#ff69b4', icon: '●' },
    race: { color: '#ff4500', icon: '▲' },
  },
  checkpoints: {
    radius: 24,
    height: 4,
  },
};

export const WEAPON = {
  fist: { damage: 15, range: 20, cooldown: 0.5, ammo: Infinity, type: 'melee' },
  pistol: { damage: 28, range: 100, cooldown: 0.35, ammo: 12, maxAmmo: 120, type: 'ranged', spread: 0.02 },
  smg: { damage: 22, range: 80, cooldown: 0.08, ammo: 30, maxAmmo: 300, type: 'ranged', spread: 0.05 },
  rifle: { damage: 40, range: 180, cooldown: 0.12, ammo: 30, maxAmmo: 240, type: 'ranged', spread: 0.015 },
  shotgun: { damage: 80, range: 30, cooldown: 0.8, ammo: 8, maxAmmo: 64, type: 'ranged', spread: 0.15, pellets: 8 },
  sniper: { damage: 120, range: 400, cooldown: 1.5, ammo: 5, maxAmmo: 40, type: 'ranged', spread: 0.001 },
};

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const PALETTE = {
  // World
  sky: '#1a1f2e',
  skyHorizon: '#2d3a4f',
  water: '#0d1b2a',
  waterDeep: '#08121a',
  sand: '#d4b896',
  grass: '#2d5a27',
  grassDark: '#1e3d1a',
  dirt: '#5d4e37',
  road: '#2a2a2e',
  roadLine: '#3a3a42',
  sidewalk: '#3d3d44',
  building: '#2d2d35',
  buildingDark: '#1f1f25',
  buildingAccent: '#3a3a48',
  window: '#1a1a22',
  windowLit: '#ffd700',
  // UI
  panel: '#1a1a22',
  panelBorder: '#3a3a48',
  text: '#e8e8f0',
  textMuted: '#8a8a9a',
  health: '#e74c3c',
  armor: '#3498db',
  stamina: '#f39c12',
  wanted: '#e74c3c',
  wantedEmpty: '#3a3a48',
  money: '#27ae60',
  mission: '#ffd700',
  gps: '#00bfff',
  gpsRoute: '#00ffff',
  crosshair: '#ffffff',
  crosshairOuter: '#000000',
  // Vehicles
  carColors: [
    '#c0392b', '#e74c3c', '#e67e22', '#f39c12', '#f1c40f',
    '#27ae60', '#2ecc71', '#1abc9c', '#16a085', '#3498db',
    '#2980b9', '#9b59b6', '#8e44ad', '#34495e', '#2c3e50',
    '#ecf0f1', '#bdc3c7', '#95a5a6', '#7f8c8d', '#1a1a22'
  ],
  pedColors: [
    '#8dd3c7', '#ffffb3', '#fb8072', '#80b1d3', '#fdb462',
    '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5'
  ],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "Fira Code", "Consolas", monospace';

export const AUDIO = {
  enabled: false, // No audio for now
  masterVolume: 0.7,
};

export const DEBUG = {
  // Enable for development diagnostics
  enabled: false,
  logEvents: false,
  showFPS: false,
  godMode: false, // Infinite health/armor for testing
};

export const SAVE = {
  version: 1,
  key: 'gta6-save',
  autoSaveInterval: 30000,
};

export const CHEATS = {
  enabled: true,
  codes: {
    'health': { name: 'Full Health & Armor', action: 'fillHealth' },
    'weapons': { name: 'All Weapons', action: 'giveWeapons' },
    'wanted0': { name: 'Clear Wanted Level', action: 'clearWanted' },
    'wanted5': { name: 'Max Wanted Level', action: 'maxWanted' },
    'spawncar': { name: 'Spawn Sports Car', action: 'spawnSportsCar' },
    'spawnbike': { name: 'Spawn Motorcycle', action: 'spawnMotorcycle' },
    'time': { name: 'Advance Time 1 Hour', action: 'advanceTime' },
    'weather': { name: 'Toggle Weather', action: 'toggleWeather' },
  },
};

export const DISTRICTS = [
  // { name, x, y, width, height, type, color, danger }
  { name: 'Downtown', x: 8, y: 8, w: 8, h: 8, type: 'urban', color: '#3a3a48', danger: 1 },
  { name: 'Little Havana', x: 16, y: 16, w: 6, h: 6, type: 'residential', color: '#d4a574', danger: 2 },
  { name: 'Vice Beach', x: 20, y: 4, w: 8, h: 10, type: 'beach', color: '#8dd3c7', danger: 1 },
  { name: 'Port Vice', x: 2, y: 10, w: 8, h: 8, type: 'industrial', color: '#4a4a52', danger: 3 },
  { name: 'Everglades', x: 4, y: 2, w: 12, h: 10, type: 'wilderness', color: '#2d5a27', danger: 2 },
  { name: 'Star Island', x: 24, y: 6, w: 6, h: 6, type: 'luxury', color: '#ffd700', danger: 1 },
  { name: 'Grove District', x: 6, y: 20, w: 8, h: 6, type: 'gang', color: '#8b4513', danger: 4 },
  { name: 'Airport', x: 24, y: 18, w: 6, h: 10, type: 'airport', color: '#5a5a6a', danger: 2 },
  { name: 'Highway Ring', x: 0, y: 0, w: 32, h: 32, type: 'highway', color: '#2a2a2e', danger: 1, ring: true },
];

export const ROAD_NETWORK = {
  // Main roads (grid lines every 4 sectors)
  mainSpacing: 4,
  mainWidth: 24,
  // Local roads (every sector)
  localWidth: 16,
  // Highway (outer ring)
  highwayWidth: 40,
  // Intersections
  intersectionSize: 48,
};

export const TIME = {
  dayLength: 1200, // 20 minutes real time = 24 hours game time
  startHour: 12,
  hoursPerDay: 24,
};

export const WEATHER = {
  types: ['clear', 'cloudy', 'rain', 'storm', 'fog'],
  transitionTime: 300,
  probabilities: { clear: 0.5, cloudy: 0.25, rain: 0.15, storm: 0.05, fog: 0.05 },
};