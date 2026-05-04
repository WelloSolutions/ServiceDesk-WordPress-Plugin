import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { appRoutes } from './routeConfig';

function AppRoutes() {
  return (
    <Routes>
      {appRoutes.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
    </Routes>
  );
}

export default AppRoutes;
