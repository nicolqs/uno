export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type ActionValue = 'skip' | 'reverse' | '+2' | '+4' | 'wild';
export type CardValue = number | ActionValue;

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export type Phase = 'lobby' | 'playing' | 'roundEnd' | 'gameOver';

export type PendingDrawType = '+2' | '+4' | null;

export interface Player {
  id: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  hand: Card[];
  score: number;
  hasCalledUno: boolean;
}

export interface UnoVulnerable {
  playerId: string;
  openedAtTurn: number;
}

export interface AwaitingDrawnChoice {
  playerId: string;
  cardId: string;
}

export interface GameEvent {
  ts: number;
  text: string;
}

export interface RedactedPlayer {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  cardCount: number;
  hasCalledUno: boolean;
}

export interface LanInfo {
  lan: string;
  playerUrl: string;
  hostUrl?: string;
}

export interface RedactedState {
  phase: Phase;
  players: RedactedPlayer[];
  myHand: Card[] | null;
  myId: string | null;
  topCard: Card | null;
  activeColor: CardColor | null;
  direction: 1 | -1;
  currentPlayerId: string | null;
  pendingDraw: number;
  pendingDrawType: PendingDrawType;
  drawPileCount: number;
  awaitingWildColor: boolean;
  awaitingDrawnCard: Card | null;
  unoVulnerable: string | null;
  events: GameEvent[];
  lan?: LanInfo;
}

export type Result<T = unknown> = ({ ok: true } & T) | { error: string } | { ok: true };

export interface ClientMessageBase {
  type: string;
  requestId?: string;
}

export type ClientMessage =
  | { type: 'hello'; role: 'host' | 'player'; requestId?: string }
  | { type: 'join'; name: string; requestId: string }
  | { type: 'rejoin'; playerId: string; requestId: string }
  | { type: 'startGame'; requestId: string }
  | { type: 'playCard'; cardId: string; chosenColor?: CardColor; requestId: string }
  | { type: 'drawCard'; requestId: string }
  | { type: 'playDrawnCard'; play: boolean; chosenColor?: CardColor; requestId: string }
  | { type: 'callUno'; requestId: string }
  | { type: 'callOutUno'; targetId: string; requestId: string }
  | { type: 'nextRound'; requestId: string }
  | { type: 'playAgain'; requestId: string }
  | { type: 'newGame'; requestId: string };

export type ServerMessage =
  | { type: 'state'; state: RedactedState }
  | { type: 'response'; requestId: string; result: any };
