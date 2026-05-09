import { isWild } from './deck.ts';
import type { Card, CardColor, PendingDrawType } from './types.ts';

export function canPlayCard(
  top: Card,
  activeColor: CardColor | null,
  card: Card,
  pendingDrawType: PendingDrawType,
): boolean {
  if (pendingDrawType === '+2') return card.value === '+2';
  if (pendingDrawType === '+4') return card.value === '+4';
  if (isWild(card)) return true;
  if (card.color === activeColor) return true;
  if (!isWild(top) && card.value === top.value) return true;
  return false;
}

export function hasPlayable(
  hand: Card[],
  top: Card,
  activeColor: CardColor | null,
  pendingDrawType: PendingDrawType,
): boolean {
  return hand.some((c) => canPlayCard(top, activeColor, c, pendingDrawType));
}
