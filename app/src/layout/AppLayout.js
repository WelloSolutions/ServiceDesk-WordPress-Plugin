import React from 'react';
import { useLocation } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import AppRoutes from '../routes/AppRoutes';

const PATHS_WITHOUT_NAVIGATION = ['/login', '/forgot-password'];

function normalizePath(pathname) {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function shouldRenderNavigation(pathname) {
  return !PATHS_WITHOUT_NAVIGATION.includes(normalizePath(pathname));
}

function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex items-start min-h-screen">
      {shouldRenderNavigation(location.pathname) && <DashboardSidebar />}
      <AppRoutes />
    </div>
  );
}

export default AppLayout;
