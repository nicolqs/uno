import { useState } from 'react';
import type { Card as CardType, CardColor } from '../types';
import Card from './Card';
import ColorPicker from './ColorPicker';

interface DrawnCardPromptProps {
  card: CardType;
  onDecide: (play: boolean, chosenColor: CardColor | null) => void;
}

export default function DrawnCardPrompt({ card, onDecide }: DrawnCardPromptProps) {
  const [pickingColor, setPickingColor] = useState(false);

  const playClicked = () => {
    if (card.color === 'wild') setPickingColor(true);
    else onDecide(true, null);
  };

  if (pickingColor) {
    return (
      <ColorPicker onPick={(c) => onDecide(true, c)} onCancel={() => setPickingColor(false)} />
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="m-0 mb-4 text-lg">You drew this — play it?</h3>
        <div className="flex justify-center my-3 mb-5">
          <Card card={card} />
        </div>
        <div className="flex gap-3 justify-center">
          <button type="button" className="btn btn-green" onClick={playClicked}>
            Play
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onDecide(false, null)}>
            Keep
          </button>
        </div>
      </div>
    </div>
  );
}
