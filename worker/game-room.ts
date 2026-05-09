import { GameRoom as GameLogic } from '../server/game.ts';
import type { ClientMessage, LanInfo, ServerMessage } from '../server/types.ts';
import type { Env } from './index.ts';

interface SocketAttachment {
  socketId: string;
  playerId: string | null;
}

export class GameRoom {
  state: DurableObjectState;
  env: Env;
  game: GameLogic;
  lanInfo: LanInfo | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.game = new GameLogic();
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

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const data = ws.deserializeAttachment() as SocketAttachment;
    this.handleMessage(ws, data, text);
  }

  webSocketClose(ws: WebSocket): void {
    const data = ws.deserializeAttachment() as SocketAttachment;
    this.game.removeBySocket(data.socketId);
    this.broadcast();
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

  handleMessage(ws: WebSocket, data: SocketAttachment, raw: string): void {
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
        const s = this.game.redactedStateFor(data.playerId);
        if (this.lanInfo) s.lan = this.lanInfo;
        this.send(ws, { type: 'state', state: s });
        reply({ ok: true });
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
        return;
      }
      case 'startGame': {
        reply(this.game.startGame());
        this.broadcast();
        return;
      }
      case 'playCard': {
        const result = this.game.playCard(data.playerId ?? '', msg.cardId, msg.chosenColor);
        reply(result);
        this.broadcast();
        return;
      }
      case 'drawCard': {
        reply(this.game.drawCard(data.playerId ?? ''));
        this.broadcast();
        return;
      }
      case 'playDrawnCard': {
        reply(this.game.playDrawnCard(data.playerId ?? '', msg.play, msg.chosenColor));
        this.broadcast();
        return;
      }
      case 'callUno': {
        reply(this.game.callUno(data.playerId ?? ''));
        this.broadcast();
        return;
      }
      case 'callOutUno': {
        reply(this.game.callOutUno(data.playerId ?? '', msg.targetId));
        this.broadcast();
        return;
      }
      case 'nextRound': {
        reply(this.game.nextRound());
        this.broadcast();
        return;
      }
      case 'playAgain': {
        reply(this.game.playAgain());
        this.broadcast();
        return;
      }
      case 'newGame': {
        this.game.reset();
        reply({ ok: true });
        this.broadcast();
        return;
      }
    }
  }
}
