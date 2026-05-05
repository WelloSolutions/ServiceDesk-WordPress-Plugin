<?php
/*
 * Plugin Name: Wello ServiceDesk API
 * Description: Connects WordPress to the external Wello ServiceDesk platform via API. No interaction with WordPress authentication.
 * Version: 1.0.7
 * Author: Wello
 * Author URI: https://wello.solutions/
 * Donate Link: https://wello.solutions/
 * Text Domain: wello-servicedesk-api
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * IMPORTANT SECURITY NOTE:
 * This plugin acts strictly as a client for the external Wello ServiceDesk API.
 *
 * - It does NOT create, modify, or authenticate WordPress users
 * - It does NOT establish WordPress sessions
 * - It does NOT grant roles or capabilities
 * - It does NOT interfere with WordPress authentication in any way
 *
 * All external service interactions are handled independently of WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Plugin constants
 */
if (!defined('WELLO_SERVICEDESK_VERSION')) {
    define('WELLO_SERVICEDESK_VERSION', '1.0.7');
}

if (!defined('WELLO_SERVICEDESK_PLUGIN_FILE')) {
    define('WELLO_SERVICEDESK_PLUGIN_FILE', __FILE__);
}

if (!defined('WELLO_SERVICEDESK_PLUGIN_DIR')) {
    define('WELLO_SERVICEDESK_PLUGIN_DIR', plugin_dir_path(__FILE__));
}

if (!defined('WELLO_SERVICEDESK_PLUGIN_URL')) {
    define('WELLO_SERVICEDESK_PLUGIN_URL', plugin_dir_url(__FILE__));
}

if (!defined('WELLO_SERVICEDESK_TEXT_DOMAIN')) {
    define('WELLO_SERVICEDESK_TEXT_DOMAIN', 'wello-servicedesk-api');
}

if (!defined('WELLO_SERVICEDESK_API_BASE_URL')) {
    define('WELLO_SERVICEDESK_API_BASE_URL', 'https://servicedeskapi.wello.solutions');
}

/**
 * Include required files
 */
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
    $wello_servicedesk_file_path = WELLO_SERVICEDESK_PLUGIN_DIR . $wello_servicedesk_include_file;

    if (file_exists($wello_servicedesk_file_path)) {
        require_once $wello_servicedesk_file_path;
    }
}

/**
 * Activation hook
 */
function wello_servicedesk_activate_plugin()
{
    // Reserved for future safe setup (no user creation, no auth changes)
}
register_activation_hook(__FILE__, 'wello_servicedesk_activate_plugin');

/**
 * Deactivation hook
 */
function wello_servicedesk_deactivate_plugin()
{
    // Cleanup tasks if needed
}
register_deactivation_hook(__FILE__, 'wello_servicedesk_deactivate_plugin');