import type { Card, CardColor, PendingDrawType } from './types';

export function canPlayCard(
  top: Card | null,
  activeColor: CardColor | null,
  card: Card,
  pendingDrawType: PendingDrawType,
): boolean {
  if (!top || !card) return false;
  if (pendingDrawType === '+2') return card.value === '+2';
  if (pendingDrawType === '+4') return card.value === '+4';
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (top.color !== 'wild' && card.value === top.value) return true;
  return false;
}
