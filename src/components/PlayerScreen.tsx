import { useEffect, useRef, useState } from 'react';
import {
  callOutUno,
  callUno,
  drawCard,
  getStoredPlayerId,
  joinGame,
  newGame,
  nextRound,
  playAgain,
  playCard,
  playDrawnCard,
  startGame,
} from '../socket';
import type { Card as CardType, CardColor, GameState, RedactedPlayer } from '../types';
import ColorPicker from './ColorPicker';
import DrawnCardPrompt from './DrawnCardPrompt';
import EndOfRound from './EndOfRound';
import Hand from './Hand';
import Table from './Table';

export default function PlayerScreen({ state }: { state: GameState }) {
  const me = state.players.find((p) => p.id === state.myId) || null;
  const myHand = state.myHand || [];
  const isMyTurn = !!me && state.currentPlayerId === me.id;
  const [pendingWild, setPendingWild] = useState<CardType | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const lastSeenTsRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    const ev = state.events && state.events[0];
    if (!ev) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSeenTsRef.current = ev.ts;
      return;
    }
    if (ev.ts <= lastSeenTsRef.current) return;
    lastSeenTsRef.current = ev.ts;
    setToast(ev.text);
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [state.events]);

  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 2500);
  };

  if (!me && !getStoredPlayerId()) {
    return <JoinScreen onError={flashError} error={error} />;
  }
  if (!me)
    return <div className="grid place-items-center h-full text-lg opacity-70">Reconnecting…</div>;

  if (state.phase === 'lobby') {
    return (
      <Lobby
        state={state}
        me={me}
        onStart={async () => {
          const r = await startGame();
          if (r.error) flashError(r.error);
        }}
      />
    );
  }

  if (state.phase === 'roundEnd' || state.phase === 'gameOver') {
    return (
      <EndOfRound
        state={state}
        isGameOver={state.phase === 'gameOver'}
        onNext={() => nextRound()}
        onPlayAgain={() => playAgain()}
        onNewGame={() => newGame()}
      />
    );
  }

  const handlePlay = async (card: CardType) => {
    if (card.color === 'wild') {
      setPendingWild(card);
      return;
    }
    const r = await playCard(card.id);
    if (r.error) flashError(r.error);
  };

  const handlePickColor = async (color: CardColor) => {
    const card = pendingWild;
    setPendingWild(null);
    if (!card) return;
    const r = await playCard(card.id, color);
    if (r.error) flashError(r.error);
  };

  const handleDraw = async () => {
    const r = await drawCard();
    if (r.error) flashError(r.error);
  };

  const handleDrawnDecision = async (play: boolean, color: CardColor | null) => {
    const r = await playDrawnCard(play, color);
    if (r.error) flashError(r.error);
  };

  const showCallUno = myHand.length === 1 && !me.hasCalledUno;
  const callOutTargets = state.players.filter(
    (p) => state.unoVulnerable === p.id && p.id !== me.id,
  );

  return (
    <div className="flex flex-col h-dvh w-full p-2 gap-2">
      {toast && <div className="toast">{toast}</div>}
      {error && <div className="toast bg-uno-red!">{error}</div>}

      <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-hide">
        {state.players
          .filter((p) => p.id !== me.id)
          .map((p) => {
            const active = state.currentPlayerId === p.id;
            const vulnerable = state.unoVulnerable === p.id;
            return (
              <div
                key={p.id}
                className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl min-w-20 relative transition-colors ${
                  active ? 'bg-uno-yellow/25 border-[1.5px] border-uno-yellow' : 'bg-black/30'
                } ${!p.connected ? 'opacity-45' : ''}`}
              >
                <span className="text-[13px] font-semibold whitespace-nowrap max-w-20 overflow-hidden text-ellipsis">
                  {p.name}
                </span>
                <span className="text-xs opacity-85 mt-0.5">
                  {p.cardCount} card{p.cardCount === 1 ? '' : 's'}
                </span>
                {p.cardCount === 1 && p.hasCalledUno && (
                  <span className="absolute -top-2 -right-1.5 bg-uno-red text-white text-[10px] font-extrabold py-0.5 px-1.5 rounded-full tracking-[0.06em]">
                    UNO
                  </span>
                )}
                {vulnerable && (
                  <button
                    type="button"
                    className="mt-1 text-[11px] bg-uno-red text-white py-1 px-2 rounded-full font-bold"
                    onClick={async () => {
                      const r = await callOutUno(p.id);
                      if (r.error) flashError(r.error);
                    }}
                  >
                    Call out!
                  </button>
                )}
              </div>
            );
          })}
      </div>

      <div
        className={`text-center text-[13px] py-1.5 px-3 rounded-full self-center font-semibold ${
          isMyTurn ? 'bg-uno-yellow text-uno-black' : 'bg-black/40'
        }`}
      >
        {isMyTurn
          ? 'Your turn'
          : `${state.players.find((p) => p.id === state.currentPlayerId)?.name || '…'}'s turn`}
      </div>

      <Table
        topCard={state.topCard}
        activeColor={state.activeColor}
        direction={state.direction}
        drawPileCount={state.drawPileCount}
        pendingDraw={state.pendingDraw}
        canDraw={isMyTurn && !state.awaitingDrawnCard}
        onDraw={handleDraw}
      />

      <div className="flex gap-2 justify-center p-1.5">
        {showCallUno && (
          <button
            type="button"
            className="btn btn-red text-sm py-2.5 px-4 min-h-10 italic font-black tracking-wide"
            onClick={async () => {
              const r = await callUno();
              if (r.error) flashError(r.error);
            }}
          >
            UNO!
          </button>
        )}
        {callOutTargets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn btn-red text-sm py-2.5 px-4 min-h-10"
            onClick={async () => {
              const r = await callOutUno(p.id);
              if (r.error) flashError(r.error);
            }}
          >
            Catch {p.name}!
          </button>
        ))}
      </div>

      <Hand
        hand={myHand}
        top={state.topCard}
        activeColor={state.activeColor}
        pendingDrawType={state.pendingDrawType}
        isMyTurn={isMyTurn && !state.awaitingDrawnCard}
        onPlay={handlePlay}
      />

      {pendingWild && (
        <ColorPicker onPick={handlePickColor} onCancel={() => setPendingWild(null)} />
      )}
      {state.awaitingDrawnCard && (
        <DrawnCardPrompt card={state.awaitingDrawnCard} onDecide={handleDrawnDecision} />
      )}
    </div>
  );
}

function JoinScreen({ onError, error }: { onError: (msg: string) => void; error: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const r = await joinGame(name);
    setBusy(false);
    if (r?.error) onError(r.error);
  };

  const reset = async () => {
    await newGame();
    setConfirmReset(false);
  };

  return (
    <div className="grid place-items-center h-dvh w-full p-6">
      <form
        className="bg-black/40 rounded-[20px] py-8 px-6 w-full max-w-[360px] text-center"
        onSubmit={submit}
      >
        <h1 className="uno-text m-0 mb-3 text-[64px]">UNO</h1>
        <p className="opacity-75 m-0">Pick a name to join the game</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
          maxLength={18}
          autoComplete="off"
          className="w-full py-3.5 px-4 text-lg rounded-xl border-2 border-white/20 bg-black/30 text-white my-4 focus:outline-none focus:border-uno-yellow"
        />
        <button type="submit" className="btn" disabled={busy || !name.trim()}>
          Join
        </button>
        <div className="text-[#ffb4b4] text-sm mt-2 min-h-[18px]">{error}</div>
        <div className="mt-6 text-xs opacity-60">
          {!confirmReset ? (
            <button
              type="button"
              className="btn btn-ghost text-xs px-3.5 py-2 min-h-0 min-w-0"
              onClick={() => setConfirmReset(true)}
            >
              Game stuck? Reset everything
            </button>
          ) : (
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                className="btn btn-red text-xs px-3.5 py-2 min-h-0 min-w-0"
                onClick={reset}
              >
                Confirm reset
              </button>
              <button
                type="button"
                className="btn btn-ghost text-xs px-3.5 py-2 min-h-0 min-w-0"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

interface LobbyProps {
  state: GameState;
  me: RedactedPlayer;
  onStart: () => void;
}

function Lobby({ state, me, onStart }: LobbyProps) {
  const enough = state.players.length >= 2;
  return (
    <div className="flex flex-col h-dvh w-full p-6 gap-4">
      <h2 className="m-0 text-xl opacity-85">
        Lobby — {state.players.length} player{state.players.length === 1 ? '' : 's'}
      </h2>
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
        {state.players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-3 bg-black/25 rounded-xl text-base ${
              p.id === me.id ? 'border-2 border-uno-yellow' : ''
            }`}
          >
            <span>
              {p.name}
              {p.id === me.id ? ' (you)' : ''}
            </span>
            <span className="opacity-60 text-xs">{p.connected ? 'ready' : 'offline'}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn" disabled={!enough} onClick={onStart}>
          {enough ? 'Start game' : 'Waiting for players…'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            const cb = !document.body.classList.contains('cb');
            document.body.classList.toggle('cb', cb);
          }}
        >
          Color-blind aid
        </button>
      </div>
      <p className="opacity-60 text-xs text-center m-0">
        Open the laptop's <code>/host</code> page on a big screen to share the QR code.
      </p>
    </div>
  );
}
