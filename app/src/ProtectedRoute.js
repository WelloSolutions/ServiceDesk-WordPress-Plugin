import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children }) => {
  const { auth } = useAuth();

  if (!auth) {
    // WordPress plugin: the domain comes from the service access token set in the plugin settings,
    // so there is no ?domain= query string to keep (unlike the standalone app).
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
