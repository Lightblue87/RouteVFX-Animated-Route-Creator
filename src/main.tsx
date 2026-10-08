import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './app/app.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { registerServiceWorker } from './app/sw-register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
