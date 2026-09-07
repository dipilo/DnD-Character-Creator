import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { hydrateAuth } from '@/store/authStore';
import { startBackendKeepAlive } from '@/store/backendKeepAlive';
import { startCharacterSyncWatcher } from '@/store/characterSync';
import { startSessionBroadcast } from '@/store/sessionStore';
import { startThemeWatcher } from '@/store/themeStore';

// All of these run once, at boot, outside React. Resolving the session in an effect would mean calling
// setState synchronously to mirror external state, which CLAUDE.md rules out; components just read
// the store, which is already an external store. The theme goes on before the first paint for the
// separate reason that applying it from an effect shows a frame of the wrong palette.
startThemeWatcher();
void hydrateAuth();
startCharacterSyncWatcher();
startBackendKeepAlive();
// A roll made on a character sheet has to reach the table's feed too, so the watcher is started
// here rather than by the session screen.
startSessionBroadcast();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
