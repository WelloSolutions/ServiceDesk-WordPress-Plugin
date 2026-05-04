import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

beforeEach(() => {
  window.history.pushState({}, '', '/service-desk/login');
  window.welloServiceDesk = {
    logo_primary: '/service-desk/logo.png',
    color_primary: '#003327',
    service_access_token: 'test-access-token',
  };
  localStorage.clear();
});

test('renders the service desk login screen', () => {
  render(<App />);

  expect(screen.getByPlaceholderText(/enter email here/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
});
