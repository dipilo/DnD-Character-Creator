import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { hydrateAuth } from '@/store/authStore';
import { startBackendKeepAlive } from '@/store/backendKeepAlive';
import { startCharacterSyncWatcher } from '@/store/characterSync';
import { startSessionBroadcast } from '@/store/sessionStore';
import { startThemeWatcher } from '@/store/themeStore';

// At boot, outside React; the theme goes on before the first paint.
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
