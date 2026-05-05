=== Wello ServiceDesk API ===
Contributors: odswello
Tags: servicedesk, helpdesk, support, ticketing, api
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.7
Donate link: https://wello.solutions/
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Securely connect WordPress to the Wello ServiceDesk platform with OTP authentication and ticket management.

== Description ==

Wello ServiceDesk API integrates WordPress with the external Wello ServiceDesk platform as a client interface.

Key features:

* OTP-based authentication via external Wello ServiceDesk service
* Secure access token generation and management
* React-powered ServiceDesk dashboard embedded in WordPress
* Admin configuration panel for branding and integration settings
* Ticket and work order listing with detailed views
* Fully translation-ready with multiple language support

Requires a valid Wello ServiceDesk account and API credentials.

== Important: WordPress Authentication Separation ==

This plugin maintains complete separation between WordPress authentication and external service authentication:

* No WordPress users are created from external service accounts
* No WordPress login/session is established using external credentials or tokens
* No WordPress roles or capabilities are granted based on external authentication
* External authentication is handled entirely by the Wello ServiceDesk platform
* WordPress user management remains fully independent

This plugin acts strictly as a client interface to the external service.

== External Services ==

This plugin connects to the Wello ServiceDesk API.

Service: https://servicedeskapi.wello.solutions

Purpose:
Authentication, ticket management, work orders, equipment tracking, and related operations.

Data transmitted:
* Email and password (used only during login request)
* OTP verification codes
* API requests for ticket and service data

Data handling:
* No passwords are stored in WordPress
* Access tokens are stored securely as WordPress options
* No WordPress user data is shared with the external service

Terms of Service: https://wello.solutions/terms-of-service
Privacy Policy: https://wello.solutions/privacy-note

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate the plugin through the Plugins screen in WordPress
3. Go to **Service Desk → Settings**
4. Configure branding and integration options
5. Click **Connect** to generate an access token

== Frequently Asked Questions ==

= Do I need a Wello ServiceDesk account? =
Yes, a valid Wello ServiceDesk account is required.

= Does this plugin create WordPress users? =
No. The plugin does not create or manage WordPress users.

= Does it log users into WordPress? =
No. WordPress authentication is completely separate.

= Where is the access token stored? =
It is stored securely in WordPress options and can be cleared anytime.

= Can the external service access my WordPress data? =
No. The plugin does not expose WordPress users or authentication data.

= Is this plugin translation-ready? =
Yes. The plugin is fully internationalization-ready and includes translations for multiple languages.

== Internationalization ==

This plugin is fully translation-ready using the `wello-servicedesk-api` text domain.

Included languages:
* English (en_US)
* French (fr_FR)
* German (de_DE)
* Spanish (es_ES)
* Italian (it_IT)
* Dutch (nl_NL)
* Polish (pl_PL)
* Portuguese (pt_PT)

Translation files are located in the `/languages/` directory.

== Source Code and Build Process ==

Frontend assets are built using React.

Source files:
`app/src/`

Build process:

1. Navigate to `app/`
2. Run `npm install`
3. Run `npm run build`

Production assets:
`app/build/static/`

Includes:
* Minified JavaScript
* Minified CSS
* Code-split chunks

Development:
Run `npm start` for local development server.

Repository:
https://github.com/WelloSolutions/ServiceDesk-WordPress-Plugin

== Screenshots ==

1. Admin settings page
2. ServiceDesk connection (OTP login)
3. Embedded dashboard
4. Ticket detail view

== Changelog ==

= 1.0.7 =
* Improved token handling and connection flow
* Removed duplicate token storage
* Fixed connection status display after token removal
* Refactored settings page for better UX and compliance
* Enhanced security and sanitization
* Added full localization support and translation files

= 1.0.6 =
* Documentation improvements for authentication separation

= 1.0.3 =
* Initial release

== Upgrade Notice ==

= 1.0.7 =
Improved security, connection handling, and localization support.

== Support ==

For issues or feature requests:
https://github.com/WelloSolutions/ServiceDesk-WordPress-Plugin/issues

== Additional Notes ==

* This plugin acts as a client for the Wello ServiceDesk API
* WordPress authentication is not modified or extended
* No WordPress users or roles are affected
* React frontend is bundled in production build
* All sensitive operations are handled externally

== License ==

GPLv2 or later.

All included libraries are GPL-compatible.