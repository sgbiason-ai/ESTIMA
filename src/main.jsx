import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import UpdatePrompt from './components/common/UpdatePrompt.jsx';
import { DialogProvider } from './contexts/DialogContext';
import { ToastProvider } from './contexts/ToastContext';
import { initSentry } from './sentry';
import './index.css';

// Initialise Sentry avant le rendu (ne fait rien si DSN absent)
initSentry();

// Le splash screen HTML reste visible pendant le chargement auth.
// Il sera masqué par App.jsx une fois l'auth résolu.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <DialogProvider>
          <App />
          <UpdatePrompt />
        </DialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);