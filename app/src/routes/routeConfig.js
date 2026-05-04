import React from 'react';
import Login from '../components/Login';
import ForgetPassword from '../components/ForgetPassword';
import ProtectedRoute from '../ProtectedRoute';
import ViewHome from '../components/ViewHome';
import About from '../components/About';
import CreateTicket from '../components/CreateTicket';
import ViewTicketList from '../components/ViewTicketList';
import ViewTicket from '../components/ViewTicket';
import ViewWorkOrder from '../components/ViewWorkOrder';
import ViewWorkOrderList from '../components/ViewWorkOrderList';
import ViewUserList from '../components/ViewUserList';
import ViewEquipmentsList from '../components/ViewEquipmentsList';
import ViewEquipment from '../components/ViewEquipment';
import ViewDocuments from '../components/ViewDocuments';
import ViewCalendars from '../components/ViewCalendar';
import ViewBillingInvoice from '../components/ViewBillingInvoice';
import PasswordUpdate from '../components/PasswordUpdate';
import NotFound from '../components/NotFound';

function protectedElement(Component) {
  return (
    <ProtectedRoute>
      <Component />
    </ProtectedRoute>
  );
}

export const appRoutes = [
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgetPassword /> },
  { path: '/', element: protectedElement(ViewHome) },
  { path: '/about', element: protectedElement(About) },
  { path: '/createticket', element: protectedElement(CreateTicket) },
  { path: '/tickets', element: protectedElement(ViewTicketList) },
  { path: '/ticket/:ticketId', element: protectedElement(ViewTicket) },
  { path: '/workorders', element: protectedElement(ViewWorkOrderList) },
  { path: '/workorder/:workOrderId', element: protectedElement(ViewWorkOrder) },
  { path: '/equipments', element: protectedElement(ViewEquipmentsList) },
  { path: '/equipment/:InstallationId', element: protectedElement(ViewEquipment) },
  { path: '/documents', element: protectedElement(ViewDocuments) },
  { path: '/users', element: protectedElement(ViewUserList) },
  { path: '/calendar', element: protectedElement(ViewCalendars) },
  { path: '/billing-invoice', element: protectedElement(ViewBillingInvoice) },
  { path: '/update-password', element: protectedElement(PasswordUpdate) },
  { path: '*', element: <NotFound /> },
];
