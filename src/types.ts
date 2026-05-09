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

export interface RedactedPlayer {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  cardCount: number;
  hasCalledUno: boolean;
}

export interface GameEvent {
  ts: number;
  text: string;
}

export interface LanInfo {
  lan: string;
  playerUrl: string;
  hostUrl?: string;
  qrDataUrl: string;
}

export interface GameState {
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

export interface ActionResult {
  ok?: true;
  error?: string;
  playerId?: string;
}
