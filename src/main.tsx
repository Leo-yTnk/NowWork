import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/manrope';
// Keep these families available for documents with explicit font choices.
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/inter/wght-italic.css';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/inter-tight/wght-italic.css';
import './styles/tokens.css';
import './styles/editor-toolbar-compat.css';
import './styles/app.css';
import './styles/system.css';
import './styles/workspace.css';
import './styles/navigation.css';
import './styles/editor-fonts.css';
import './styles/document.css';
import './styles/collections.css';
import './styles/cognitive.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'offline.js').catch((error) =>
      console.warn('NowWork: o modo offline não foi ativado neste navegador.', error));
  }, { once: true });
}
