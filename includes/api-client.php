<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Send a JSON request to the external Wello ServiceDesk API.
 */
function wello_servicedesk_api_request($path, $args = array())
{
    $method = isset($args['method']) ? strtoupper($args['method']) : 'POST';
    $headers = isset($args['headers']) && is_array($args['headers']) ? $args['headers'] : array();
    $body = array_key_exists('body', $args) ? $args['body'] : null;
    $timeout = isset($args['timeout']) ? absint($args['timeout']) : 20;

    $request_args = array(
        'method'  => $method,
        'headers' => array_merge(array('Content-Type' => 'application/json'), $headers),
        'timeout' => $timeout,
    );

    if (null !== $body) {
        $request_args['body'] = wp_json_encode($body);
    }

    $url = WELLO_SERVICEDESK_API_URL . $path;

    if ('POST' === $method) {
        return wp_remote_post($url, $request_args);
    }

    return wp_remote_request($url, $request_args);
}

/**
 * Decode a WordPress remote response body as an array.
 */
function wello_servicedesk_api_response_body($response)
{
    $body = json_decode(wp_remote_retrieve_body($response), true);

    return is_array($body) ? $body : array();
}

/**
 * Get a safe message from an API response body.
 */
function wello_servicedesk_api_response_message($body, $default)
{
    if (isset($body['message'])) {
        return sanitize_text_field($body['message']);
    }

    return $default;
}
