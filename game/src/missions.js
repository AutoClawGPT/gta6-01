// Mission System - Story missions, side missions, objectives, and rewards.
// Manages mission creation, tracking, objectives, completion state, and rewards.
// Supports story missions, side tasks, races, stranger encounters, and survival modes.
// Mission state is tracked via MISSION_STATE (inactive, active, completed, failed, locked).
// Objectives use OBJECTIVE_TYPE enums for consistent handling across all mission kinds.
import { MISSION, WORLD, PALETTE } from './config.js';
import { distance, distanceSq, angleTo, findRoadPosition } from './world.js';

export const MISSION_TYPE = {
  STORY: 0,
  SIDE: 1,
  STRANGER: 2,
  RACE: 3,
  ASSASSINATION: 4,
  DELIVERY: 5,
  HEIST: 6,
  SURVIVAL: 7,
};

export const OBJECTIVE_TYPE = {
  GOTO: 'goto',
  ENTER_VEHICLE: 'enter_vehicle',
  FOLLOW: 'follow',
  KILL: 'kill',
  DESTROY: 'destroy',
  PICKUP: 'pickup',
  DELIVER: 'deliver',
  ESCORT: 'escort',
  SURVIVE: 'survive',
  RACE_CHECKPOINT: 'race_checkpoint',
  PHOTO: 'photo',
  HACK: 'hack',
  STEAL: 'steal',
  LOSE_WANTED: 'lose_wanted',
  WAIT: 'wait',
  DEFEND: 'defend',
  INTERACT: 'interact',
};

export const MISSION_STATE = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  LOCKED: 'locked',
};

export function getMissionStatus(s, missionId) {
  const mission = s.missions.find(m => m.id === missionId);
  if (!mission) return { state: MISSION_STATE.LOCKED, progress: 0 };
  const currentObj = mission.objectives[mission.currentObjective] || {};
  const progress = typeof currentObj.target !== 'undefined'
    ? Math.min(1, (mission.currentObjective >= 0 ? 1 : 0))
    : 0;
  return { state: mission.state, progress, currentObjective: mission.currentObjective, totalObjectives: mission.objectives.length };
}

const MISSION_DATA = {
  // Story Missions - 3 Days, 6 Missions
  story: [
    {
      id: 'story_1',
      name: 'Welcome to Vesper Bay',
      type: MISSION_TYPE.STORY,
      day: 1,
      giver: 'Lance Vance',
      location: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 },
      radius: MISSION.markerSize,
      description: 'Meet your contact at the downtown club to discuss business.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Drive to the Malibu Club', target: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 }, radius: 20 },
        { type: OBJECTIVE_TYPE.INTERACT, text: 'Enter the club', target: { x: 10 * WORLD.sectorSize + 128, y: 10 * WORLD.sectorSize + 128 }, radius: 10 },
        { type: OBJECTIVE_TYPE.WAIT, text: 'Watch the cutscene', duration: 3 },
      ],
      reward: { money: 5000, xp: 100, unlock: ['story_2'] },
      requiredMission: null,
      failConditions: ['wasted', 'busted'],
    },
    {
      id: 'story_2',
      name: 'The Exchange',
      type: MISSION_TYPE.STORY,
      day: 1,
      giver: 'Lance Vance',
      location: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Pick up the package from Port Vice and deliver it to Star Island.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Go to Port Vice', target: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 }, radius: 30 },
        { type: OBJECTIVE_TYPE.PICKUP, text: 'Collect the package', target: { x: 4 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 }, radius: 10, item: 'package' },
        { type: OBJECTIVE_TYPE.DELIVER, text: 'Deliver to Star Island mansion', target: { x: 26 * WORLD.sectorSize + 100, y: 8 * WORLD.sectorSize + 100 }, radius: 30 },
      ],
      reward: { money: 15000, xp: 250, unlock: ['story_3', 'side_taxi', 'side_vigilante'] },
      requiredMission: 'story_1',
      failConditions: ['wasted', 'busted', 'vehicle_destroyed'],
    },
    {
      id: 'story_3',
      name: 'Heat Wave',
      type: MISSION_TYPE.STORY,
      day: 2,
      giver: 'Ricardo Diaz',
      location: { x: 8 * WORLD.sectorSize + 200, y: 22 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Survive a 3-star wanted level for 2 minutes while Diaz\'s men create a distraction.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Meet Diaz at his mansion', target: { x: 8 * WORLD.sectorSize + 200, y: 22 * WORLD.sectorSize + 100 }, radius: 20 },
        { type: OBJECTIVE_TYPE.SURVIVE, text: 'Survive 3-star wanted level for 2:00', target: { stars: 3, duration: 120 }, radius: 0 },
      ],
      reward: { money: 25000, xp: 500, unlock: ['story_4', 'race_beach'] },
      requiredMission: 'story_2',
      failConditions: ['wasted', 'busted'],
    },
    {
      id: 'story_4',
      name: 'Rub Out',
      type: MISSION_TYPE.STORY,
      day: 2,
      giver: 'Ricardo Diaz',
      location: { x: 16 * WORLD.sectorSize + 150, y: 18 * WORLD.sectorSize + 150 },
      radius: MISSION.markerSize,
      description: 'Eliminate the Haitian gang leader at his compound in Little Havana.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Go to Haitian compound', target: { x: 16 * WORLD.sectorSize + 150, y: 18 * WORLD.sectorSize + 150 }, radius: 40 },
        { type: OBJECTIVE_TYPE.KILL, text: 'Kill the gang leader', target: { x: 16 * WORLD.sectorSize + 150, y: 18 * WORLD.sectorSize + 150 }, radius: 30, targetName: 'Haitian Boss' },
        { type: OBJECTIVE_TYPE.LOSE_WANTED, text: 'Lose the police', target: {}, radius: 0 },
      ],
      reward: { money: 30000, xp: 750, unlock: ['story_5', 'side_gang'] },
      requiredMission: 'story_3',
      failConditions: ['wasted', 'busted', 'target_escaped'],
    },
    {
      id: 'story_5',
      name: 'Supply Run',
      type: MISSION_TYPE.STORY,
      day: 3,
      giver: 'Tommy Vercetti',
      location: { x: 24 * WORLD.sectorSize + 200, y: 20 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Fly a plane from the airport to the Everglades and back with the cargo.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Go to Vesper Bay Airport', target: { x: 24 * WORLD.sectorSize + 200, y: 20 * WORLD.sectorSize + 100 }, radius: 30 },
        { type: OBJECTIVE_TYPE.ENTER_VEHICLE, text: 'Enter the cargo plane', target: { x: 24 * WORLD.sectorSize + 200, y: 20 * WORLD.sectorSize + 100 }, radius: 15, vehicleType: 'plane' },
        { type: OBJECTIVE_TYPE.GOTO, text: 'Fly to Everglades drop zone', target: { x: 8 * WORLD.sectorSize + 100, y: 6 * WORLD.sectorSize + 100 }, radius: 50 },
        { type: OBJECTIVE_TYPE.GOTO, text: 'Return to airport', target: { x: 24 * WORLD.sectorSize + 200, y: 20 * WORLD.sectorSize + 100 }, radius: 30 },
      ],
      reward: { money: 40000, xp: 1000, unlock: ['story_6', 'heist_bank'] },
      requiredMission: 'story_4',
      failConditions: ['wasted', 'busted', 'vehicle_destroyed', 'cargo_lost'],
    },
    {
      id: 'story_6',
      name: 'The Big Score',
      type: MISSION_TYPE.HEIST,
      day: 3,
      giver: 'Tommy Vercetti',
      location: { x: 12 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Rob the Vesper Bay Bank. Assemble a crew, steal the getaway van, and escape with the loot.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Meet the crew at the safehouse', target: { x: 12 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 }, radius: 20 },
        { type: OBJECTIVE_TYPE.STEAL, text: 'Steal the Securicar', target: { x: 6 * WORLD.sectorSize + 200, y: 10 * WORLD.sectorSize + 200 }, radius: 30 },
        { type: OBJECTIVE_TYPE.GOTO, text: 'Drive to the bank', target: { x: 10 * WORLD.sectorSize + 150, y: 10 * WORLD.sectorSize + 150 }, radius: 30 },
        { type: OBJECTIVE_TYPE.HACK, text: 'Crack the vault', target: { x: 10 * WORLD.sectorSize + 150, y: 10 * WORLD.sectorSize + 150 }, radius: 10, duration: 30 },
        { type: OBJECTIVE_TYPE.DELIVER, text: 'Escape to the safehouse', target: { x: 12 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 }, radius: 30 },
        { type: OBJECTIVE_TYPE.LOSE_WANTED, text: 'Lose 5-star wanted level', target: {}, radius: 0 },
      ],
      reward: { money: 100000, xp: 2000, unlock: ['post_game'] },
      requiredMission: 'story_5',
      failConditions: ['wasted', 'busted', 'crew_wiped', 'vehicle_destroyed', 'time_limit'],
      timeLimit: 900, // 15 minutes
    },
  ],
  
  // Side Missions
  side: [
    {
      id: 'side_taxi',
      name: 'Taxi Driver',
      type: MISSION_TYPE.SIDE,
      giver: 'Kaufman Cabs',
      location: { x: 12 * WORLD.sectorSize + 50, y: 12 * WORLD.sectorSize + 50 },
      radius: MISSION.markerSize,
      description: 'Drive passengers to their destinations around Vesper Bay.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Pick up a fare', target: { x: 0, y: 0 }, radius: 20, dynamic: true },
        { type: OBJECTIVE_TYPE.DELIVER, text: 'Drop off passenger', target: { x: 0, y: 0 }, radius: 20, dynamic: true },
      ],
      reward: { money: 200, xp: 20, perCompletion: true },
      requiredMission: 'story_2',
      repeatable: true,
      maxRepeats: 50,
      failConditions: ['wasted', 'busted', 'vehicle_destroyed', 'passenger_killed'],
    },
    {
      id: 'side_vigilante',
      name: 'Vigilante',
      type: MISSION_TYPE.SIDE,
      giver: 'Police Radio',
      location: { x: 10 * WORLD.sectorSize + 200, y: 10 * WORLD.sectorSize + 200 },
      radius: MISSION.markerSize,
      description: 'Use the police computer in a cop car to track and eliminate criminals.',
      objectives: [
        { type: OBJECTIVE_TYPE.KILL, text: 'Eliminate the target', target: { x: 0, y: 0 }, radius: 50, dynamic: true, count: 3 },
      ],
      reward: { money: 1000, xp: 100, perCompletion: true },
      requiredMission: 'story_2',
      repeatable: true,
      maxRepeats: 20,
      failConditions: ['wasted', 'busted', 'vehicle_destroyed', 'time_limit'],
      timeLimit: 300,
    },
    {
      id: 'race_beach',
      name: 'Beach Sprint',
      type: MISSION_TYPE.RACE,
      giver: 'Race Organizer',
      location: { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
      radius: MISSION.markerSize,
      description: 'Race along the Vice Beach coastline against other drivers.',
      objectives: [
        { type: OBJECTIVE_TYPE.RACE_CHECKPOINT, text: 'Pass all checkpoints', target: { 
          checkpoints: [
            { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
            { x: 26 * WORLD.sectorSize + 50, y: 6 * WORLD.sectorSize + 50 },
            { x: 24 * WORLD.sectorSize + 50, y: 12 * WORLD.sectorSize + 50 },
            { x: 22 * WORLD.sectorSize + 50, y: 8 * WORLD.sectorSize + 50 },
          ]}, radius: 0 },
      ],
      reward: { money: 8000, xp: 300, perCompletion: true },
      requiredMission: 'story_3',
      repeatable: true,
      failConditions: ['wasted', 'busted', 'vehicle_destroyed', 'off_track'],
    },
    {
      id: 'side_gang',
      name: 'Gang Warfare',
      type: MISSION_TYPE.SIDE,
      giver: 'Avery Carrington',
      location: { x: 6 * WORLD.sectorSize + 200, y: 22 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Help the Cubans take over Haitian territory in Little Havana.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Go to the contested block', target: { x: 0, y: 0 }, radius: 40, dynamic: true },
        { type: OBJECTIVE_TYPE.KILL, text: 'Eliminate Haitian gang members', target: { x: 0, y: 0 }, radius: 60, dynamic: true, count: 10 },
        { type: OBJECTIVE_TYPE.DEFEND, text: 'Defend the territory for 2:00', target: { x: 0, y: 0 }, radius: 80, duration: 120, dynamic: true },
      ],
      reward: { money: 5000, xp: 200, perCompletion: true },
      requiredMission: 'story_4',
      repeatable: true,
      maxRepeats: 10,
      failConditions: ['wasted', 'busted', 'territory_lost'],
    },
    {
      id: 'side_stranger_1',
      name: 'Lost Tourist',
      type: MISSION_TYPE.STRANGER,
      giver: '???',
      location: { x: 20 * WORLD.sectorSize + 100, y: 6 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Help a tourist find their hotel on Star Island.',
      objectives: [
        { type: OBJECTIVE_TYPE.ESCORT, text: 'Escort the tourist to Star Island Hotel', target: { x: 26 * WORLD.sectorSize + 150, y: 8 * WORLD.sectorSize + 150 }, radius: 20 },
      ],
      reward: { money: 3000, xp: 150 },
      requiredMission: 'story_1',
      failConditions: ['wasted', 'busted', 'escort_killed'],
    },
    {
      id: 'side_stranger_2',
      name: 'Photo Op',
      type: MISSION_TYPE.STRANGER,
      giver: 'Paparazzo',
      location: { x: 18 * WORLD.sectorSize + 100, y: 8 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Take photos of a celebrity at the beach club without being spotted.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Go to the Beach Club', target: { x: 20 * WORLD.sectorSize + 50, y: 6 * WORLD.sectorSize + 50 }, radius: 30 },
        { type: OBJECTIVE_TYPE.PHOTO, text: 'Photograph the celebrity', target: { x: 20 * WORLD.sectorSize + 50, y: 6 * WORLD.sectorSize + 50 }, radius: 50, count: 3 },
        { type: OBJECTIVE_TYPE.LOSE_WANTED, text: 'Escape without being caught', target: {}, radius: 0 },
      ],
      reward: { money: 7000, xp: 250 },
      requiredMission: 'story_2',
      failConditions: ['wasted', 'busted', 'spotted'],
    },
    {
      id: 'side_assassination_1',
      name: 'Contract: The Lawyer',
      type: MISSION_TYPE.ASSASSINATION,
      giver: 'Mysterious Caller',
      location: { x: 14 * WORLD.sectorSize + 100, y: 14 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Eliminate a corrupt lawyer leaving the courthouse. Make it look like an accident.',
      objectives: [
        { type: OBJECTIVE_TYPE.GOTO, text: 'Stake out the courthouse', target: { x: 10 * WORLD.sectorSize + 200, y: 10 * WORLD.sectorSize + 200 }, radius: 40 },
        { type: OBJECTIVE_TYPE.KILL, text: 'Kill the target', target: { x: 10 * WORLD.sectorSize + 200, y: 10 * WORLD.sectorSize + 200 }, radius: 30, targetName: 'Corrupt Lawyer', stealth: true },
        { type: OBJECTIVE_TYPE.LOSE_WANTED, text: 'Leave the area', target: {}, radius: 0 },
      ],
      reward: { money: 12000, xp: 400 },
      requiredMission: 'story_3',
      failConditions: ['wasted', 'busted', 'target_escaped', 'alerted_police'],
    },
    {
      id: 'heist_bank',
      name: 'Bank Heist Setup',
      type: MISSION_TYPE.HEIST,
      giver: 'Phil Cassidy',
      location: { x: 8 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 },
      radius: MISSION.markerSize,
      description: 'Prepare for the big bank job. Steal weapons, a helicopter, and getaway cars.',
      objectives: [
        { type: OBJECTIVE_TYPE.STEAL, text: 'Steal the helicopter from the army base', target: { x: 2 * WORLD.sectorSize + 100, y: 2 * WORLD.sectorSize + 100 }, radius: 50 },
        { type: OBJECTIVE_TYPE.STEAL, text: 'Get 2 getaway cars', target: { x: 10 * WORLD.sectorSize + 50, y: 10 * WORLD.sectorSize + 50 }, radius: 30, count: 2 },
        { type: OBJECTIVE_TYPE.PICKUP, text: 'Collect the heavy weapons', target: { x: 8 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 }, radius: 20 },
        { type: OBJECTIVE_TYPE.GOTO, text: 'Return to the safehouse', target: { x: 12 * WORLD.sectorSize + 100, y: 12 * WORLD.sectorSize + 100 }, radius: 30 },
      ],
      reward: { money: 20000, xp: 800, unlock: ['story_6'] },
      requiredMission: 'story_5',
      failConditions: ['wasted', 'busted', 'vehicle_destroyed', 'heli_destroyed'],
    },
  ],
};

export function createMissionSystem() {
  return {
    missions: {},
    activeMission: null,
    completedMissions: new Set(),
    failedMissions: new Set(),
    missionMarkers: [],
    currentObjective: 0,
    objectiveProgress: {},
    dynamicTargets: {},
    missionTimer: 0,
    missionStartTime: 0,
    totalMissionsCompleted: 0,
    totalMoneyEarned: 0,
    totalXPEarned: 0,
  };
}

export function initializeMissions(missionSystem) {
  // Register all missions
  for (const m of MISSION_DATA.story) {
    missionSystem.missions[m.id] = {
      ...m,
      state: m.requiredMission ? MISSION_STATE.LOCKED : MISSION_STATE.INACTIVE,
      currentObjective: 0,
      objectives: m.objectives.map(o => ({ ...o, completed: false, dynamicData: null })),
      repeatCount: 0,
      startTime: 0,
    };
  }
  
  for (const m of MISSION_DATA.side) {
    missionSystem.missions[m.id] = {
      ...m,
      state: m.requiredMission ? MISSION_STATE.LOCKED : MISSION_STATE.INACTIVE,
      currentObjective: 0,
      objectives: m.objectives.map(o => ({ ...o, completed: false, dynamicData: null })),
      repeatCount: 0,
      startTime: 0,
    };
  }
  
  // Create initial markers for unlocked missions
  updateMissionMarkers(missionSystem);
}

export function updateMissions(missionSystem, world, dt) {
  const player = world.player;
  
  // Update active mission
  if (missionSystem.activeMission) {
    const mission = missionSystem.missions[missionSystem.activeMission];
    if (mission && mission.state === MISSION_STATE.ACTIVE) {
      updateActiveMission(mission, missionSystem, world, dt);
    }
  }
  
  // Check for mission start triggers
  checkMissionTriggers(missionSystem, world);
  
  // Update markers
  updateMissionMarkers(missionSystem);
  
  // Update mission timer
  if (missionSystem.activeMission) {
    const mission = missionSystem.missions[missionSystem.activeMission];
    if (mission.timeLimit) {
      missionSystem.missionTimer -= dt;
      if (missionSystem.missionTimer <= 0) {
        failMission(missionSystem, 'Time limit exceeded!');
      }
    }
  }
}

function updateActiveMission(mission, missionSystem, world, dt) {
  const player = world.player;
  const obj = mission.objectives[mission.currentObjective];
  if (!obj) return;
  
  // Handle dynamic objectives
  if (obj.dynamic && !obj.dynamicData) {
    obj.dynamicData = generateDynamicObjective(mission, obj, world);
    if (obj.dynamicData) {
      obj.target = { ...obj.dynamicData };
    }
  }
  
  let objectiveComplete = false;
  
  switch (obj.type) {
    case OBJECTIVE_TYPE.GOTO:
      if (checkGotoObjective(obj, player)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.ENTER_VEHICLE:
      if (checkEnterVehicleObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.FOLLOW:
      if (checkFollowObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.KILL:
      if (checkKillObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.DESTROY:
      if (checkDestroyObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.PICKUP:
      if (checkPickupObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.DELIVER:
      if (checkDeliverObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.ESCORT:
      if (checkEscortObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.SURVIVE:
      if (checkSurviveObjective(obj, player, world, dt)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.RACE_CHECKPOINT:
      if (checkRaceCheckpointObjective(obj, player, missionSystem)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.PHOTO:
      if (checkPhotoObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.HACK:
      if (checkHackObjective(obj, player, world, dt)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.STEAL:
      if (checkStealObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.LOSE_WANTED:
      if (checkLoseWantedObjective(obj, player)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.WAIT:
      if (checkWaitObjective(obj, dt)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.DEFEND:
      if (checkDefendObjective(obj, player, world, dt)) {
        objectiveComplete = true;
      }
      break;
      
    case OBJECTIVE_TYPE.INTERACT:
      if (checkInteractObjective(obj, player, world)) {
        objectiveComplete = true;
      }
      break;
  }
  
  if (objectiveComplete) {
    completeObjective(mission, missionSystem, world);
  }
  
  // Check fail conditions
  checkFailConditions(mission, missionSystem, world);
}

function checkGotoObjective(obj, player) {
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkEnterVehicleObjective(obj, player, world) {
  if (!player.inVehicle) return false;
  const vehicle = world.vehicles.find(v => v.id === player.vehicleId);
  if (!vehicle) return false;
  
  if (obj.vehicleType && vehicle.type !== obj.vehicleType) return false;
  
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkFollowObjective(obj, player, world) {
  // Follow target vehicle/ped
  return false; // Simplified
}

function checkKillObjective(obj, player, world) {
  // Check if target is dead
  // In real implementation, would track specific target entities
  return obj.dynamicData?.killed || false;
}

function checkDestroyObjective(obj, player, world) {
  return obj.dynamicData?.destroyed || false;
}

function checkPickupObjective(obj, player, world) {
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkDeliverObjective(obj, player, world) {
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkEscortObjective(obj, player, world) {
  if (!obj.dynamicData?.escortId) return false;
  const escort = world.peds.find(p => p.id === obj.dynamicData.escortId);
  if (!escort || escort.state === 'dead') return false;
  
  const dx = obj.target.x - escort.x;
  const dy = obj.target.y - escort.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkSurviveObjective(obj, player, world, dt) {
  if (player.wantedLevel >= obj.target.stars) {
    obj.target.duration -= dt;
    return obj.target.duration <= 0;
  }
  return false;
}

function checkRaceCheckpointObjective(obj, player, missionSystem) {
  if (!missionSystem.raceCheckpointIndex) missionSystem.raceCheckpointIndex = 0;
  const checkpoints = obj.target.checkpoints;
  const cp = checkpoints[missionSystem.raceCheckpointIndex];
  if (!cp) return false;
  
  const dx = cp.x - player.x;
  const dy = cp.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 30) {
    missionSystem.raceCheckpointIndex++;
    if (missionSystem.raceCheckpointIndex >= checkpoints.length) {
      return true;
    }
    world.addMessage(`Checkpoint ${missionSystem.raceCheckpointIndex}/${checkpoints.length}`, 2000);
  }
  return false;
}

function checkPhotoObjective(obj, player, world) {
  // Player takes photo (would need camera mechanic)
  return obj.dynamicData?.photosTaken >= (obj.count || 1);
}

function checkHackObjective(obj, player, world, dt) {
  if (!obj.dynamicData) {
    obj.dynamicData = { progress: 0 };
  }
  
  // Player must stay in radius
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < obj.radius) {
    obj.dynamicData.progress += dt;
    world.addMessage(`Hacking: ${Math.floor(obj.dynamicData.progress)}/${obj.duration}`, 100);
    return obj.dynamicData.progress >= obj.duration;
  } else {
    obj.dynamicData.progress = Math.max(0, obj.dynamicData.progress - dt * 2);
  }
  return false;
}

function checkStealObjective(obj, player, world) {
  if (!player.inVehicle) return false;
  const vehicle = world.vehicles.find(v => v.id === player.vehicleId);
  if (!vehicle) return false;
  
  // Check if it's the target vehicle
  if (obj.dynamicData?.targetVehicleId && vehicle.id !== obj.dynamicData.targetVehicleId) {
    return false;
  }
  
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  return Math.sqrt(dx * dx + dy * dy) < obj.radius;
}

function checkLoseWantedObjective(obj, player) {
  return player.wantedLevel === 0;
}

function checkWaitObjective(obj, dt) {
  if (!obj.dynamicData) {
    obj.dynamicData = { timer: obj.duration };
  }
  obj.dynamicData.timer -= dt;
  return obj.dynamicData.timer <= 0;
}

function checkDefendObjective(obj, player, world, dt) {
  if (!obj.dynamicData) {
    obj.dynamicData = { timer: obj.duration };
  }
  
  // Check if enemies in area
  const enemies = world.peds.filter(p => 
    p.active && p.state === 'combat' && 
    distanceSq(p.x, p.y, obj.target.x, obj.target.y) < obj.radius * obj.radius
  );
  
  if (enemies.length === 0) {
    obj.dynamicData.timer -= dt;
    world.addMessage(`Defending: ${Math.ceil(obj.dynamicData.timer)}s`, 100);
    return obj.dynamicData.timer <= 0;
  } else {
    obj.dynamicData.timer = obj.duration; // Reset if enemies present
  }
  return false;
}

function checkInteractObjective(obj, player, world) {
  const dx = obj.target.x - player.x;
  const dy = obj.target.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < obj.radius && player.input.action;
}

function completeObjective(mission, missionSystem, world) {
  mission.objectives[mission.currentObjective].completed = true;
  mission.currentObjective++;
  
  world.addMessage('Objective Complete!', 3000);
  
  if (mission.currentObjective >= mission.objectives.length) {
    completeMission(missionSystem, mission.id);
  } else {
    // Setup next objective
    const nextObj = mission.objectives[mission.currentObjective];
    if (nextObj.target && nextObj.target.x && nextObj.target.y) {
      world.gpsTarget = { x: nextObj.target.x, y: nextObj.target.y };
      world.gpsRoute = [];
    }
    // Clear dynamic data
    nextObj.dynamicData = null;
  }
}

function completeMission(missionSystem, missionId) {
  const mission = missionSystem.missions[missionId];
  if (!mission) return;
  
  mission.state = MISSION_STATE.COMPLETED;
  missionSystem.completedMissions.add(missionId);
  missionSystem.activeMission = null;
  missionSystem.totalMissionsCompleted++;
  
  // Give rewards
  const reward = mission.reward;
  if (reward.money) {
    world.player.money += reward.money;
    missionSystem.totalMoneyEarned += reward.money;
  }
  if (reward.xp) {
    // XP system would go here
    missionSystem.totalXPEarned += reward.xp;
  }
  
  world.addMessage(`MISSION COMPLETE! +$${reward.money || 0}`, 5000);
  
  // Unlock missions
  if (reward.unlock) {
    for (const unlockId of reward.unlock) {
      const unlockMission = missionSystem.missions[unlockId];
      if (unlockMission && unlockMission.state === MISSION_STATE.LOCKED) {
        unlockMission.state = MISSION_STATE.INACTIVE;
        world.addMessage(`New mission unlocked: ${unlockMission.name}`, 4000);
      }
    }
  }
  
  // Handle repeatable missions
  if (mission.repeatable) {
    mission.repeatCount++;
    if (mission.repeatCount < (mission.maxRepeats || 999)) {
      // Reset for repeat
      setTimeout(() => {
        mission.state = MISSION_STATE.INACTIVE;
        mission.currentObjective = 0;
        mission.objectives.forEach(o => { o.completed = false; o.dynamicData = null; });
        updateMissionMarkers(missionSystem);
      }, 60000); // 1 minute cooldown
    }
  }
  
  // Clear GPS
  world.gpsTarget = null;
  world.gpsRoute = [];
  missionSystem.raceCheckpointIndex = 0;
  
  updateMissionMarkers(missionSystem);
}

function failMission(missionSystem, reason) {
  if (!missionSystem.activeMission) return;
  
  const mission = missionSystem.missions[missionSystem.activeMission];
  if (!mission) return;
  
  mission.state = MISSION_STATE.FAILED;
  missionSystem.failedMissions.add(missionSystem.activeMission);
  missionSystem.activeMission = null;
  
  world.addMessage(`MISSION FAILED: ${reason}`, 5000);
  
  // Can retry story missions
  if (mission.type === MISSION_TYPE.STORY) {
    mission.state = MISSION_STATE.INACTIVE;
    mission.currentObjective = 0;
    mission.objectives.forEach(o => { o.completed = false; o.dynamicData = null; });
  }
  
  // Clear GPS
  world.gpsTarget = null;
  world.gpsRoute = [];
  missionSystem.raceCheckpointIndex = 0;
  
  updateMissionMarkers(missionSystem);
}

function checkFailConditions(mission, missionSystem, world) {
  const player = world.player;
  
  for (const condition of mission.failConditions) {
    switch (condition) {
      case 'wasted':
        if (player.wasted) failMission(missionSystem, 'You were wasted!');
        break;
      case 'busted':
        if (world.screen === 'busted') failMission(missionSystem, 'You were busted!');
        break;
      case 'vehicle_destroyed':
        if (player.inVehicle) {
          const vehicle = world.vehicles.find(v => v.id === player.vehicleId);
          if (vehicle && vehicle.health <= 0) failMission(missionSystem, 'Your vehicle was destroyed!');
        }
        break;
      case 'passenger_killed':
        // Would check escort ped
        break;
      case 'target_escaped':
        // Would check target distance
        break;
      case 'alerted_police':
        if (player.wantedLevel > 0) failMission(missionSystem, 'You alerted the police!');
        break;
      case 'off_track':
        // Race off track
        break;
      case 'territory_lost':
        // Gang war territory lost
        break;
      case 'time_limit':
        if (missionSystem.missionTimer <= 0) failMission(missionSystem, 'Time ran out!');
        break;
      case 'cargo_lost':
        // Heist cargo lost
        break;
      case 'crew_wiped':
        // Heist crew dead
        break;
      case 'heli_destroyed':
        // Helicopter destroyed
        break;
    }
  }
}

function checkMissionTriggers(missionSystem, world) {
  const player = world.player;
  
  for (const mission of Object.values(missionSystem.missions)) {
    if (mission.state !== MISSION_STATE.INACTIVE) continue;
    if (mission.requiredMission && !missionSystem.completedMissions.has(mission.requiredMission)) continue;
    
    const dx = mission.location.x - player.x;
    const dy = mission.location.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < mission.radius) {
      startMission(missionSystem, mission.id);
      break;
    }
  }
}

function startMission(missionSystem, missionId) {
  const mission = missionSystem.missions[missionId];
  if (!mission || mission.state !== MISSION_STATE.INACTIVE) return;
  
  mission.state = MISSION_STATE.ACTIVE;
  mission.currentObjective = 0;
  mission.startTime = Date.now();
  missionSystem.activeMission = missionId;
  missionSystem.missionTimer = mission.timeLimit || 0;
  missionSystem.raceCheckpointIndex = 0;
  
  // Reset objectives
  mission.objectives.forEach(o => { o.completed = false; o.dynamicData = null; });
  
  // Setup first objective GPS
  const firstObj = mission.objectives[0];
  if (firstObj.target && firstObj.target.x && firstObj.target.y) {
    world.gpsTarget = { x: firstObj.target.x, y: firstObj.target.y };
    world.gpsRoute = [];
  }
  
  world.addMessage(`Mission Started: ${mission.name}`, 4000);
  
  updateMissionMarkers(missionSystem);
}

function updateMissionMarkers(missionSystem) {
  missionSystem.missionMarkers = [];
  
  for (const mission of Object.values(missionSystem.missions)) {
    if (mission.state === MISSION_STATE.INACTIVE || mission.state === MISSION_STATE.ACTIVE) {
      const marker = {
        id: mission.id,
        x: mission.location.x,
        y: mission.location.y,
        type: mission.type,
        name: mission.name,
        active: mission.state === MISSION_STATE.ACTIVE,
        color: getMissionColor(mission.type),
      };
      missionSystem.missionMarkers.push(marker);
    }
  }
}

function getMissionColor(type) {
  switch (type) {
    case MISSION_TYPE.STORY: return MISSION.types.story.color;
    case MISSION_TYPE.SIDE: return MISSION.types.side.color;
    case MISSION_TYPE.STRANGER: return MISSION.types.stranger.color;
    case MISSION_TYPE.RACE: return MISSION.types.race.color;
    case MISSION_TYPE.ASSASSINATION: return '#ff0000';
    case MISSION_TYPE.HEIST: return '#ffd700';
    default: return '#ffffff';
  }
}

function generateDynamicObjective(mission, obj, world) {
  // Generate dynamic target positions for repeatable missions
  switch (obj.type) {
    case OBJECTIVE_TYPE.GOTO:
    case OBJECTIVE_TYPE.DELIVER:
    case OBJECTIVE_TYPE.KILL:
    case OBJECTIVE_TYPE.DEFEND:
      // Random location on road network
      const attempts = 10;
      for (let i = 0; i < attempts; i++) {
        const sectorX = Math.floor(Math.random() * WORLD.gridSize);
        const sectorY = Math.floor(Math.random() * WORLD.gridSize);
        const pos = findRoadPosition(world, 
          sectorX * WORLD.sectorSize + WORLD.sectorSize / 2,
          sectorY * WORLD.sectorSize + WORLD.sectorSize / 2, 200);
        if (pos.found) {
          return { x: pos.x, y: pos.y };
        }
      }
      // Fallback
      return { x: world.player.x + 500, y: world.player.y + 500 };
      
    case OBJECTIVE_TYPE.STEAL:
      // Find a parked vehicle
      const vehicles = world.vehicles.filter(v => v.active && v.state === 'parked');
      if (vehicles.length > 0) {
        const target = vehicles[Math.floor(Math.random() * vehicles.length)];
        return { x: target.x, y: target.y, targetVehicleId: target.id };
      }
      return { x: world.player.x + 200, y: world.player.y };
      
    default:
      return null;
  }
}

export function getActiveMission(missionSystem) {
  return missionSystem.activeMission ? missionSystem.missions[missionSystem.activeMission] : null;
}

export function getMissionProgress(missionSystem) {
  const active = getActiveMission(missionSystem);
  if (!active) return null;
  
  return {
    name: active.name,
    currentObjective: active.currentObjective + 1,
    totalObjectives: active.objectives.length,
    objectiveText: active.objectives[active.currentObjective]?.text || '',
    timeRemaining: missionSystem.missionTimer > 0 ? missionSystem.missionTimer : null,
  };
}

export function getAvailableMissions(missionSystem) {
  return Object.values(missionSystem.missions).filter(m => m.state === MISSION_STATE.INACTIVE);
}

export function getCompletedMissions(missionSystem) {
  return Array.from(missionSystem.completedMissions).map(id => missionSystem.missions[id]);
}

export function isMissionCompleted(missionSystem, missionId) {
  return missionSystem.completedMissions.has(missionId);
}

export function getMissionStats(missionSystem) {
  return {
    totalCompleted: missionSystem.totalMissionsCompleted,
    totalMoney: missionSystem.totalMoneyEarned,
    totalXP: missionSystem.totalXPEarned,
    storyCompleted: Object.values(MISSION_DATA.story).filter(m => missionSystem.completedMissions.has(m.id)).length,
    sideCompleted: Object.values(MISSION_DATA.side).filter(m => missionSystem.completedMissions.has(m.id)).length,
  };
}