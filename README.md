# Make the best flight game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/0xrifai/makefun-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/0xrifai/makefun-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A flight game built for the [make.fun bounty](https://make.fun/bounty/best-flight-game-20261126-0057):
a chase-view courier plane over procedural terrain, flying through target
rings, managing fuel and damage, landing back on the runway. Keyboard and
mouse, no network, static files under `game/`.

## How to run

Requires Node.js 22.18 or later:

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Hand it in (the grader runs `node main.ts` with `/output` writable):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`.

## Controls

- **W / S** — throttle up / down (the engine answers at every speed)
- **Arrow Up / Down** — pitch up / down
- **Arrow Left / Right** (or **A / D**) — roll and bank into turns
- **Mouse drag** — steer gently and look around the chase view (the camera
  eases back behind the plane when the mouse rests)
- **Enter** — start the flight · **R** — fly again after a crash or a landing
- **P** — pause

Fly through the six glowing rings in order, watch the fuel gauge, and land
on the runway to refuel — hard landings damage the plane, and the hills and
the river end the sortie.
