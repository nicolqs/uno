export interface Env {
  GAME: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.GAME.idFromName('global');
      const stub = env.GAME.get(id);
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export { GameRoom } from './game-room.ts';
