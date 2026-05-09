import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import qrcode from 'qrcode';
import type { ServerWebSocket } from 'bun';
import { GameRoom } from './game.ts';
import type { ClientMessage, LanInfo, ServerMessage } from './types.ts';

interface SocketData {
  socketId: string;
  playerId: string | null;
}

const PORT = Number(process.env.PORT) || 3000;
const distDir = path.resolve(import.meta.dir, '..', 'dist');

const game = new GameRoom();
const sockets = new Set<ServerWebSocket<SocketData>>();
let lanInfo: LanInfo = { lan: 'localhost', playerUrl: '', qrDataUrl: '' };

const app = new Hono();
app.use('/*', serveStatic({ root: path.relative(process.cwd(), distDir) }));
app.get('*', serveStatic({ path: path.relative(process.cwd(), path.join(distDir, 'index.html')) }));

function send(ws: ServerWebSocket<SocketData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function broadcastState(): void {
  for (const ws of sockets) {
    const s = game.redactedStateFor(ws.data.playerId);
    s.lan = lanInfo;
    send(ws, { type: 'state', state: s });
  }
}

function handleMessage(ws: ServerWebSocket<SocketData>, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    return;
  }
  const reply = (result: any) => {
    if (msg.requestId) {
      send(ws, { type: 'response', requestId: msg.requestId, result });
    }
  };

  switch (msg.type) {
    case 'hello': {
      const s = game.redactedStateFor(ws.data.playerId);
      s.lan = lanInfo;
      send(ws, { type: 'state', state: s });
      reply({ ok: true });
      return;
    }
    case 'join': {
      const result = game.addPlayer(msg.name, ws.data.socketId);
      if (result.playerId) ws.data.playerId = result.playerId;
      reply(result);
      broadcastState();
      return;
    }
    case 'rejoin': {
      const result = game.rejoin(msg.playerId, ws.data.socketId);
      if (result.playerId) ws.data.playerId = result.playerId;
      reply(result);
      broadcastState();
      return;
    }
    case 'startGame': {
      reply(game.startGame());
      broadcastState();
      return;
    }
    case 'playCard': {
      const result = game.playCard(ws.data.playerId ?? '', msg.cardId, msg.chosenColor);
      reply(result);
      broadcastState();
      return;
    }
    case 'drawCard': {
      reply(game.drawCard(ws.data.playerId ?? ''));
      broadcastState();
      return;
    }
    case 'playDrawnCard': {
      const result = game.playDrawnCard(ws.data.playerId ?? '', msg.play, msg.chosenColor);
      reply(result);
      broadcastState();
      return;
    }
    case 'callUno': {
      reply(game.callUno(ws.data.playerId ?? ''));
      broadcastState();
      return;
    }
    case 'callOutUno': {
      reply(game.callOutUno(ws.data.playerId ?? '', msg.targetId));
      broadcastState();
      return;
    }
    case 'nextRound': {
      reply(game.nextRound());
      broadcastState();
      return;
    }
    case 'playAgain': {
      reply(game.playAgain());
      broadcastState();
      return;
    }
    case 'newGame': {
      game.reset();
      reply({ ok: true });
      broadcastState();
      return;
    }
  }
}

function getLanIP(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const lan = getLanIP();
const playerUrl = `http://${lan}:${PORT}/`;
const hostUrl = `http://${lan}:${PORT}/host`;
let qrTerm = '';
let qrDataUrl = '';
try {
  qrTerm = await qrcode.toString(playerUrl, { type: 'terminal', small: true });
  qrDataUrl = await qrcode.toDataURL(playerUrl, { width: 320, margin: 1 });
} catch {}
lanInfo = { lan, playerUrl, hostUrl, qrDataUrl };

const server = Bun.serve<SocketData>({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = srv.upgrade(req, {
        data: { socketId: randomUUID(), playerId: null },
      });
      if (upgraded) return undefined;
      return new Response('Upgrade failed', { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
    },
    message(ws, message) {
      handleMessage(ws, typeof message === 'string' ? message : message.toString());
    },
    close(ws) {
      sockets.delete(ws);
      game.removeBySocket(ws.data.socketId);
      broadcastState();
    },
  },
});

console.log('');
console.log('  ╔══════════════════════════════════════════╗');
console.log('  ║  UNO is running                          ║');
console.log('  ╠══════════════════════════════════════════╣');
console.log(`  ║  Host display:  ${hostUrl}`);
console.log(`  ║  Players join:  ${playerUrl}`);
console.log('  ╚══════════════════════════════════════════╝');
console.log('');
if (qrTerm) console.log(qrTerm);
console.log(`Listening on :${server.port}`);
