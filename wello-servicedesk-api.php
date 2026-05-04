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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */


if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Define plugin constants
define('WELLO_SERVICEDESK_VERSION', '1.0.6');
define('WELLO_SERVICEDESK_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WELLO_SERVICEDESK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WELLO_SERVICEDESK_TEXT_DOMAIN', 'wello-servicedesk-api');
define('WELLO_SERVICEDESK_API_URL', 'https://servicedeskapi.wello.solutions');

// Helper function to safely get option with type casting
function wello_get_option($option, $default = '', $type = 'string')
{
    $value = get_option($option, $default);
    
    switch ($type) {
        case 'url':
            return esc_url($value);
        case 'hex_color':
            return sanitize_hex_color($value);
        case 'html':
            return wp_kses_post($value);
        case 'text':
        default:
            return sanitize_text_field($value);
    }
}

// Helper function to safely output form inputs
function wello_form_input($name, $type = 'text', $value = '', $class = '')
{
    echo '<input type="' . esc_attr($type) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" class="' . esc_attr($class) . '">';
}

/**
 * Enqueue Frontend Scripts and Styles (only on frontend)
 * 
 * Uses glob() to find versioned build files and passes sanitized settings
 * to the React app via wp_localize_script for secure configuration.
 *
 * @since 1.0.0
 */
function wello_servicedesk_enqueue_scripts()
{
    // Only enqueue on frontend, not admin
    if (is_admin()) {
        return;
    }

    $plugin_dir_url = WELLO_SERVICEDESK_PLUGIN_URL;
    $plugin_dir_path = WELLO_SERVICEDESK_PLUGIN_DIR;
    $script_handle = 'wello-servicedesk-script';
    $style_handle = 'wello-servicedesk-style';

    // Enqueue CSS
    $css_dir = $plugin_dir_path . 'app/build/static/css/';
    if (is_dir($css_dir)) {
        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        $css_files = @glob($css_dir . '*.css');
        if (!empty($css_files) && is_array($css_files)) {
            $css_file_path = reset($css_files);
            if (file_exists($css_file_path)) {
                $css_file_url = $plugin_dir_url . 'app/build/static/css/' . basename($css_file_path);
                $css_version = filemtime($css_file_path);
                wp_enqueue_style(
                    $style_handle,
                    $css_file_url,
                    [],
                    $css_version
                );
            }
        }
    }

    // Enqueue JS
    $js_dir = $plugin_dir_path . 'app/build/static/js/';
    if (is_dir($js_dir)) {
        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        $js_files = @glob($js_dir . 'main.*.js');
        if (!empty($js_files) && is_array($js_files)) {
            $js_file_path = reset($js_files);
            if (file_exists($js_file_path)) {
                $js_file_url = $plugin_dir_url . 'app/build/static/js/' . basename($js_file_path);
                $js_version = filemtime($js_file_path);
                
                wp_register_script(
                    $script_handle,
                    $js_file_url,
                    ['wp-element'],
                    $js_version,
                    true
                );
                wp_enqueue_script($script_handle);

                // Pass sanitized settings to React via wp_localize_script
                $settings = [
                    'restUrl' => esc_url_raw(rest_url('wello-servicedesk/v1/')),
                    'loginNonce' => wp_create_nonce('wello_servicedesk_login'),
                    'passwordNonce' => wp_create_nonce('wello_servicedesk_password'),
                    'logo_primary' => wello_get_option('wello_logo_primary', '', 'url'),
                    'logo_secondary' => wello_get_option('wello_logo_secondary', '', 'url'),
                    'color_primary' => wello_get_option('wello_color_primary', '#003327', 'hex_color'),
                    'background_image' => wello_get_option('wello_bg_image', '', 'url'),
                    'support_page_content' => wello_get_option('wello_support_page_content', '', 'html'),
                ];

                wp_localize_script($script_handle, 'welloServiceDesk', $settings);
            }
        }
    }
}
add_action('wp_enqueue_scripts', 'wello_servicedesk_enqueue_scripts', 999);

/**
 * Register secure REST routes for external service auth proxy.
 *
 * IMPORTANT: These routes proxy credentials to the EXTERNAL Wello ServiceDesk API only.
 * They do NOT create WordPress users, establish WordPress login sessions, or grant WordPress access.
 * Authentication is handled entirely by the external service.
 * Auth tokens are stored client-side (browser localStorage) and used only for external API calls.
 */
function wello_servicedesk_register_rest_routes() {
    register_rest_route(
        'wello-servicedesk/v1',
        '/auth/login',
        array(
            'methods' => 'POST',
            'callback' => 'wello_servicedesk_rest_auth_login',
            'permission_callback' => 'wello_servicedesk_rest_auth_permission',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_email',
                    'validate_callback' => function($param) {
                        return is_email($param);
                    },
                ),
                'password' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'nonce' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        )
    );

    register_rest_route(
        'wello-servicedesk/v1',
        '/auth/password/request-change',
        array(
            'methods' => 'POST',
            'callback' => 'wello_servicedesk_rest_auth_password_request_change',
            'permission_callback' => 'wello_servicedesk_rest_auth_password_permission',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_email',
                    'validate_callback' => function($param) {
                        return is_email($param);
                    },
                ),
                'current_password' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'nonce' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        )
    );

    register_rest_route(
        'wello-servicedesk/v1',
        '/auth/password/verify-change',
        array(
            'methods' => 'PUT',
            'callback' => 'wello_servicedesk_rest_auth_password_verify_change',
            'permission_callback' => 'wello_servicedesk_rest_auth_password_permission',
            'args' => array(
                'otp_token' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'otp_code' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'new_password' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'nonce' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        )
    );
}
add_action('rest_api_init', 'wello_servicedesk_register_rest_routes');

/**
 * Permission callback for the login proxy route.
 *
 * This ensures anonymous requests must present a valid nonce.
 */
function wello_servicedesk_rest_auth_permission($request) {
    $nonce = $request->get_param('nonce');
    return ! empty($nonce) && wp_verify_nonce($nonce, 'wello_servicedesk_login');
}

/**
 * Proxy external authentication through WordPress without creating a WordPress user or login.
 *
 * This REST endpoint acts as a secure proxy to the external Wello ServiceDesk API.
 * It passes user credentials to the external service and returns an auth_token.
 * 
 * CRITICAL: This function does NOT:
 * - Create WordPress users
 * - Establish WordPress login sessions
 * - Grant access to WordPress or any WordPress roles/capabilities
 * - Store credentials in WordPress database
 *
 * The returned auth_token is for external service API calls only, managed client-side.
 *
 * @param WP_REST_Request $request The REST request
 * @return WP_REST_Response|WP_Error Safe response with auth_token for external service, or error
 */
function wello_servicedesk_rest_auth_login($request) {
    $email = sanitize_email($request->get_param('email'));
    $password = sanitize_text_field($request->get_param('password'));

    if (empty($email) || empty($password) || !is_email($email)) {
        return new WP_Error(
            'invalid_credentials',
            __('Invalid authentication parameters.', 'wello-servicedesk-api'),
            array('status' => 400)
        );
    }

    $token = get_option('wello_servicedesk_token', '');
    if (empty($token)) {
        return new WP_Error(
            'missing_token',
            __('Service access token is not configured.', 'wello-servicedesk-api'),
            array('status' => 500)
        );
    }

    $response = wp_remote_post(
        WELLO_SERVICEDESK_API_URL . '/api/Authentication/contact-authtoken/',
        array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array(
                'useremail' => $email,
                'password' => $password,
                'access_token' => $token,
            )),
            'timeout' => 20,
        )
    );

    if (is_wp_error($response)) {
        return new WP_Error(
            'remote_error',
            __('Unable to reach the external authentication service.', 'wello-servicedesk-api'),
            array('status' => 502)
        );
    }

    $status_code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($status_code !== 200) {
        return new WP_Error(
            'auth_failed',
            isset($body['message']) ? sanitize_text_field($body['message']) : __('Authentication failed.', 'wello-servicedesk-api'),
            array('status' => $status_code)
        );
    }

    // Only expose expected authentication response fields.
    $safe_body = array(
        'auth_token' => isset($body['auth_token']) ? sanitize_text_field($body['auth_token']) : '',
        'firstname' => isset($body['firstname']) ? sanitize_text_field($body['firstname']) : '',
        'lastname' => isset($body['lastname']) ? sanitize_text_field($body['lastname']) : '',
        'id' => isset($body['id']) ? intval($body['id']) : 0,
        'db_language_iso_code' => isset($body['db_language_iso_code']) ? sanitize_text_field($body['db_language_iso_code']) : '',
    );

    return rest_ensure_response($safe_body);
}

/**
 * Permission callback for password-change proxy routes.
 */
function wello_servicedesk_rest_auth_password_permission($request)
{
    $nonce = $request->get_param('nonce');
    return ! empty($nonce) && wp_verify_nonce($nonce, 'wello_servicedesk_password');
}

/**
 * Get a transient key for a password change auth token.
 */
function wello_servicedesk_password_change_transient_key($otp_token)
{
    return 'wello_password_change_' . md5($otp_token);
}

/**
 * Request an OTP for password change via the external service.
 */
function wello_servicedesk_rest_auth_password_request_change($request)
{
    $email = sanitize_email($request->get_param('email'));
    $current_password = sanitize_text_field($request->get_param('current_password'));

    if (empty($email) || empty($current_password) || !is_email($email)) {
        return new WP_Error(
            'invalid_parameters',
            __('Invalid parameters for password change request.', 'wello-servicedesk-api'),
            array('status' => 400)
        );
    }

    $token = get_option('wello_servicedesk_token', '');
    if (empty($token)) {
        return new WP_Error(
            'missing_token',
            __('Service access token is not configured.', 'wello-servicedesk-api'),
            array('status' => 500)
        );
    }

    $login_response = wp_remote_post(
        WELLO_SERVICEDESK_API_URL . '/api/Authentication/contact-authtoken/',
        array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array(
                'useremail' => $email,
                'password' => $current_password,
                'access_token' => $token,
            )),
            'timeout' => 20,
        )
    );

    if (is_wp_error($login_response)) {
        return new WP_Error(
            'remote_error',
            __('Unable to reach the external authentication service.', 'wello-servicedesk-api'),
            array('status' => 502)
        );
    }

    $login_code = wp_remote_retrieve_response_code($login_response);
    $login_body = json_decode(wp_remote_retrieve_body($login_response), true);

    if ($login_code !== 200 || empty($login_body['auth_token'])) {
        return new WP_Error(
            'auth_failed',
            isset($login_body['message']) ? sanitize_text_field($login_body['message']) : __('Authentication failed.', 'wello-servicedesk-api'),
            array('status' => $login_code)
        );
    }

    $auth_token = sanitize_text_field($login_body['auth_token']);

    $request_response = wp_remote_request(
        WELLO_SERVICEDESK_API_URL . '/api/ContactPlug/request-changepw',
        array(
            'method' => 'PUT',
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Basic ' . $auth_token,
            ),
            'timeout' => 20,
        )
    );

    if (is_wp_error($request_response)) {
        return new WP_Error(
            'remote_error',
            __('Unable to reach the external password service.', 'wello-servicedesk-api'),
            array('status' => 502)
        );
    }

    $request_code = wp_remote_retrieve_response_code($request_response);
    $request_body = json_decode(wp_remote_retrieve_body($request_response), true);

    if ($request_code !== 200 || empty($request_body['otp_token'])) {
        return new WP_Error(
            'otp_request_failed',
            isset($request_body['message']) ? sanitize_text_field($request_body['message']) : __('Could not request password change OTP.', 'wello-servicedesk-api'),
            array('status' => $request_code)
        );
    }

    set_transient(
        wello_servicedesk_password_change_transient_key($request_body['otp_token']),
        $auth_token,
        15 * MINUTE_IN_SECONDS
    );

    return rest_ensure_response($request_body);
}

/**
 * Verify OTP and perform the password change via the external service.
 */
function wello_servicedesk_rest_auth_password_verify_change($request)
{
    $otp_token = sanitize_text_field($request->get_param('otp_token'));
    $otp_code = sanitize_text_field($request->get_param('otp_code'));
    $new_password = sanitize_text_field($request->get_param('new_password'));

    if (empty($otp_token) || empty($otp_code) || empty($new_password)) {
        return new WP_Error(
            'invalid_parameters',
            __('Invalid parameters for password verification.', 'wello-servicedesk-api'),
            array('status' => 400)
        );
    }

    $auth_token = get_transient(wello_servicedesk_password_change_transient_key($otp_token));
    if (empty($auth_token)) {
        return new WP_Error(
            'expired_or_invalid_token',
            __('Password change session has expired or is invalid.', 'wello-servicedesk-api'),
            array('status' => 400)
        );
    }

    $verify_response = wp_remote_request(
        WELLO_SERVICEDESK_API_URL . '/api/ContactPlug/verify-changepw',
        array(
            'method' => 'PUT',
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Basic ' . $auth_token,
            ),
            'body' => wp_json_encode(array(
                'otp_token' => $otp_token,
                'otp_code' => $otp_code,
                'new_password' => $new_password,
            )),
            'timeout' => 20,
        )
    );

    if (is_wp_error($verify_response)) {
        return new WP_Error(
            'remote_error',
            __('Unable to reach the external password verification service.', 'wello-servicedesk-api'),
            array('status' => 502)
        );
    }

    $verify_code = wp_remote_retrieve_response_code($verify_response);
    $verify_body = json_decode(wp_remote_retrieve_body($verify_response), true);

    delete_transient(wello_servicedesk_password_change_transient_key($otp_token));

    if ($verify_code !== 200) {
        return new WP_Error(
            'verify_failed',
            isset($verify_body['message']) ? sanitize_text_field($verify_body['message']) : __('Password verification failed.', 'wello-servicedesk-api'),
            array('status' => $verify_code)
        );
    }

    return rest_ensure_response($verify_body);
}

// Register and Include Custom Page Template
function wello_servicedesk_template($templates)
{
    $templates['wello-servicedesk-template.php'] = __('Wello Service Desk Template', 'wello-servicedesk-api');
    return $templates;
}
add_filter('theme_page_templates', 'wello_servicedesk_template');

function wello_servicedesk_template_include($template)
{
    if (get_page_template_slug() === 'wello-servicedesk-template.php') {
        $template = plugin_dir_path(__FILE__) . 'template/wello-servicedesk-template.php';
    }
    return $template;
}
add_filter('template_include', 'wello_servicedesk_template_include');

// Create the Service Desk Page on Plugin Activation
function wello_servicedesk_create_page()
{
    $page_slug = 'service-desk';
    if (null === get_page_by_path($page_slug)) {
        wp_insert_post([
            'post_title'    => __('Service Desk', 'wello-servicedesk-api'),
            'post_name'     => $page_slug,
            'post_content'  => '',
            'post_status'   => 'publish',
            'post_type'     => 'page',
            'meta_input'    => ['_wp_page_template' => 'wello-servicedesk-template.php'],
        ]);
    }
}
register_activation_hook(__FILE__, 'wello_servicedesk_create_page');

// Rewrite Rule for Custom Page
function wello_servicedesk_rewrite_rule()
{
    add_rewrite_rule('^service-desk(/.*)?$', 'index.php?pagename=service-desk', 'top');
}
add_action('init', 'wello_servicedesk_rewrite_rule');

function wello_servicedesk_flush_rewrite_rules()
{
    wello_servicedesk_rewrite_rule();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'wello_servicedesk_flush_rewrite_rules');

// Admin Menu and Settings Page
function wello_servicedesk_admin_menu()
{
    add_menu_page(
        __('Service Desk Settings', 'wello-servicedesk-api'),
        __('Service Desk', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-settings',
        'wello_servicedesk_settings_page'
    );

    add_submenu_page(
        'wello-servicedesk-settings',
        __('Generate Access Token', 'wello-servicedesk-api'),
        __('Generate Token', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-generate-token', // ← the slug
        'wello_servicedesk_api_render_access_token_page'
    );

    add_submenu_page(
        'wello-servicedesk-settings',
        __('Support Page Content', 'wello-servicedesk-api'),
        __('Support Page', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-support-page',
        'wello_servicedesk_api_render_support_page_editor'
    );
}
add_action('admin_menu', 'wello_servicedesk_admin_menu');

require_once plugin_dir_path(__FILE__) . '/wello_servicedesk_generate_token_page.php';
require_once plugin_dir_path(__FILE__) . '/support-page-editor.php';

function wello_servicedesk_settings_page()
{
    echo '<div class="wrap"><h1>' . esc_html__('Service Desk Settings', 'wello-servicedesk-api') . '</h1><form method="post" action="' . esc_attr(admin_url('options.php')) . '">';
    settings_fields('wello_servicedesk_options_group');
    do_settings_sections('wello-servicedesk-settings');
    submit_button();
    echo '</form></div>';
}

// Register Settings Fields
function wello_servicedesk_settings_init()
{
    register_setting(
        'wello_servicedesk_options_group',
        'wello_servicedesk_token',
        [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]
    );

    register_setting(
        'wello_servicedesk_options_group',
        'wello_logo_primary',
        [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ]
    );

    register_setting(
        'wello_servicedesk_options_group',
        'wello_logo_secondary',
        [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ]
    );

    register_setting(
        'wello_servicedesk_options_group',
        'wello_color_primary',
        [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_hex_color',
        ]
    );

    register_setting(
        'wello_servicedesk_options_group',
        'wello_bg_image',
        [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
        ]
    );

    register_setting(
        'wello_servicedesk_options_group',
        'wello_support_page_content',
        [
            'type'              => 'string',
            'sanitize_callback' => 'wp_kses_post',
        ]
    );

    // Settings section
    add_settings_section(
        'wello_servicedesk_section',
        __('General Settings', 'wello-servicedesk-api'),
        null,
        'wello-servicedesk-settings'
    );

    // Settings fields
    add_settings_field(
        'wello_servicedesk_token',
        __('Access Token', 'wello-servicedesk-api'),
        'wello_servicedesk_token_callback',
        'wello-servicedesk-settings',
        'wello_servicedesk_section'
    );

    add_settings_field(
        'wello_logo_primary',
        __('Primary Logo', 'wello-servicedesk-api'),
        'wello_logo_primary_callback',
        'wello-servicedesk-settings',
        'wello_servicedesk_section'
    );

    add_settings_field(
        'wello_logo_secondary',
        __('Secondary Logo', 'wello-servicedesk-api'),
        'wello_logo_secondary_callback',
        'wello-servicedesk-settings',
        'wello_servicedesk_section'
    );

    add_settings_field(
        'wello_color_primary',
        __('Primary Color', 'wello-servicedesk-api'),
        'wello_color_primary_callback',
        'wello-servicedesk-settings',
        'wello_servicedesk_section'
    );

    add_settings_field(
        'wello_bg_image',
        __('Main Page Banner', 'wello-servicedesk-api'),
        'wello_bg_image_callback',
        'wello-servicedesk-settings',
        'wello_servicedesk_section'
    );
}
add_action('admin_init', 'wello_servicedesk_settings_init');

// Input Field Callbacks
function wello_servicedesk_token_callback()
{
    $token = esc_attr(get_option('wello_servicedesk_token'));
    $generate_url = admin_url('admin.php?page=wello-servicedesk-generate-token');

    echo '<input type="text" readonly name="wello_servicedesk_token" value="' . esc_attr($token) . '" class="regular-text">';
    echo ' <a href="' . esc_url($generate_url) . '" class="button button-secondary">' . esc_html__('Generate Access Token', 'wello-servicedesk-api') . '</a>';
    echo '<p><small>' . esc_html__('Generate your access token, then save your changes to enable secure access and apply your configuration.', 'wello-servicedesk-api') . '</small></p>';
}

function wello_logo_primary_callback()
{
    $wello_logo_primary = esc_url(get_option('wello_logo_primary', ''));
    echo '<input type="text" name="wello_logo_primary" value="' . esc_attr($wello_logo_primary) . '" class="regular-text" id="wello_logo_primary">';
    echo ' <button type="button" class="button upload-media" data-target="wello_logo_primary">' . esc_html__('Select Image', 'wello-servicedesk-api') . '</button>';
    echo '<p><small>' . esc_html__('Image should be maximum 2MB.', 'wello-servicedesk-api') . '</small></p>';

    if (!empty($wello_logo_primary)) {
        echo '<div style="margin-top:10px;"><img src="' . esc_attr($wello_logo_primary) . '" alt="' . esc_attr(__('Logo Primary', 'wello-servicedesk-api')) . '" style="max-width:150px;height:auto;border:1px solid #ccc;padding:5px;"></div>';
    }
}
function wello_logo_secondary_callback()
{
    $wello_logo_secondary = esc_url(get_option('wello_logo_secondary', ''));
    echo '<input type="text" name="wello_logo_secondary" value="' . esc_attr($wello_logo_secondary) . '" class="regular-text" id="wello_logo_secondary">';
    echo ' <button type="button" class="button upload-media" data-target="wello_logo_secondary">' . esc_html__('Select Image', 'wello-servicedesk-api') . '</button>';
    echo '<p><small>' . esc_html__('Image should be maximum 2MB.', 'wello-servicedesk-api') . '</small></p>';

    if (!empty($wello_logo_secondary)) {
        echo '<div style="margin-top:10px;"><img src="' . esc_attr($wello_logo_secondary) . '" alt="' . esc_attr(__('Logo Secondary', 'wello-servicedesk-api')) . '" style="max-width:150px;height:auto;border:1px solid #ccc;padding:5px;"></div>';
    }
}

function wello_color_primary_callback()
{
    $wello_color_primary = esc_attr(get_option('wello_color_primary', '#003327'));
    echo '<input type="color" name="wello_color_primary" value="' . esc_attr($wello_color_primary) . '" id="wello_color_primary">';
    echo '<p><small>' . esc_html__('Select the primary color for the service desk.', 'wello-servicedesk-api') . '</small></p>';
}

function wello_bg_image_callback()
{
    $wello_bg_image = esc_url(get_option('wello_bg_image', ''));
    echo '<input type="text" name="wello_bg_image" value="' . esc_attr($wello_bg_image) . '" class="regular-text" id="wello_bg_image">';
    echo ' <button type="button" class="button upload-media" data-target="wello_bg_image">' . esc_html__('Select Image', 'wello-servicedesk-api') . '</button>';
    echo '<p><small>' . esc_html__('Image should be maximum 2MB.', 'wello-servicedesk-api') . '</small></p>';

    if (!empty($wello_bg_image)) {
        echo '<div style="margin-top:10px;"><img src="' . esc_attr($wello_bg_image) . '" alt="' . esc_attr(__('Background Image', 'wello-servicedesk-api')) . '" style="max-width:150px;height:auto;border:1px solid #ccc;padding:5px;"></div>';
    }
}

/**
 * Enqueue Media Uploader for Admin
 * 
 * @since 1.0.0
 */
function wello_enqueue_media_uploader()
{
    // Only enqueue on admin pages
    if (!is_admin()) {
        return;
    }

    wp_enqueue_media();
    
    $media_script_path = WELLO_SERVICEDESK_PLUGIN_DIR . 'js/wello-media.js';
    if (file_exists($media_script_path)) {
        wp_enqueue_script(
            'wello-media-uploader',
            WELLO_SERVICEDESK_PLUGIN_URL . 'js/wello-media.js',
            ['jquery'],
            filemtime($media_script_path),
            true
        );
    }
}
add_action('admin_enqueue_scripts', 'wello_enqueue_media_uploader');

//////////////////////////////////////////
function wello_keep_plugin_styles_only()
{

    if (is_admin()) {
        return;
    }

    if (get_page_template_slug(get_queried_object_id()) === 'wello-servicedesk-template.php') {

        // Keep plugin style
        $allowed_styles = ['wello-servicedesk-style'];

        global $wp_styles;

        if (!empty($wp_styles->queue)) {

            foreach ($wp_styles->queue as $handle) {

                if (!in_array($handle, $allowed_styles, true)) {
                    wp_dequeue_style($handle);
                    wp_deregister_style($handle);
                }
            }
        }
    }
}
add_action('wp_enqueue_scripts', 'wello_keep_plugin_styles_only', 999);


function wello_servicedesk_api_hide_admin_bar_for_template()
{
    if (is_page_template('wello-servicedesk-template.php')) {
        return false;
    }
    return true;
}
add_filter('show_admin_bar', 'wello_servicedesk_api_hide_admin_bar_for_template');
