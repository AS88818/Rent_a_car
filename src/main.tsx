import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LogRocket from 'logrocket';
import setupLogRocketReact from 'logrocket-react';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD) {
  LogRocket.init('ukbgwa/rent-a-car-in-kenya');
  setupLogRocketReact(LogRocket);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
