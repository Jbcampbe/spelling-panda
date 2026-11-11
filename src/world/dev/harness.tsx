/* Dev-only entry for the 3D world harness (loaded by /world-dev.html, never by the app). */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HarnessApp from './HarnessApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HarnessApp />
  </StrictMode>,
);
