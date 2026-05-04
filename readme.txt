=== Wello ServiceDesk API ===
Contributors: odswello
Tags: servicedesk, helpdesk, support, ticketing, api
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.6
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Securely connect WordPress to the Wello ServiceDesk platform with a React-powered service desk interface and external ticket management.

== Description ==

Wello ServiceDesk API is a WordPress plugin that integrates your site with the external Wello ServiceDesk platform. It provides a client-side service desk interface embedded inside WordPress while keeping WordPress authentication fully separate from external authentication.

Key features:

* OTP-based login via Wello ServiceDesk
* External API token handling (generation and refresh)
* React-powered support dashboard embedded in WordPress pages
* Ticket and work order management interface
* Support for documents, equipment, and metadata
* Admin configuration panel
* Translation-ready interface (en, fr, nl, it, pl, de, es)

This plugin requires an active Wello ServiceDesk account and valid API credentials.

== Authentication ==

This plugin does not integrate external authentication into WordPress itself.

* No WordPress users are created
* No WordPress sessions are created from external authentication
* No WordPress roles or capabilities are modified
* WordPress authentication remains fully independent

The plugin only provides a frontend interface for interacting with the external Wello ServiceDesk system.

== External Services ==

This plugin connects to an external service to provide its functionality.

Service: Wello ServiceDesk API  
Provider: Wello Solutions  

Purpose:  
To enable authentication, ticket management, and synchronization with the Wello ServiceDesk platform.

Data sent:  
- User email (for authentication)  
- Authentication tokens (temporary API tokens)  
- Ticket and support-related data created or updated through the plugin  
- Site URL (for API association, if applicable)  

When data is sent:  
- When an administrator connects the plugin to a Wello account  
- When a user logs in via OTP  
- When tickets or related data are created, updated, or retrieved  

Data storage and browser usage:  
- Service desk data is processed and stored on Wello’s external servers  
- WordPress stores only plugin configuration settings  
- The plugin uses browser storage (localStorage) to temporarily store authentication state and session-related data on the client side  

Terms of Service:  
https://wello.solutions/terms-of-service  

Privacy Policy:  
https://wello.solutions/privacy-note  

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin through the WordPress Plugins screen.
3. Go to **Settings → Wello ServiceDesk**.
4. Enter your API credentials and configuration.
5. Open the ServiceDesk interface page.

== Frequently Asked Questions ==

= Do I need a Wello ServiceDesk account? =
Yes. This plugin requires an active Wello ServiceDesk account.

= Does this plugin create WordPress users? =
No. It does not create or modify WordPress users.

= Is WordPress authentication affected? =
No. WordPress authentication is completely separate.

= What data is stored in WordPress? =
Only plugin configuration settings. External service data is not stored locally.

= Does the plugin use browser storage? =
Yes. It uses localStorage to maintain temporary authentication/session state in the browser.

= Can this plugin be used on multisite? =
Yes, it supports WordPress multisite installations.

== Source Code ==

https://github.com/WelloSolutions/ServiceDesk-WordPress-Plugin/

== Build Process ==

Production assets are generated from source files located in `app/src/`.

Build steps:

1. Navigate to the `app/` directory  
2. Run `npm install`  
3. Run `npm run build`  

Development:

* Run `npm start` for local development  

Compiled assets are located in `app/build/`.

== Screenshots ==

1. Admin settings page  
2. OTP login interface  
3. Embedded ServiceDesk dashboard  
4. Ticket detail view  

== Changelog ==

= 1.0.6 =
* Improved external service disclosure compliance  
* Added browser storage (localStorage) documentation  
* Updated legal links  

= 1.0.3 =
* Initial release  

== Upgrade Notice ==

= 1.0.6 =
Compliance and documentation improvements.

== Support ==

https://github.com/WelloSolutions/ServiceDesk-WordPress-Plugin/issues

== License ==

This plugin is licensed under the GPLv2 or later.

All bundled third-party libraries are compatible with the GPL license.