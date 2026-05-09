import type { Card, CardColor, CardValue } from './types.ts';

export const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue'];
export const ACTION_VALUES: CardValue[] = ['skip', 'reverse', '+2'];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const color of COLORS) {
    cards.push(makeCard(color, 0));
    for (let n = 1; n <= 9; n++) {
      cards.push(makeCard(color, n));
      cards.push(makeCard(color, n));
    }
    for (const v of ACTION_VALUES) {
      cards.push(makeCard(color, v));
      cards.push(makeCard(color, v));
    }
  }
  for (let i = 0; i < 4; i++) cards.push(makeCard('wild', 'wild'));
  for (let i = 0; i < 4; i++) cards.push(makeCard('wild', '+4'));
  return cards;
}

function makeCard(color: CardColor, value: CardValue): Card {
  return { id: crypto.randomUUID(), color, value };
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardPoints(card: Card): number {
  if (typeof card.value === 'number') return card.value;
  if (card.value === 'skip' || card.value === 'reverse' || card.value === '+2') return 20;
  return 50;
}

export function isWild(card: Card): boolean {
  return card.color === 'wild';
}

export function isNumber(card: Card): boolean {
  return typeof card.value === 'number';
}
