import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 🔥 هذا السطر يحل مشكلة Invalid Host header
window.location.hostname = 'basilisk-ui.onrender.com';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
