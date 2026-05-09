import { useState } from 'react';
import { newGame, nextRound, playAgain, startGame } from '../socket';
import type { GameState, Phase } from '../types';
import Card from './Card';

export default function HostScreen({ state }: { state: GameState }) {
  const lan = state.lan || { qrDataUrl: '', playerUrl: '' };
  const qrSrc = lan.qrDataUrl || '';
  const playerUrl = lan.playerUrl || `${window.location.origin}/`;

  return (
    <div className="host-grid grid grid-cols-[1fr_320px] grid-rows-1 h-dvh p-4 gap-4">
      <div className="flex flex-col gap-4 min-w-0 items-center justify-center">
        {state.phase === 'lobby' && <LobbyMain state={state} />}
        {state.phase === 'playing' && <PlayMain state={state} />}
        {(state.phase === 'roundEnd' || state.phase === 'gameOver') && <EndMain state={state} />}
      </div>

      <div className="host-side flex flex-col gap-4 bg-black/30 rounded-2xl p-4 overflow-hidden">
        <div className="bg-white rounded-xl p-3 flex flex-col items-center gap-2">
          {qrSrc && <img src={qrSrc} alt="Join QR" className="w-full h-auto max-w-[260px]" />}
          <div className="text-[#222] text-xs font-mono">{playerUrl}</div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 text-[13px]">
          {(state.events || []).map((e) => (
            <div key={e.ts} className="px-2.5 py-1.5 bg-white/5 rounded-lg">
              {e.text}
            </div>
          ))}
        </div>
        <ResetButton phase={state.phase} />
      </div>
    </div>
  );
}

function ResetButton({ phase }: { phase: Phase }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-ghost text-[13px] px-3.5 py-2 min-h-9 min-w-0"
        onClick={() => setConfirming(true)}
      >
        {phase === 'lobby' ? 'Reset lobby' : 'Reset game'}
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn btn-red text-[13px] px-3.5 py-2 min-h-9 min-w-0 flex-1"
        onClick={() => {
          newGame();
          setConfirming(false);
        }}
      >
        Confirm reset
      </button>
      <button
        type="button"
        className="btn btn-ghost text-[13px] px-3.5 py-2 min-h-9 min-w-0"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </div>
  );
}

function HostPlayers({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5 justify-center max-w-full">{children}</div>;
}

function HostPlayer({
  name,
  meta,
  active,
  showUno,
  showVuln,
}: {
  name: string;
  meta?: string;
  active?: boolean;
  showUno?: boolean;
  showVuln?: boolean;
}) {
  return (
    <div
      className={`bg-black/35 rounded-xl px-3.5 py-2.5 flex flex-col items-center min-w-[110px] relative ${
        active ? 'bg-uno-yellow/25! border-2 border-uno-yellow' : ''
      }`}
    >
      <span className="font-bold text-base max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
        {name}
      </span>
      {meta && <span className="text-xs opacity-80 mt-1">{meta}</span>}
      {showUno && (
        <span className="absolute -top-2 -right-1.5 bg-uno-red text-white text-[11px] font-extrabold py-0.5 px-1.5 rounded-full">
          UNO
        </span>
      )}
      {showVuln && (
        <span className="absolute -top-2 -right-1.5 bg-[#ff6b00] text-white text-[11px] font-extrabold py-0.5 px-1.5 rounded-full">
          !
        </span>
      )}
    </div>
  );
}

function LobbyMain({ state }: { state: GameState }) {
  const enough = state.players.length >= 2;
  return (
    <>
      <h1 className="uno-text host-title text-[80px] m-0">UNO</h1>
      <div className="text-lg opacity-80">Scan the QR code with your phone to join</div>
      <HostPlayers>
        {state.players.length === 0 && <div className="opacity-50">No players yet…</div>}
        {state.players.map((p) => (
          <HostPlayer key={p.id} name={p.name} meta={p.connected ? 'ready' : 'offline'} />
        ))}
      </HostPlayers>
      {enough && (
        <div className="flex gap-2.5 flex-wrap justify-center">
          <button type="button" className="btn" onClick={() => startGame()}>
            Start game
          </button>
        </div>
      )}
    </>
  );
}

function PlayMain({ state }: { state: GameState }) {
  return (
    <div className="host-table flex flex-col items-center gap-6 [--card-w:140px] [--card-h:224px]">
      <HostPlayers>
        {state.players.map((p) => (
          <HostPlayer
            key={p.id}
            name={p.name}
            meta={`${p.cardCount} card${p.cardCount === 1 ? '' : 's'} • ${p.score} pts`}
            active={state.currentPlayerId === p.id}
            showUno={p.cardCount === 1 && p.hasCalledUno}
            showVuln={state.unoVulnerable === p.id}
          />
        ))}
      </HostPlayers>

      <div className="flex gap-8 items-center">
        <div className="relative flex items-center justify-center">
          <Card card={state.topCard} />
          <div className="absolute -bottom-[22px] left-0 right-0 text-center text-xs opacity-70">
            discard
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <Card faceDown />
          <div className="absolute -bottom-[22px] left-0 right-0 text-center text-xs opacity-70">
            {state.drawPileCount} left
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-lg">
        <span className="color-dot w-7! h-7!" data-color={state.activeColor ?? undefined} />
        <span className="capitalize">{state.activeColor || '—'}</span>
        <span className="text-3xl opacity-60">{state.direction === 1 ? '↻' : '↺'}</span>
        {state.pendingDraw > 0 && (
          <span className="bg-uno-red text-white px-3 py-1.5 rounded-full font-bold text-[13px]">
            +{state.pendingDraw} stacked
          </span>
        )}
      </div>
    </div>
  );
}

function EndMain({ state }: { state: GameState }) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const isOver = state.phase === 'gameOver';
  return (
    <>
      <h1 className="uno-text host-title text-[80px] m-0">
        {isOver ? `${winner.name} wins!` : 'Round complete'}
      </h1>
      <div className="w-full max-w-[480px] flex flex-col gap-1.5">
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
              <span>{p.score} pts</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5 flex-wrap justify-center">
        {isOver ? (
          <>
            <button type="button" className="btn" onClick={() => playAgain()}>
              Play again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => newGame()}>
              New game
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => nextRound()}>
            Next round
          </button>
        )}
      </div>
    </>
  );
}
