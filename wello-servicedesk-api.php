<?php
/*
 * Plugin Name: Wello ServiceDesk API
 * Description: Client interface for Wello ServiceDesk platform. Maintains complete separation between WordPress authentication and external service authentication.
 * Version: 1.0.6
 * Author: Wello
 * Author URI: https://wello.solutions/
 * Donate Link: https://wello.solutions/
 * Text Domain: wello-servicedesk-api
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * IMPORTANT SECURITY NOTE:
 * This plugin acts as a CLIENT for the external Wello ServiceDesk API.
 * - It does NOT create WordPress users from external service accounts
 * - It does NOT establish WordPress login/sessions from external credentials
 * - It does NOT grant WordPress roles, capabilities, or access based on external authentication
 * - WordPress authentication and external service authentication are completely separate
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! defined('WELLO_SERVICEDESK_VERSION')) {
    define('WELLO_SERVICEDESK_VERSION', '1.0.6');
}

if (! defined('WELLO_SERVICEDESK_PLUGIN_FILE')) {
    define('WELLO_SERVICEDESK_PLUGIN_FILE', __FILE__);
}

if (! defined('WELLO_SERVICEDESK_PLUGIN_DIR')) {
    define('WELLO_SERVICEDESK_PLUGIN_DIR', plugin_dir_path(__FILE__));
}

if (! defined('WELLO_SERVICEDESK_PLUGIN_URL')) {
    define('WELLO_SERVICEDESK_PLUGIN_URL', plugin_dir_url(__FILE__));
}

if (! defined('WELLO_SERVICEDESK_TEXT_DOMAIN')) {
    define('WELLO_SERVICEDESK_TEXT_DOMAIN', 'wello-servicedesk-api');
}

if (! defined('WELLO_SERVICEDESK_API_URL')) {
    define('WELLO_SERVICEDESK_API_URL', 'https://servicedeskapi.wello.solutions');
}

$wello_servicedesk_include_files = array(
    'includes/helpers.php',
    'includes/api-client.php',
    'includes/assets.php',
    'includes/page-template.php',
    'includes/admin/settings.php',
    'includes/admin/access-token-page.php',
    'includes/admin/support-page.php',
    'includes/admin/admin-menu.php',
);

foreach ($wello_servicedesk_include_files as $wello_servicedesk_include_file) {
    require_once WELLO_SERVICEDESK_PLUGIN_DIR . $wello_servicedesk_include_file;
}
