import React from 'react';
import { DIContainer } from './services/DIContainer';
import { MainLayout } from './components/layout/MainLayout';
import { LanguageProvider } from './components/common/LanguageProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider fallback={<div className="app-loading">Loading application...</div>}>
        <DIContainer>
          <div className="app">
            <MainLayout />
          </div>
        </DIContainer>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;