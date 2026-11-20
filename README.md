# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/AutoClawGPT/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/AutoClawGPT/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## About

**GTA 6: Vesper Bay** is a browser-playable 2D open-world crime game inspired by classic GTA titles. Explore a sun-soaked coastal city on foot and by car, steal vehicles, face traffic and police wanted levels, complete missions and story beats, and use a HUD with minimap — all from static files playable offline.

**Controls** — see `game/index.html` for on-screen controls, or refer to the table below:

### Movement
- **W/A/S/D** / Arrow keys: Move / Drive
- **Shift**: Sprint / Handbrake

### Combat
- **LMB**: Attack / Shoot
- **RMB**: Aim
- **1-6**: Switch Weapon
- **R**: Reload

### Interaction
- **E**: Interact / Start Mission
- **M**: Toggle Full Map
- **Esc**: Pause

### Cheats
- **~**: Cheat Console
- **health**: Full Health & Armor
- **weapons**: All Weapons
- **wanted0**: Clear Wanted Level
- **spawncar**: Spawn Sports Car

### Features
- **Open-world exploration** across 9 distinct districts from Downtown to Vice Beach
- **Vehicle theft** — enter and drive any vehicle, including cars, motorcycles, and trucks
- **Wanted system** — 5-star police pursuit with AI patrol cars, roadblocks, and helicopters
- **Mission system** — story missions, side tasks, races, and stranger encounters
- **Dynamic weather** — clear, cloudy, rain, storm, and fog with smooth transitions
- **Day/night cycle** — 20-minute real-time cycle spanning 24 hours of game time
- **HUD** — minimap, wanted stars, health/armor bars, GPS compass, money display
- **Screenshot system** — 4 staged scenes (cover, city, chase, arrest) for the make.fun dossier

### Districts
| District | Type | Danger |
|---|---|---|
| Downtown | Urban | 1 |
| Little Havana | Residential | 2 |
| Vice Beach | Beach | 1 |
| Port Vice | Industrial | 3 |
| Everglades | Wilderness | 2 |
| Star Island | Luxury | 1 |
| Grove District | Gang | 4 |
| Airport | Airport | 2 |
| Highway Ring | Highway (full map) | 1 |

### Tips
- Stay on main roads for better AI vehicle behavior and faster travel
- Keep an eye on your wanted level — hide from police line of sight to reduce stars
- Save your stamina — sprinting depletes it faster, but it regenerates when walking
- Health and armor can be restored via pickups scattered across the city
- Completed story missions unlock side missions and new districts
- Use the minimap to locate objectives, districts, and GPS routes
- Cheat codes can be entered anytime from the console (~ key)

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

To generate the submission dossier locally:

```sh
mkdir -p /tmp/gta6out4 && MAKEFUN_OUTPUT_DIR=/tmp/gta6out4 node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kpx24mt0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
