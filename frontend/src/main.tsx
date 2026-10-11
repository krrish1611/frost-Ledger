import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { Web3Provider } from './context/Web3Context';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Web3Provider>
        <App />
      </Web3Provider>
    </ThemeProvider>
  </React.StrictMode>
);
