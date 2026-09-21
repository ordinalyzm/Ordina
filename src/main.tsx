import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  const isCapacitor = !!(window as any).Capacitor;
  if (!isCapacitor) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('[ServiceWorker] registered with scope: ', registration.scope);
        },
        (err) => {
          console.warn('[ServiceWorker] registration failed: ', err);
        }
      );
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
