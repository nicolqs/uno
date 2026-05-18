import { buildDeck, shuffle, cardPoints, isWild, isNumber, COLORS } from './deck.ts';
import { canPlayCard } from './rules.ts';
import type {
  Card,
  CardColor,
  Phase,
  PendingDrawType,
  Player,
  UnoVulnerable,
  AwaitingDrawnChoice,
  GameEvent,
  GameSnapshot,
  RedactedState,
} from './types.ts';

const WIN_SCORE = 500;
const HAND_SIZE = 7;

export class GameRoom {
  phase: Phase = 'lobby';
  players: Player[] = [];
  drawPile: Card[] = [];
  discardPile: Card[] = [];
  activeColor: CardColor | null = null;
  direction: 1 | -1 = 1;
  currentPlayerIdx = 0;
  pendingDraw = 0;
  pendingDrawType: PendingDrawType = null;
  awaitingWildColor = false;
  awaitingDrawnCardChoice: AwaitingDrawnChoice | null = null;
  unoVulnerable: UnoVulnerable | null = null;
  events: GameEvent[] = [];
  eventSeq = 0;
  turnCount = 0;
  lastWinnerId: string | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.phase = 'lobby';
    this.players = [];
    this.drawPile = [];
    this.discardPile = [];
    this.activeColor = null;
    this.direction = 1;
    this.currentPlayerIdx = 0;
    this.pendingDraw = 0;
    this.pendingDrawType = null;
    this.awaitingWildColor = false;
    this.awaitingDrawnCardChoice = null;
    this.unoVulnerable = null;
    this.events = [];
    this.eventSeq = 0;
    this.turnCount = 0;
    this.lastWinnerId = null;
  }

  log(text: string): void {
    this.events.unshift({ id: ++this.eventSeq, ts: Date.now(), text });
    if (this.events.length > 30) this.events.length = 30;
  }

  addPlayer(name: string, socketId: string): { error?: string; playerId?: string } {
    if (this.phase !== 'lobby') {
      return { error: 'Game already started — wait for next round' };
    }
    const trimmed = (name || '').trim().slice(0, 18);
    if (!trimmed) return { error: 'Name required' };
    if (this.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return { error: 'Name already taken' };
    }
    if (this.players.length >= 10) return { error: 'Game is full (10 players max)' };
    const player: Player = {
      id: crypto.randomUUID(),
      name: trimmed,
      socketId,
      connected: true,
      hand: [],
      score: 0,
      hasCalledUno: false,
    };
    this.players.push(player);
    this.log(`${player.name} joined`);
    return { playerId: player.id };
  }

  rejoin(playerId: string, socketId: string): { error?: string; playerId?: string } {
    const p = this.players.find((x) => x.id === playerId);
    if (!p) return { error: 'Unknown player' };
    p.socketId = socketId;
    p.connected = true;
    return { playerId: p.id };
  }

  removeBySocket(socketId: string): void {
    const p = this.players.find((x) => x.socketId === socketId);
    if (!p) return;
    p.connected = false;
  }

  relinkSocket(playerId: string, socketId: string): boolean {
    const p = this.players.find((x) => x.id === playerId);
    if (!p) return false;
    p.socketId = socketId;
    p.connected = true;
    return true;
  }

  startGame(): { ok?: true; error?: string } {
    if (this.phase !== 'lobby') return { error: 'Already in progress' };
    if (this.players.length < 2) return { error: 'Need at least 2 players' };
    this.startRound();
    return { ok: true };
  }

  startRound(): void {
    const deck = shuffle(buildDeck());
    for (const p of this.players) {
      p.hand = deck.splice(0, HAND_SIZE);
      p.hasCalledUno = false;
    }
    let first = deck.shift()!;
    while (!isNumber(first)) {
      deck.push(first);
      shuffle(deck);
      first = deck.shift()!;
    }
    this.discardPile = [first];
    this.drawPile = deck;
    this.activeColor = first.color;
    this.direction = 1;
    this.pendingDraw = 0;
    this.pendingDrawType = null;
    this.awaitingWildColor = false;
    this.awaitingDrawnCardChoice = null;
    this.unoVulnerable = null;
    this.turnCount = 0;
    if (this.lastWinnerId) {
      const idx = this.players.findIndex((p) => p.id === this.lastWinnerId);
      this.currentPlayerIdx = idx >= 0 ? idx : 0;
    } else {
      this.currentPlayerIdx = 0;
    }
    this.phase = 'playing';
    this.log(`Round started — ${this.currentPlayer().name}'s turn`);
  }

  currentPlayer(): Player {
    return this.players[this.currentPlayerIdx];
  }

  topCard(): Card | undefined {
    return this.discardPile[this.discardPile.length - 1];
  }

  advanceTurn(steps = 1): void {
    const n = this.players.length;
    this.currentPlayerIdx = (this.currentPlayerIdx + steps * this.direction + n * 10) % n;
    this.turnCount += 1;
    if (this.unoVulnerable && this.unoVulnerable.openedAtTurn < this.turnCount) {
      this.unoVulnerable = null;
    }
    let guard = 0;
    while (!this.players[this.currentPlayerIdx].connected && guard < n) {
      this.log(`Skipped ${this.players[this.currentPlayerIdx].name} (disconnected)`);
      this.currentPlayerIdx = (this.currentPlayerIdx + this.direction + n) % n;
      this.turnCount += 1;
      guard += 1;
    }
  }

  drawFromPile(n: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) this.recycleDiscard();
      if (this.drawPile.length === 0) break;
      drawn.push(this.drawPile.shift()!);
    }
    return drawn;
  }

  recycleDiscard(): void {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop()!;
    this.drawPile = shuffle(this.discardPile);
    this.discardPile = [top];
    this.log('Reshuffled discard into draw pile');
  }

  playCard(
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
  ): { ok?: true; error?: string } {
    if (this.phase !== 'playing') return { error: 'Not in play' };
    const player = this.currentPlayer();
    if (player.id !== playerId) return { error: 'Not your turn' };
    if (this.awaitingWildColor) return { error: 'Choose a color first' };
    if (this.awaitingDrawnCardChoice) return { error: 'Decide on the drawn card first' };

    const cardIdx = player.hand.findIndex((c) => c.id === cardId);
    if (cardIdx < 0) return { error: 'Card not in hand' };
    const card = player.hand[cardIdx];

    const top = this.topCard();
    if (!top) return { error: 'No top card' };
    if (!canPlayCard(top, this.activeColor, card, this.pendingDrawType)) {
      return { error: 'Card not playable' };
    }

    if (isWild(card)) {
      if (!chosenColor || !COLORS.includes(chosenColor)) return { error: 'Pick a color' };
    }

    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);

    if (player.hand.length !== 1) player.hasCalledUno = false;

    this.applyCardEffect(player, card, chosenColor);

    if (player.hand.length === 0) {
      this.endRound(player);
      return { ok: true };
    }

    if (player.hand.length === 1 && !player.hasCalledUno) {
      this.unoVulnerable = { playerId: player.id, openedAtTurn: this.turnCount };
    }

    return { ok: true };
  }

  applyCardEffect(player: Player, card: Card, chosenColor?: CardColor): void {
    const n = this.players.length;
    if (typeof card.value === 'number') {
      this.activeColor = card.color;
      this.log(`${player.name} played ${labelFor(card)}`);
      this.advanceTurn(1);
      return;
    }
    if (card.value === 'skip') {
      this.activeColor = card.color;
      const nextName = this.players[(this.currentPlayerIdx + this.direction + n) % n].name;
      this.log(`${player.name} skipped ${nextName}`);
      this.advanceTurn(2);
      return;
    }
    if (card.value === 'reverse') {
      this.activeColor = card.color;
      if (n === 2) {
        this.log(`${player.name} played Reverse (acts as Skip)`);
        this.advanceTurn(2);
      } else {
        this.direction = (this.direction * -1) as 1 | -1;
        this.log(`${player.name} reversed direction`);
        this.advanceTurn(1);
      }
      return;
    }
    if (card.value === '+2') {
      this.activeColor = card.color;
      this.pendingDraw += 2;
      this.pendingDrawType = '+2';
      this.log(`${player.name} played +2 (stack: ${this.pendingDraw})`);
      this.advanceTurn(1);
      return;
    }
    if (card.value === 'wild') {
      this.activeColor = chosenColor!;
      this.log(`${player.name} played Wild → ${chosenColor}`);
      this.advanceTurn(1);
      return;
    }
    if (card.value === '+4') {
      this.activeColor = chosenColor!;
      this.pendingDraw += 4;
      this.pendingDrawType = '+4';
      this.log(`${player.name} played Wild +4 → ${chosenColor} (stack: ${this.pendingDraw})`);
      this.advanceTurn(1);
      return;
    }
  }

  drawCard(playerId: string): { ok?: true; error?: string } {
    if (this.phase !== 'playing') return { error: 'Not in play' };
    const player = this.currentPlayer();
    if (player.id !== playerId) return { error: 'Not your turn' };
    if (this.awaitingDrawnCardChoice) return { error: 'Decide on drawn card first' };

    if (this.pendingDraw > 0) {
      const drawn = this.drawFromPile(this.pendingDraw);
      player.hand.push(...drawn);
      this.log(`${player.name} drew ${drawn.length} card${drawn.length === 1 ? '' : 's'}`);
      player.hasCalledUno = false;
      this.pendingDraw = 0;
      this.pendingDrawType = null;
      this.advanceTurn(1);
      return { ok: true };
    }

    const [card] = this.drawFromPile(1);
    if (!card) {
      this.log(`${player.name} tried to draw but pile is empty`);
      this.advanceTurn(1);
      return { ok: true };
    }
    player.hand.push(card);
    this.log(`${player.name} drew a card`);
    player.hasCalledUno = false;

    const top = this.topCard();
    if (top && canPlayCard(top, this.activeColor, card, this.pendingDrawType)) {
      this.awaitingDrawnCardChoice = { playerId: player.id, cardId: card.id };
      return { ok: true };
    }
    this.advanceTurn(1);
    return { ok: true };
  }

  playDrawnCard(
    playerId: string,
    play: boolean,
    chosenColor?: CardColor,
  ): { ok?: true; error?: string } {
    if (this.phase !== 'playing') return { error: 'Not in play' };
    if (!this.awaitingDrawnCardChoice || this.awaitingDrawnCardChoice.playerId !== playerId) {
      return { error: 'No drawn card pending' };
    }
    const cardId = this.awaitingDrawnCardChoice.cardId;
    this.awaitingDrawnCardChoice = null;
    if (!play) {
      this.advanceTurn(1);
      return { ok: true };
    }
    return this.playCard(playerId, cardId, chosenColor);
  }

  callUno(playerId: string): { ok?: true; error?: string } {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { error: 'Unknown player' };
    if (player.hand.length > 2) return { error: 'Too many cards to call UNO' };
    player.hasCalledUno = true;
    if (this.unoVulnerable && this.unoVulnerable.playerId === playerId) {
      this.unoVulnerable = null;
    }
    this.log(`${player.name} called UNO!`);
    return { ok: true };
  }

  callOutUno(callerId: string, targetId: string): { ok?: true; error?: string } {
    if (!this.unoVulnerable || this.unoVulnerable.playerId !== targetId) {
      return { error: 'Too late' };
    }
    const target = this.players.find((p) => p.id === targetId);
    if (!target) return { error: 'Unknown target' };
    const penalty = this.drawFromPile(2);
    target.hand.push(...penalty);
    target.hasCalledUno = false;
    this.unoVulnerable = null;
    const caller = this.players.find((p) => p.id === callerId);
    this.log(`${caller ? caller.name : 'Someone'} caught ${target.name} not calling UNO — +2`);
    return { ok: true };
  }

  endRound(winner: Player): void {
    let total = 0;
    for (const p of this.players) {
      if (p.id === winner.id) continue;
      for (const c of p.hand) total += cardPoints(c);
    }
    winner.score += total;
    this.lastWinnerId = winner.id;
    this.log(`${winner.name} won the round (+${total} pts, total ${winner.score})`);
    this.phase = winner.score >= WIN_SCORE ? 'gameOver' : 'roundEnd';
    this.unoVulnerable = null;
  }

  nextRound(): { ok?: true; error?: string } {
    if (this.phase !== 'roundEnd') return { error: 'Not at round end' };
    this.startRound();
    return { ok: true };
  }

  playAgain(): { ok?: true; error?: string } {
    if (this.phase !== 'gameOver') return { error: 'Game not over' };
    for (const p of this.players) p.score = 0;
    this.lastWinnerId = null;
    this.startRound();
    return { ok: true };
  }

  snapshot(): GameSnapshot {
    return {
      v: 1,
      phase: this.phase,
      players: this.players,
      drawPile: this.drawPile,
      discardPile: this.discardPile,
      activeColor: this.activeColor,
      direction: this.direction,
      currentPlayerIdx: this.currentPlayerIdx,
      pendingDraw: this.pendingDraw,
      pendingDrawType: this.pendingDrawType,
      awaitingWildColor: this.awaitingWildColor,
      awaitingDrawnCardChoice: this.awaitingDrawnCardChoice,
      unoVulnerable: this.unoVulnerable,
      events: this.events,
      eventSeq: this.eventSeq,
      turnCount: this.turnCount,
      lastWinnerId: this.lastWinnerId,
    };
  }

  restore(s: GameSnapshot): void {
    if (!s || s.v !== 1) return;
    this.phase = s.phase;
    this.players = s.players;
    this.drawPile = s.drawPile;
    this.discardPile = s.discardPile;
    this.activeColor = s.activeColor;
    this.direction = s.direction;
    this.currentPlayerIdx = s.currentPlayerIdx;
    this.pendingDraw = s.pendingDraw;
    this.pendingDrawType = s.pendingDrawType;
    this.awaitingWildColor = s.awaitingWildColor;
    this.awaitingDrawnCardChoice = s.awaitingDrawnCardChoice;
    this.unoVulnerable = s.unoVulnerable;
    this.events = s.events;
    this.eventSeq = s.eventSeq ?? s.events.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
    this.turnCount = s.turnCount;
    this.lastWinnerId = s.lastWinnerId;
  }

  syncConnectivity(aliveSocketIds: Set<string>): void {
    for (const p of this.players) {
      if (p.socketId && aliveSocketIds.has(p.socketId)) {
        p.connected = true;
      } else {
        p.connected = false;
        p.socketId = null;
      }
    }
  }

  redactedStateFor(playerId: string | null): RedactedState {
    const me = playerId ? this.players.find((p) => p.id === playerId) || null : null;
    const top = this.topCard();
    return {
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: p.score,
        cardCount: p.hand.length,
        hasCalledUno: p.hasCalledUno,
      })),
      myHand: me ? me.hand : null,
      myId: playerId || null,
      topCard: top || null,
      activeColor: this.activeColor,
      direction: this.direction,
      currentPlayerId: this.currentPlayer() ? this.currentPlayer().id : null,
      pendingDraw: this.pendingDraw,
      pendingDrawType: this.pendingDrawType,
      drawPileCount: this.drawPile.length,
      awaitingWildColor: this.awaitingWildColor,
      awaitingDrawnCard:
        this.awaitingDrawnCardChoice && this.awaitingDrawnCardChoice.playerId === playerId
          ? findCardInHand(me, this.awaitingDrawnCardChoice.cardId)
          : null,
      unoVulnerable: this.unoVulnerable ? this.unoVulnerable.playerId : null,
      events: this.events.slice(0, 10),
    };
  }
}

function findCardInHand(player: Player | null, cardId: string): Card | null {
  if (!player) return null;
  return player.hand.find((c) => c.id === cardId) || null;
}

function labelFor(card: Card): string {
  if (typeof card.value === 'number') {
    return `${cap(card.color)} ${card.value}`;
  }
  if (card.value === 'wild') return 'Wild';
  if (card.value === '+4') return 'Wild +4';
  if (card.value === '+2') return `${cap(card.color)} +2`;
  return `${cap(card.color)} ${cap(card.value)}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
