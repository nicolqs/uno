# UNO

A real-time multiplayer UNO card game you run on your laptop and play from your phones over local Wi-Fi.

![Host display](docs/screenshots/01-host.png)

## Features

- **Open laptop, scan QR, play.** No accounts, no rooms, no setup.
- **All official rules** — Skip, Reverse, +2, Wild, Wild +4, UNO calls, call-outs.
- **+2 / +4 stacking** (same-type only) — house rule enabled.
- **Draw-and-play-if-matches** — official rule enabled.
- **Real UNO card visuals** — pure CSS, no images, scales perfectly on phones.
- **Mobile-first** — big tap targets, horizontal-scroll hand, color picker for Wilds.
- **Refresh-rejoin** — reload your phone mid-game and you keep your seat.

## Tech stack

| | |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Realtime | Native WebSocket |
| Frontend | React 19 + Vite 6 + TypeScript |
| Styling | Tailwind v4 + custom CSS for cards |
| Lint/format | [Biome](https://biomejs.dev) |

## Quick start

```bash
bun install
bun start
```

The terminal prints the QR code and two URLs:

```
Host display:  http://192.168.x.x:3000/host
Players join:  http://192.168.x.x:3000/
```

1. Open the host URL on your laptop in a browser (the **table** view with the QR).
2. On every phone (same Wi-Fi): scan the QR, type a name, tap **Join**.
3. Once at least 2 players are in, anyone taps **Start game**.

## Screenshots

| Phone — join | Phone — lobby | Phone — playing |
|:---:|:---:|:---:|
| ![Join](docs/screenshots/02-join.png) | ![Lobby](docs/screenshots/03-lobby.png) | ![Playing](docs/screenshots/04-game.png) |

| Laptop — table view |
|:---:|
| ![Host playing](docs/screenshots/05-host-playing.png) |

## Rules

Standard UNO (108-card deck). Two house tweaks active:

- **Stacking** +2 / +4 (a +2 onto a +2, a +4 onto a +4) — chain accumulates until someone draws.
- **Draw-and-play-if-matches** — when you can't play, you draw 1; if it matches you may play it immediately.

Wild Draw Four challenge is off; first-flip action cards are reshuffled until a number turns up. First to 500 points wins.

## Scripts

```bash
bun dev          # vite dev server + bun --watch on the server
bun start        # vite build + serve dist/ + WebSocket on :3000
bun run build    # production build
bun run typecheck
bun run check    # biome lint + format
```

## Project layout

```
server/   ── deck.ts, rules.ts, game.ts, server.ts (Hono + Bun WS)
src/      ── React app (player + host screens) + shared types + native WS client
docs/     ── screenshots
```

## Stuck?

- Both `/host` and the join page have a **Reset** button if a previous session left phantom seats.
- Default port is `3000` — set `PORT=4000 bun start` to change.
- Phones must be on the **same Wi-Fi** as the laptop. Captive-portal Wi-Fi (hotels, conferences) often blocks LAN-to-LAN.

## License

MIT.
