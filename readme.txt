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

Securely connect WordPress to the Wello ServiceDesk platform with a React-powered service desk interface, OTP authentication, and ticket management.

== Description ==

Wello ServiceDesk API is a WordPress plugin that integrates your site with the external Wello ServiceDesk platform. It is designed as a client-side service desk interface that keeps WordPress authentication separate from external Wello authentication.

Key features:

* OTP-based login and verification through Wello ServiceDesk
* External access token generation and refresh
* React-powered support dashboard embedded in WordPress pages
* Ticket and work order listing with detail views
* Support for documents, equipment and user metadata
* Admin panel for configuration and branding
* Translation-ready interface (en, fr, nl, it, pl, de, es)

This plugin requires a valid Wello ServiceDesk account and API credentials.

== Authentication Separation ==

This plugin does not create WordPress accounts or perform WordPress login using external Wello credentials.

* No WordPress users are created from external service accounts
* No WordPress login sessions are established from external tokens
* No WordPress roles or capabilities are granted based on external service authentication
* External auth tokens are used only for the Wello ServiceDesk client interface
* WordPress authentication remains under full WordPress control

== External Services ==

This plugin connects to the Wello ServiceDesk API to manage ticketing and support data.

Service: Wello Solutions API
Purpose: Enable ticket management and synchronization with the Wello platform

Data sent:
- Only Wello ServiceDesk admin/user email (no WordPress data is sent)

When:
- When an admin connects the plugin to the Wello account
- When tickets are created, updated, or synchronized

Provider: Wello Solutions

Terms of Service: https://wello.solutions/terms
Privacy Policy: https://wello.solutions/privacy

== External Data Disclosure ==

This plugin uses the external Wello ServiceDesk API and includes bundled JavaScript that communicates with external Wello endpoints.

- **Service:** Wello ServiceDesk API
- **Data sent:** Only Wello ServiceDesk admin/user email (no WordPress data is sent)
- **When sent:** on admin account connection and when tickets are created, updated, or synchronized
- **Why:** to authenticate with Wello and manage ticket/support data through the external Wello platform

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin from the WordPress **Plugins** screen.
3. Go to **Settings → Wello ServiceDesk**.
4. Configure the API and service desk settings.
5. Open the ServiceDesk page to use the embedded dashboard.

== Frequently Asked Questions ==

= Do I need a Wello ServiceDesk account? =
Yes. A Wello ServiceDesk account and API credentials are required.

= How is user data handled? =
Passwords are never stored in WordPress. The plugin sends authentication data directly to Wello ServiceDesk, and only temporary tokens are used for API access.

= Does this plugin create WordPress users? =
No. It only provides a client interface to the external Wello ServiceDesk API.

= Can this plugin be used on multisite? =
Yes, it is compatible with WordPress multisite environments.

== Source Code and Build Process ==

The production assets are generated from the source code under `app/src/`.

Build instructions:

1. Change to the `app/` directory.
2. Run `npm install`.
3. Run `npm run build`.

For development:

* Run `npm start` to start the local development server.

Production assets are published to `app/build/static/`.

== Screenshots ==

1. Admin settings page
2. OTP login screen
3. Embedded ServiceDesk dashboard
4. Ticket detail view

== Changelog ==

= 1.0.6 =
* Clarified authentication separation and external API usage.
* Improved documentation for build and deployment.

= 1.0.3 =
* Initial release with core Wello ServiceDesk integration.

== Upgrade Notice ==

= 1.0.6 =
Updated documentation and clarified external service behavior.

== Support ==

Report bugs or request features:
https://github.com/WelloSolutions/WP-ServiceDesk-Plugin/issues

== License ==

GPLv2 or later.

All bundled third-party libraries are GPL-compatible.