import type { CardColor } from '../types';

const COLORS: Exclude<CardColor, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

interface ColorPickerProps {
  onPick: (color: CardColor) => void;
  onCancel: () => void;
}

export default function ColorPicker({ onPick, onCancel }: ColorPickerProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="m-0 mb-4 text-lg">Choose a color</h3>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className="color-tile"
              data-color={c}
              onClick={() => onPick(c)}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
