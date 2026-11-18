import axios from 'axios';

import { API_BASE_URL } from '../config';

const WELLO_API_URL = API_BASE_URL;

function apiUrl(path) {
  return `${WELLO_API_URL.replace(/\/$/, '')}${path}`;
}

function getServiceAccessToken() {
  return window.welloServiceDesk?.service_access_token || process.env.REACT_APP_SERVICE_ACCESS_TOKEN || 'AKCDR8dilnE7ISown6JvUY/2CiBNXbEMZuBJTUwAveQBViIrXSeZq/q97oxBrIhd3YYmYBfUW5rul8UDkwFcxFR/Ozj0hvbJLPNRAaT2FeOFtxlyvMKv9QkuTmgzX0atfkgi1Rgcsq+3KX27nNJNoQNuQwqUuTUOWm08U1ZGVlIs+hgxdXUHVxRxEWB9vWjFodYxc91ujzGlOw7I8NQvXw==';
}

function jsonHeaders(headers = {}) {
  return {
    'Content-Type': 'application/json',
    ...headers,
  };
}

export function loginWithWelloServiceDesk(email, password) {
  const serviceAccessToken = getServiceAccessToken();

  if (!serviceAccessToken) {
    throw new Error('Service access token is missing.');
  }

  return axios.post(
    apiUrl('/api/Authentication/contact-authtoken/'),
    {
      useremail: email,
      password,
      access_token: serviceAccessToken,
    },
    {
      headers: jsonHeaders(),
      skipAuthRedirect: true, // a failed login must not trigger the global 401 sign-out (AuthContext)
    }
  );
}

export async function requestPasswordChange(email, currentPassword) {
  const loginResponse = await loginWithWelloServiceDesk(email, currentPassword);
  const authToken = loginResponse?.data?.auth_token;

  if (!authToken) {
    throw new Error('Authentication failed.');
  }

  const response = await axios.put(
    apiUrl('/api/ContactPlug/request-changepw'),
    null,
    {
      headers: jsonHeaders({
        Authorization: `Basic ${authToken}`,
      }),
    }
  );

  return {
    response,
    authToken,
  };
}

export function verifyPasswordChange(authToken, data) {
  return axios.put(
    apiUrl('/api/ContactPlug/verify-changepw'),
    data,
    {
      headers: jsonHeaders({
        Authorization: `Basic ${authToken}`,
      }),
    }
  );
}
