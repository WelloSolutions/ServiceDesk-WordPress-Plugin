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
    // Using WordPress function for better compatibility
    return isset($_SERVER['REQUEST_METHOD']) && 'POST' === $_SERVER['REQUEST_METHOD'];
}

/**
 * Read a sanitized text field from POST data.
 *
 * @param string $key     The key to look for.
 * @param mixed  $default Default value if key not found.
 * @param array  $post_data The POST data array.
 * @return mixed
 */
function wello_servicedesk_post_text($key, $default = '', $post_data = array())
{
    if (empty($post_data) || ! isset($post_data[$key])) {
        return $default;
    }

    return sanitize_text_field(wp_unslash($post_data[$key]));
}

/**
 * Verify a nonce submitted through POST data.
 *
 * @param string $field     The nonce field name.
 * @param string $action    The nonce action.
 * @param array  $post_data The POST data array.
 * @return bool
 */
function wello_servicedesk_verify_post_nonce($field, $action, $post_data = array())
{
    if (empty($post_data) || ! isset($post_data[$field])) {
        return false;
    }

    // Validate the nonce before sanitization.
    $nonce = wp_unslash($post_data[$field]);
    if (! wp_verify_nonce($nonce, $action)) {
        return false;
    }

    return true;
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
