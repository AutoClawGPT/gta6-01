# GTA 6: Vesper Bay

Open-world crime game for make.fun bounty **gta6-01**.

## Overview

A top-down 2D open-world game inspired by classic GTA titles, built with vanilla JavaScript (ES modules) and Canvas 2D. Features a full city simulation with districts, traffic, pedestrians, police pursuit system, missions, and a wanted level system.

## Features

- **Open World**: 8192×8192 unit city with 9 districts (Downtown, Little Havana, Vesper Beach, Port Vesper, Everglades, Star Island, Grove District, Airport, Highway Ring)
- **Vehicle System**: Cars, motorcycles, trucks with realistic physics (acceleration, braking, drifting, collision)
- **Traffic AI**: Civilian vehicles follow roads, obey lanes, avoid obstacles
- **Police Pursuit**: 5-star wanted system with escalating response (patrol → SWAT → FBI → helicopters → roadblocks → spike strips)
- **Pedestrians**: Civilians, business people, tourists, gang members with wander/flee/combat behaviors
- **Mission System**: 6 story missions across 3 days + side missions (Taxi, Vigilante, Races, Gang Warfare, Strangers, Assassinations, Heists)
- **HUD**: Minimap with GPS routing, crosshair, wanted stars, health/armor/stamina, money, weapon wheel, compass
- **Time & Weather**: 20-min day/night cycle, dynamic weather (clear, cloudy, rain, storm, fog)
- **Save System**: LocalStorage persistence

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move / Drive |
| Shift | Sprint / Handbrake |
| Space | Enter/Exit Vehicle |
| LMB | Attack / Shoot |
| RMB | Aim |
| 1-6 | Switch Weapon |
| R | Reload |
| E | Interact / Mission |
| M | Toggle Full Map |
| Esc | Pause |
| \` | Cheat Console |

## Cheats

Open console with `\`` then type:
- `health` — Full health & armor
- `weapons` — All weapons max ammo
- `wanted0` — Clear wanted level
- `wanted5` — Max wanted level
- `spawncar` — Spawn sports car
- `spawnbike` — Spawn motorcycle
- `time` — Advance time 1 hour
- `weather` — Toggle weather
- `save` — Save game
- `load` — Load game

## Screenshots

Required screenshots in `screenshots/`:
- `cover.png` — Driving + traffic + 3-star wanted + mission objective
- `city.png` — Parked view of city districts
- `chase.png` — On foot vs police pursuit
- `arrest.png` — Arrest/busted scene

## Development

```bash
# Start dev server
node serve.ts

# Capture screenshots (requires server running)
node capture-screenshots.mjs
```

## Architecture

```
game/
├── index.html          # Entry point with importmap
├── src/
│   ├── config.js       # All tuning constants
│   ├── random.js       # Seeded RNG & noise
│   ├── world.js        # Core simulation (player, world step, entities)
│   ├── vehicles.js     # Vehicle physics & AI
│   ├── police.js       # Wanted system & police AI
│   ├── missions.js     # Mission definitions & objectives
│   ├── hud.js          # HUD rendering
│   ├── render.js       # World rendering (roads, buildings, entities)
│   ├── shots.js        # Screenshot scene staging
│   └── main.js         # Game loop & initialization
└── screenshots/        # Output screenshots
```

## Tech Stack

- **Runtime**: Node.js 22+ (ES modules)
- **Graphics**: Canvas 2D API
- **Server**: TypeScript/Node HTTP server (`serve.ts`)
- **Testing**: Playwright for screenshot capture
- **No build step** — runs directly in browser via ES modules

## License

MIT — Original work for make.fun bounty gta6-01.