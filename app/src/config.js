// Single source of the ServiceDesk API base URL (without trailing slash).
// WordPress plugin build: REACT_APP_API_URL can override it at build time (e.g. app/.env.local),
// otherwise the production API is used (same as WELLO_SERVICEDESK_API_BASE_URL in wello-servicedesk-api.php).
//const DEFAULT_API_URL = "https://servicedeskapi.wello.solutions";
const DEFAULT_API_URL = "https://testservicedeskapi.odysseemobile.com";

export const API_BASE_URL = (process.env.REACT_APP_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, "");

// The React app is served by WordPress under the /service-desk page (see includes/page-template.php).
export const APP_BASENAME = "/service-desk";

// Absolute URL of an app page, for links that bypass the router (new tabs, plain <a href>).
export const appUrl = (path = "/") => `${APP_BASENAME}${path.startsWith("/") ? path : `/${path}`}`;

// Fallback images shipped in app/public, used when no logo / banner is set in the WordPress settings.
export const publicAsset = (file) => `${APP_BASENAME}/${file}`;
