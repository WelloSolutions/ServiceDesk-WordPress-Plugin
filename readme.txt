=== Wello ServiceDesk API ===
Contributors: odswello
Tags: servicedesk, helpdesk, support, ticketing, api
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.6
Donate link: https://wello.solutions/
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Securely connect WordPress to Wello ServiceDesk platform with OTP authentication and ticket management.

== Description ==

Our plugin integrates WordPress with the Wello ServiceDesk API as a client interface:

* OTP-based login and verification with external Wello ServiceDesk service
* Access token generation and refresh (external service only)
* React-powered ServiceDesk dashboard inside WordPress
* Admin configuration panel (API endpoint, client secrets, sync behavior)
* Ticket and work order listing + detail views
* Translation-ready (en, fr, nl, it, pl, de, es)

Requires a valid Wello ServiceDesk account and API credentials.

== Important: WordPress Authentication Separation ==

**This plugin maintains complete separation between WordPress authentication and external service authentication:**

✓ No WordPress users are created from external service accounts
✓ No WordPress login/session is established from external credentials or tokens
✓ No WordPress roles, capabilities, or access are granted based on external service authentication
✓ External auth tokens are managed client-side (browser localStorage) only
✓ The plugin functions strictly as a client interface to the Wello ServiceDesk API
✓ WordPress user management and authentication remain under full WordPress admin control

Users authenticate directly with the external Wello ServiceDesk service through the plugin interface. 
This is a completely separate authentication system from WordPress.

== External Services ==

This plugin connects to the Wello ServiceDesk API to provide service desk functionality.

**Service Used:** Wello ServiceDesk API (https://servicedeskapi.wello.solutions)
- **Purpose:** Authentication, ticket management, work orders, equipment tracking, documents, and user data synchronization.
- **Data Sent:** User email and password for login (one-time during token generation), OTP codes for verification. No sensitive data is stored in WordPress.
- **When:** Only when users log in or perform actions in the service desk interface.
- **Terms of Service:** https://wello.solutions/terms-of-service
- **Privacy Policy:** https://wello.solutions/privacy-note

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin in the WordPress **Plugins** page.
3. Navigate to **Settings → Wello ServiceDesk**.
4. Enter API URL and ServiceDesk credentials.
5. Save and open **ServiceDesk** from the menu.

== Frequently Asked Questions ==

= Do I need a Wello ServiceDesk account? =
Yes. A Wello ServiceDesk account is required to use this plugin.

= How is user data handled? =
Passwords are never stored in WordPress. Users authenticate directly with the external Wello ServiceDesk service. 
Only temporary authorization tokens are used for external API calls and stored client-side.

= Does this create WordPress users? =
No. This plugin does not create or manage WordPress users. It acts as a client interface to the external Wello ServiceDesk service. 
WordPress user management remains completely separate.

= Does the external service access my WordPress account? =
No. The plugin maintains complete separation between WordPress and external service authentication. 
The external service cannot create, modify, or access WordPress users or accounts.

= Can this work on multisite? =
Yes, it is compatible with multisite installations (admin settings are network/site scoped depending on configuration).

== Source Code and Build Process ==

The minified JavaScript and CSS files in this plugin are generated from source code available in the `app/` directory.

**Source Files Location:** `app/src/` directory
- React components and JavaScript source code
- CSS stylesheets  
- Localization files (en, fr, nl, it, pl, de, es)

**Build Process:**
1. Navigate to the `app/` directory
2. Run `npm install` to install dependencies (requires Node.js and npm)
3. Run `npm run build` to generate production assets in `app/build/static/`

**Generated Files:** `app/build/static/`
- Minified CSS: `app/build/static/css/main.*.css`
- Minified JavaScript: `app/build/static/js/main.*.js`
- Chunk files: `app/build/static/js/*.chunk.js` (for code splitting)

**Development Mode:**
- Run `npm start` to start the development server at http://localhost:3000
- Useful for testing and development before building

Source code repository: https://github.com/WelloSolutions/WP-ServiceDesk-Plugin

== Screenshots ==

1. Admin settings page
2. OTP login screen
3. Embedded ServiceDesk dashboard
4. Ticket detail view

== Changelog ==

= 1.0.6 =
* Enhanced documentation for WordPress authentication separation.
* Clarified that plugin functions as external service client only.
* Improved source code and build process documentation.

= 1.0.3 =
* Initial release with core API integration and React ServiceDesk UI.

== Upgrade Notice ==

= 1.0.6 =
Updated documentation to clarify WordPress authentication separation.

= 1.0.3 =
Initial stable release.

== Support ==

Report bugs or request features:
https://github.com/WelloSolutions/WP-ServiceDesk-Plugin/issues

== Additional Notes ==

* This plugin acts as a CLIENT for the external Wello ServiceDesk API
* WordPress authentication and external service authentication are completely separate
* No WordPress users, roles, or capabilities are affected by this plugin
* Production assets are in `build/static/` and `app/build/static/`
* Source app in `app/src/` and plugin PHP in root directory

Local development:
1. cd app/
2. npm install
3. npm run build (for production build)
4. npm start (for development with hot reload)

== License ==

GPLv2 or later.

All bundled third-party libraries are GPL-compatible.