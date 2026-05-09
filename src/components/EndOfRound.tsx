import type { GameState } from '../types';

interface EndOfRoundProps {
  state: GameState;
  isGameOver: boolean;
  onNext: () => void;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export default function EndOfRound({
  state,
  isGameOver,
  onNext,
  onPlayAgain,
  onNewGame,
}: EndOfRoundProps) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="p-6 flex flex-col h-full items-center justify-center gap-4">
      <h2 className="m-0 text-2xl">{isGameOver ? `🏆 ${winner.name} wins!` : 'Round complete'}</h2>
      <div className="w-full max-w-[360px] flex flex-col gap-1.5">
        {sorted.map((p) => {
          const isWinner = p.id === winner.id;
          return (
            <div
              key={p.id}
              className={`flex justify-between px-3.5 py-2.5 rounded-[10px] ${
                isWinner ? 'bg-uno-yellow/25 border-[1.5px] border-uno-yellow' : 'bg-black/30'
              }`}
            >
              <span>{p.name}</span>
              <span>{p.score}</span>
            </div>
          );
        })}
      </div>
      {isGameOver ? (
        <div className="flex gap-3">
          <button type="button" className="btn" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNewGame}>
            New game
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={onNext}>
          Next round
        </button>
      )}
    </div>
  );
}
