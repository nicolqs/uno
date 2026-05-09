import { useEffect } from 'react';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import { ensureSocket, useGameState } from './socket';

export default function App() {
  const isHost = window.location.pathname.replace(/\/+$/, '') === '/host';
  useEffect(() => {
    ensureSocket(isHost);
  }, [isHost]);
  const state = useGameState();
  if (!state) {
    return <div className="grid place-items-center h-full text-lg opacity-70">Connecting…</div>;
  }
  return isHost ? <HostScreen state={state} /> : <PlayerScreen state={state} />;
}
