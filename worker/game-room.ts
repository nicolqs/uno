import { GameRoom as GameLogic } from '../server/game.ts';
import type { ClientMessage, LanInfo, ServerMessage } from '../server/types.ts';
import type { Env } from './index.ts';

interface SocketAttachment {
  socketId: string;
  playerId: string | null;
}

const STORAGE_KEY = 'game/v1';

export class GameRoom {
  state: DurableObjectState;
  env: Env;
  game: GameLogic;
  lanInfo: LanInfo | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.game = new GameLogic();
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get(STORAGE_KEY);
      if (stored) this.game.restore(stored as Parameters<GameLogic['restore']>[0]);
      const alive = new Set<string>();
      for (const ws of this.state.getWebSockets()) {
        const data = ws.deserializeAttachment() as SocketAttachment | undefined;
        if (data?.socketId) alive.add(data.socketId);
      }
      this.game.syncConnectivity(alive);
    });
  }

  async persist(): Promise<void> {
    await this.state.storage.put(STORAGE_KEY, this.game.snapshot());
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    this.captureLanInfo(request);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const data: SocketAttachment = { socketId: crypto.randomUUID(), playerId: null };
    server.serializeAttachment(data);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  captureLanInfo(req: Request): void {
    if (this.lanInfo) return;
    const url = new URL(req.url);
    const proto = url.protocol === 'http:' ? 'http' : 'https';
    this.lanInfo = {
      lan: url.host,
      playerUrl: `${proto}://${url.host}/`,
      hostUrl: `${proto}://${url.host}/host`,
    };
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const data = ws.deserializeAttachment() as SocketAttachment;
    await this.handleMessage(ws, data, text);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const data = ws.deserializeAttachment() as SocketAttachment;
    this.game.removeBySocket(data.socketId);
    this.broadcast();
    await this.persist();
  }

  webSocketError(): void {
    // ignore
  }

  send(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  broadcast(): void {
    for (const ws of this.state.getWebSockets()) {
      const data = ws.deserializeAttachment() as SocketAttachment;
      const s = this.game.redactedStateFor(data.playerId);
      if (this.lanInfo) s.lan = this.lanInfo;
      this.send(ws, { type: 'state', state: s });
    }
  }

  async handleMessage(ws: WebSocket, data: SocketAttachment, raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const reply = (result: unknown) => {
      if ('requestId' in msg && msg.requestId) {
        this.send(ws, { type: 'response', requestId: msg.requestId, result });
      }
    };
    const persistAttachment = () => ws.serializeAttachment(data);

    switch (msg.type) {
      case 'hello': {
        if (data.playerId) {
          const relinked = this.game.relinkSocket(data.playerId, data.socketId);
          if (!relinked) {
            data.playerId = null;
            persistAttachment();
          }
        }
        const s = this.game.redactedStateFor(data.playerId);
        if (this.lanInfo) s.lan = this.lanInfo;
        this.send(ws, { type: 'state', state: s });
        reply({ ok: true });
        if (data.playerId) {
          this.broadcast();
          await this.persist();
        }
        return;
      }
      case 'join': {
        const result = this.game.addPlayer(msg.name, data.socketId);
        if (result.playerId) {
          data.playerId = result.playerId;
          persistAttachment();
        }
        reply(result);
        this.broadcast();
        await this.persist();
        return;
      }
      case 'rejoin': {
        const result = this.game.rejoin(msg.playerId, data.socketId);
        if (result.playerId) {
          data.playerId = result.playerId;
          persistAttachment();
        }
        reply(result);
        this.broadcast();
        await this.persist();
        return;
      }
      case 'startGame': {
        reply(this.game.startGame());
        this.broadcast();
        await this.persist();
        return;
      }
      case 'playCard': {
        const result = this.game.playCard(data.playerId ?? '', msg.cardId, msg.chosenColor);
        reply(result);
        this.broadcast();
        await this.persist();
        return;
      }
      case 'drawCard': {
        reply(this.game.drawCard(data.playerId ?? ''));
        this.broadcast();
        await this.persist();
        return;
      }
      case 'playDrawnCard': {
        reply(this.game.playDrawnCard(data.playerId ?? '', msg.play, msg.chosenColor));
        this.broadcast();
        await this.persist();
        return;
      }
      case 'callUno': {
        reply(this.game.callUno(data.playerId ?? ''));
        this.broadcast();
        await this.persist();
        return;
      }
      case 'callOutUno': {
        reply(this.game.callOutUno(data.playerId ?? '', msg.targetId));
        this.broadcast();
        await this.persist();
        return;
      }
      case 'nextRound': {
        reply(this.game.nextRound());
        this.broadcast();
        await this.persist();
        return;
      }
      case 'playAgain': {
        reply(this.game.playAgain());
        this.broadcast();
        await this.persist();
        return;
      }
      case 'newGame': {
        this.game.reset();
        reply({ ok: true });
        this.broadcast();
        await this.persist();
        return;
      }
    }
  }
}
