<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Safely get an option with a matching sanitizer.
 *
 * @param string $option  Option name.
 * @param mixed  $default Default option value.
 * @param string $type    Sanitizer type.
 * @return mixed
 */
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

/**
 * Check whether the current request is a POST request.
 */
function wello_servicedesk_is_post_request()
{
    return isset($_SERVER['REQUEST_METHOD']) && 'POST' === $_SERVER['REQUEST_METHOD'];
}

/**
 * Read a sanitized text field from $_POST.
 */
function wello_servicedesk_post_text($key, $default = '')
{
    if (! isset($_POST[$key])) {
        return $default;
    }

    return sanitize_text_field(wp_unslash($_POST[$key]));
}

/**
 * Verify a nonce submitted through $_POST.
 */
function wello_servicedesk_verify_post_nonce($field, $action)
{
    $nonce = wello_servicedesk_post_text($field);

    return ! empty($nonce) && wp_verify_nonce($nonce, $action);
}

/**
 * Render a standard WordPress admin notice.
 */
function wello_servicedesk_admin_notice($message, $type = 'success')
{
    if (empty($message)) {
        return;
    }

    echo '<div class="notice notice-' . esc_attr($type) . '"><p>' . esc_html($message) . '</p></div>';
}
