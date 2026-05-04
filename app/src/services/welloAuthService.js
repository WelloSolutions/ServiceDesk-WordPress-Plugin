import axios from 'axios';

const WELLO_API_URL = process.env.REACT_APP_API_URL || 'https://servicedeskapi.wello.solutions';

function apiUrl(path) {
  return `${WELLO_API_URL.replace(/\/$/, '')}${path}`;
}

function getServiceAccessToken() {
  return window.welloServiceDesk?.service_access_token || process.env.REACT_APP_SERVICE_ACCESS_TOKEN || '';
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
