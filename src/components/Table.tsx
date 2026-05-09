import type { Card as CardType, CardColor } from '../types';
import Card from './Card';

interface TableProps {
  topCard: CardType | null;
  activeColor: CardColor | null;
  direction: 1 | -1;
  drawPileCount: number;
  pendingDraw: number;
  onDraw: () => void;
  canDraw: boolean;
}

export default function Table({
  topCard,
  activeColor,
  direction,
  drawPileCount,
  pendingDraw,
  onDraw,
  canDraw,
}: TableProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 relative">
      <div className="flex items-center gap-6">
        <div className="relative flex items-center justify-center">
          <Card card={topCard} />
          <div className="absolute -bottom-[22px] left-0 right-0 text-center text-xs opacity-70">
            discard
          </div>
        </div>
        <div
          className={`relative flex items-center justify-center ${
            canDraw ? 'cursor-pointer active:scale-[0.96]' : ''
          }`}
          onClick={canDraw ? onDraw : undefined}
        >
          <Card faceDown />
          <div className="absolute -bottom-[22px] left-0 right-0 text-center text-xs opacity-70">
            {drawPileCount} left
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[13px] mt-4 opacity-80">
        <span className="color-dot" data-color={activeColor ?? undefined} />
        <span>{activeColor || '—'}</span>
        <span className="text-lg opacity-60">{direction === 1 ? '↻' : '↺'}</span>
      </div>
      {pendingDraw > 0 && (
        <div className="bg-uno-red text-white px-3 py-1.5 rounded-full font-bold text-[13px] mt-2">
          +{pendingDraw} stacked — play another or draw!
        </div>
      )}
    </div>
  );
}
