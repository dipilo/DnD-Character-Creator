import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { hydrateAuth } from '@/store/authStore';
import { startCharacterSyncWatcher } from '@/store/characterSync';
import { startThemeWatcher } from '@/store/themeStore';

// All three run once, at boot, outside React. Resolving the session in an effect would mean calling
// setState synchronously to mirror external state, which CLAUDE.md rules out; components just read
// the store, which is already an external store. The theme goes on before the first paint for the
// separate reason that applying it from an effect shows a frame of the wrong palette.
startThemeWatcher();
void hydrateAuth();
startCharacterSyncWatcher();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
