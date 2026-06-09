import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './styles/globals.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </HeroUIProvider>
  </React.StrictMode>
);
