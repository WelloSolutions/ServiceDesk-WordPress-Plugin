import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import AppLayout from './layout/AppLayout';
import { APP_BASENAME } from './config';

import './App.css';
import './i18n';

function App() {
  return (
    <AuthProvider>
      <Router basename={APP_BASENAME}>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
