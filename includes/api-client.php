<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Send a JSON request to the external Wello ServiceDesk API.
 *
 * This function communicates ONLY with an external API service.
 * It does NOT interact with WordPress authentication or users.
 */
function wello_servicedesk_api_request($path, $args = array())
{
    // Validate path
    $path = is_string($path) ? ltrim($path, '/') : '';

    // Prepare method
    $method = isset($args['method']) ? strtoupper(sanitize_text_field($args['method'])) : 'POST';

    // Prepare headers safely
    $headers = array();
    if (isset($args['headers']) && is_array($args['headers'])) {
        foreach ($args['headers'] as $key => $value) {
            $headers[sanitize_text_field($key)] = sanitize_text_field($value);
        }
    }

    // Prepare body
    $body = array_key_exists('body', $args) ? $args['body'] : null;

    // Timeout
    $timeout = isset($args['timeout']) ? absint($args['timeout']) : 20;

    // Build request args
    $request_args = array(
        'method'  => $method,
        'headers' => array_merge(
            array('Content-Type' => 'application/json'),
            $headers
        ),
        'timeout' => $timeout,
    );

    if (null !== $body) {
        $request_args['body'] = wp_json_encode($body);
    }

    // Build URL safely
    $base_url = esc_url_raw(WELLO_SERVICEDESK_API_BASE_URL);
    $url = trailingslashit($base_url) . $path;

    // Send request
    if ('POST' === $method) {
        $response = wp_remote_post($url, $request_args);
    } else {
        $response = wp_remote_request($url, $request_args);
    }

    // Handle WP error
    if (is_wp_error($response)) {
        return array(
            'error'   => true,
            'message' => $response->get_error_message(),
        );
    }

    return $response;
}

/**
 * Decode a WordPress remote response body as an array.
 */
function wello_servicedesk_api_response_body($response)
{
    if (is_array($response) && isset($response['error']) && $response['error'] === true) {
        return $response;
    }

    $raw_body = wp_remote_retrieve_body($response);

    $decoded = json_decode($raw_body, true);

    return is_array($decoded) ? $decoded : array();
}

/**
 * Get a safe message from an API response body.
 */
function wello_servicedesk_api_response_message($body, $default = '')
{
    if (is_array($body) && isset($body['message'])) {
        return sanitize_text_field($body['message']);
    }

    return sanitize_text_field($default);
}