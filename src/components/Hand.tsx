import { useState } from 'react';
import { canPlayCard } from '../rules-client';
import type { Card as CardType, CardColor, PendingDrawType } from '../types';
import Card from './Card';

interface HandProps {
  hand: CardType[];
  top: CardType | null;
  activeColor: CardColor | null;
  pendingDrawType: PendingDrawType;
  isMyTurn: boolean;
  onPlay: (card: CardType) => void;
}

export default function Hand({
  hand,
  top,
  activeColor,
  pendingDrawType,
  isMyTurn,
  onPlay,
}: HandProps) {
  const [shakingId, setShakingId] = useState<string | null>(null);

  const handle = (card: CardType) => {
    if (!isMyTurn) return flash(card.id);
    if (!canPlayCard(top, activeColor, card, pendingDrawType)) return flash(card.id);
    onPlay(card);
  };

  const flash = (id: string) => {
    setShakingId(id);
    setTimeout(() => setShakingId((cur) => (cur === id ? null : cur)), 260);
  };

  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-2 pt-3 pb-4 items-center scrollbar-hide"
      style={{ minHeight: 'calc(var(--card-h) + 24px)', scrollPadding: '12px' }}
    >
      {hand.map((card) => {
        const playable = isMyTurn && canPlayCard(top, activeColor, card, pendingDrawType);
        const cls = `cursor-pointer ${playable ? 'playable' : 'unplayable'} ${
          shakingId === card.id ? 'shake' : ''
        }`;
        return <Card key={card.id} card={card} className={cls} onClick={() => handle(card)} />;
      })}
    </div>
  );
}
