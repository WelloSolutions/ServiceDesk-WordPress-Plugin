import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import AppLayout from './layout/AppLayout';

import './App.css';
import './i18n';

function App() {
  return (
    <AuthProvider>
      <Router basename="/service-desk">
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
