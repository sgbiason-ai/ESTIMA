import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import { DialogProvider } from './contexts/DialogContext';
import { ToastProvider } from './contexts/ToastContext';
import { initSentry } from './sentry';
import './index.css';

// Initialise Sentry avant le rendu (ne fait rien si DSN absent)
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);