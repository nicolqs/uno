import { useSyncExternalStore } from 'react';
import type { ActionResult, CardColor, GameState } from './types';

const STORAGE_KEY = 'uno.playerId';
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;

let socket: WebSocket | null = null;
let currentState: GameState | null = null;
let isHostRole = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const pending = new Map<string, (result: ActionResult) => void>();

function emit() {
  for (const l of listeners) l();
}

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  const ws = new WebSocket(wsUrl());
  socket = ws;

  ws.addEventListener('open', () => {
    reconnectAttempts = 0;
    sendRaw({ type: 'hello', role: isHostRole ? 'host' : 'player' });
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      call('rejoin', { playerId: stored }).then((resp) => {
        if (resp.error) localStorage.removeItem(STORAGE_KEY);
      });
    }
  });

  ws.addEventListener('message', (e) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === 'state') {
      currentState = msg.state as GameState;
      emit();
    } else if (msg.type === 'response') {
      const requestId = msg.requestId as string;
      const handler = pending.get(requestId);
      if (handler) {
        pending.delete(requestId);
        handler((msg.result as ActionResult) ?? {});
      }
    }
  });

  ws.addEventListener('close', () => {
    socket = null;
    pending.clear();
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    try {
      ws.close();
    } catch {}
  });
}

function sendRaw(msg: object) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

export function ensureSocket(isHost: boolean): void {
  isHostRole = isHost;
  if (!socket) connect();
}

export function useGameState(): GameState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentState,
    () => currentState,
  );
}

function call(type: string, payload: Record<string, unknown> = {}): Promise<ActionResult> {
  return new Promise((resolve) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      resolve({ error: 'No connection' });
      return;
    }
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    pending.set(requestId, resolve);
    sendRaw({ type, requestId, ...payload });
    setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        resolve({ error: 'Timeout' });
      }
    }, 8000);
  });
}

export async function joinGame(name: string): Promise<ActionResult> {
  const resp = await call('join', { name });
  if (resp.playerId) localStorage.setItem(STORAGE_KEY, resp.playerId);
  return resp;
}

export const startGame = () => call('startGame');
export const playCard = (cardId: string, chosenColor?: CardColor | null) =>
  call('playCard', { cardId, chosenColor: chosenColor ?? undefined });
export const drawCard = () => call('drawCard');
export const playDrawnCard = (play: boolean, chosenColor?: CardColor | null) =>
  call('playDrawnCard', { play, chosenColor: chosenColor ?? undefined });
export const callUno = () => call('callUno');
export const callOutUno = (targetId: string) => call('callOutUno', { targetId });
export const nextRound = () => call('nextRound');
export const playAgain = () => call('playAgain');
export const newGame = () => {
  localStorage.removeItem(STORAGE_KEY);
  return call('newGame');
};

export function getStoredPlayerId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredPlayerId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
