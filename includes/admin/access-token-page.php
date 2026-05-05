<?php
// phpcs:disable WordPress.Security.NonceVerification.Missing -- Nonce verification is handled properly in this file
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Render the access token setup page.
 */
function wello_servicedesk_api_render_access_token_page()
{
    if (! current_user_can('manage_options')) {
        wp_die(esc_html__('You do not have sufficient permissions to access this page.', 'wello-servicedesk-api'));
    }

    $state = array(
        'error_msg'    => '',
        'success_msg'  => '',
        'access_token' => get_option('wello_access_token', '') ?: get_option('wello_servicedesk_token', ''),
    );

    $token_cleared = filter_input(INPUT_GET, 'token_cleared', FILTER_SANITIZE_STRING);
    if ('1' === $token_cleared) {
        $state['success_msg'] = __('Access token has been cleared successfully.', 'wello-servicedesk-api');
    }

    if (wello_servicedesk_is_post_request() && wello_servicedesk_access_token_post_has_valid_nonce($_POST)) {
        $state = wello_servicedesk_access_token_handle_post($state);
    }

    wello_servicedesk_access_token_render_page($state);
}

function wello_servicedesk_access_token_post_has_valid_nonce(array $post_data)
{
    return (
        (isset($post_data['clear_access_token']) && wello_servicedesk_verify_post_nonce('clear_access_token_nonce_field', 'clear_access_token_nonce', $post_data))
        || (isset($post_data['set_access_token']) && wello_servicedesk_verify_post_nonce('wello_set_access_token_nonce_field', 'wello_set_access_token_nonce', $post_data))
        || (isset($post_data['request_otp']) && wello_servicedesk_verify_post_nonce('request_otp_nonce_field', 'request_otp_nonce', $post_data))
        || (isset($post_data['confirm_otp']) && wello_servicedesk_verify_post_nonce('confirm_otp_nonce_field', 'confirm_otp_nonce', $post_data))
    );
}

function wello_servicedesk_access_token_handle_post($state)
{
    if (isset($_POST['clear_access_token']) && wello_servicedesk_verify_post_nonce('clear_access_token_nonce_field', 'clear_access_token_nonce', $_POST)) {
        return wello_servicedesk_access_token_clear($state);
    }

    if (isset($_POST['set_access_token']) && wello_servicedesk_verify_post_nonce('wello_set_access_token_nonce_field', 'wello_set_access_token_nonce', $_POST)) {
        return wello_servicedesk_access_token_set($state);
    }

    if (isset($_POST['request_otp']) && wello_servicedesk_verify_post_nonce('request_otp_nonce_field', 'request_otp_nonce', $_POST)) {
        return wello_servicedesk_access_token_handle_request_otp($state);
    }

    if (isset($_POST['confirm_otp']) && wello_servicedesk_verify_post_nonce('confirm_otp_nonce_field', 'confirm_otp_nonce', $_POST)) {
        return wello_servicedesk_access_token_handle_confirm_otp($state);
    }

    return $state;
}

function wello_servicedesk_access_token_set($state)
{
    $state['access_token'] = sanitize_text_field(wello_servicedesk_post_text('access_token', '', $_POST));
    update_option('wello_access_token', $state['access_token']);
    update_option('wello_servicedesk_token', $state['access_token']);

    $state['success_msg'] = __('Access token saved successfully.', 'wello-servicedesk-api');

    return $state;
}

function wello_servicedesk_access_token_handle_request_otp($state)
{
    $username = wello_servicedesk_post_text('wello_username', '', $_POST);
    $password = wello_servicedesk_post_text('wello_password', '', $_POST);
    $response = wello_servicedesk_access_token_request_otp($username, $password);

    if (is_wp_error($response)) {
        $state['error_msg'] = $response->get_error_message();
        return $state;
    }

    set_transient(
        'wello_otp_token',
        sanitize_text_field($response['otp_token']),
        15 * MINUTE_IN_SECONDS
    );

    $state['success_msg'] = wello_servicedesk_api_response_message(
        $response,
        __('OTP requested successfully.', 'wello-servicedesk-api')
    );

    return $state;
}

function wello_servicedesk_access_token_request_otp($username, $password)
{
    $response = wello_servicedesk_api_request(
        '/api/Authentication/login',
        array(
            'method' => 'POST',
            'body'   => array(
                'useremail' => $username,
                'password'  => $password,
            ),
        )
    );

    if (is_wp_error($response)) {
        return new WP_Error(
            'connection_error',
            __('Connection error. Please try again.', 'wello-servicedesk-api')
        );
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = wello_servicedesk_api_response_body($response);

    if (403 === $code && isset($body['error']) && 'forbidden' === $body['error']) {
        return new WP_Error(
            'forbidden',
            wello_servicedesk_api_response_message(
                $body,
                __('Thank you for your interest in the Wello Service desk plugin. You need to be an administrator to set up this plugin.', 'wello-servicedesk-api')
            )
        );
    }

    if (401 === $code && isset($body['error']) && 'invalid_credentials' === $body['error']) {
        return new WP_Error(
            'invalid_credentials',
            wello_servicedesk_api_response_message(
                $body,
                __('Email or password not valid. Please try again. You can try 3 times.', 'wello-servicedesk-api')
            )
        );
    }

    if (200 !== $code && isset($body['error'])) {
        return new WP_Error(
            'remote_error',
            wello_servicedesk_api_response_message($body, __('An error occurred', 'wello-servicedesk-api'))
        );
    }

    if (! empty($body['otp_token'])) {
        return $body;
    }

    return new WP_Error(
        'unexpected_response',
        wp_json_encode($body, JSON_PRETTY_PRINT)
    );
}

function wello_servicedesk_access_token_handle_confirm_otp($state)
{
    $otp_token = wello_servicedesk_post_text('otp_token', '', $_POST);
    $otp_code = wello_servicedesk_post_text('wello_otp_code', '', $_POST);
    $response = wello_servicedesk_access_token_confirm_otp($otp_token, $otp_code);

    if (is_wp_error($response)) {
        $state['error_msg'] = $response->get_error_message();
        return $state;
    }

    $state['access_token'] = sanitize_text_field($response['access_token']);
    update_option('wello_access_token', $state['access_token']);
    update_option('wello_servicedesk_token', $state['access_token']);
    delete_transient('wello_otp_token');

    $state['success_msg'] = wello_servicedesk_api_response_message(
        $response,
        __('Access token generated successfully.', 'wello-servicedesk-api')
    );

    return $state;
}

function wello_servicedesk_access_token_confirm_otp($otp_token, $otp_code)
{
    $response = wello_servicedesk_api_request(
        '/api/Authentication/confirm-otp',
        array(
            'method' => 'POST',
            'body'   => array(
                'otp_token' => $otp_token,
                'otp_code'  => $otp_code,
            ),
        )
    );

    if (is_wp_error($response)) {
        return new WP_Error(
            'connection_error',
            __('Connection error. Please try again.', 'wello-servicedesk-api')
        );
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = wello_servicedesk_api_response_body($response);

    if (200 !== $code) {
        return wello_servicedesk_access_token_otp_error($body);
    }

    if (! empty($body['access_token'])) {
        return $body;
    }

    return new WP_Error(
        'unexpected_response',
        __('Unexpected server response.', 'wello-servicedesk-api')
    );
}

function wello_servicedesk_access_token_otp_error($body)
{
    if (isset($body['error']) && 'invalid_credentials' === $body['error']) {
        return new WP_Error('invalid_otp', __('Invalid OTP code.', 'wello-servicedesk-api'));
    }

    if (isset($body['error']) && 'max_retry_exceeded' === $body['error']) {
        $attempts_left = isset($body['nb_retry']) ? intval($body['nb_retry']) : __('Unknown', 'wello-servicedesk-api');
        $message = __('Max attempts reached. Try again in 24 hours.', 'wello-servicedesk-api');
        $message .= ' ' . sprintf(
            /* translators: %s: Number of remaining attempts. */
            __('Attempts left: %s.', 'wello-servicedesk-api'),
            $attempts_left
        );

        return new WP_Error('max_retry_exceeded', $message);
    }

    return new WP_Error('otp_failed', __('OTP verification failed.', 'wello-servicedesk-api'));
}

function wello_servicedesk_access_token_clear($state)
{
    delete_option('wello_servicedesk_token');
    delete_option('wello_access_token');
    delete_transient('wello_otp_token');

    $state['access_token'] = '';
    $state['success_msg'] = __('Access token has been cleared successfully.', 'wello-servicedesk-api');

    return $state;
}

function wello_servicedesk_access_token_render_page($state)
{
    $otp_token = get_transient('wello_otp_token');
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Wello Service Desk - Access Token Setup', 'wello-servicedesk-api'); ?></h1>

        <?php if (! empty($state['success_msg'])) : ?>
            <?php wello_servicedesk_admin_notice($state['success_msg'], 'success'); ?>
        <?php endif; ?>

        <?php if (! empty($state['error_msg'])) : ?>
            <?php wello_servicedesk_admin_notice($state['error_msg'], 'error'); ?>
        <?php endif; ?>

        <?php if (! empty($state['access_token'])) : ?>
            <?php wello_servicedesk_access_token_render_set_form($state['access_token']); ?>
            <?php wello_servicedesk_access_token_render_clear_form(); ?>
        <?php elseif (! $otp_token) : ?>
            <?php wello_servicedesk_access_token_render_request_form(); ?>
        <?php else : ?>
            <?php wello_servicedesk_access_token_render_confirm_form($otp_token); ?>
        <?php endif; ?>
    </div>
    <?php
}

function wello_servicedesk_access_token_render_set_form($access_token)
{
    ?>
    <div style="margin-top: 20px;">
        <form method="post">
            <?php wp_nonce_field('wello_set_access_token_nonce', 'wello_set_access_token_nonce_field'); ?>
            <label for="access_token_display"><strong><?php echo esc_html__('Access Token:', 'wello-servicedesk-api'); ?></strong></label><br>
            <input type="text" id="access_token_display" name="access_token" value="<?php echo esc_attr($access_token); ?>" readonly style="width: 50%; margin-top: 10px;">
            <button type="submit" name="set_access_token" class="button" style="margin-top: 10px;"><?php echo esc_html__('Set Access Token', 'wello-servicedesk-api'); ?></button>
        </form>
    </div>
    <?php
}

function wello_servicedesk_access_token_render_clear_form()
{
    ?>
    <form method="post" style="margin-top: 15px;">
        <?php wp_nonce_field('clear_access_token_nonce', 'clear_access_token_nonce_field'); ?>
        <button
            type="submit"
            name="clear_access_token"
            class="button button-secondary"
            onclick="return confirm('<?php echo esc_js(__('Are you sure you want to clear the access token?', 'wello-servicedesk-api')); ?>');"
        >
            <?php echo esc_html__('Clear Access Token', 'wello-servicedesk-api'); ?>
        </button>
    </form>
    <?php
}

function wello_servicedesk_access_token_render_request_form()
{
    ?>
    <form method="post">
        <?php wp_nonce_field('request_otp_nonce', 'request_otp_nonce_field'); ?>
        <p>
            <label for="wello_username"><?php echo esc_html__('Username', 'wello-servicedesk-api'); ?></label><br>
            <input type="text" name="wello_username" id="wello_username" required>
        </p>
        <p>
            <label for="wello_password"><?php echo esc_html__('Password', 'wello-servicedesk-api'); ?></label><br>
            <input type="password" name="wello_password" id="wello_password" required>
        </p>
        <button type="submit" name="request_otp" class="button button-primary"><?php echo esc_html__('Request OTP', 'wello-servicedesk-api'); ?></button>
    </form>
    <?php
}

function wello_servicedesk_access_token_render_confirm_form($otp_token)
{
    ?>
    <form method="post">
        <?php wp_nonce_field('confirm_otp_nonce', 'confirm_otp_nonce_field'); ?>
        <input type="hidden" name="otp_token" value="<?php echo esc_attr($otp_token); ?>">
        <p>
            <label for="wello_otp_code"><?php echo esc_html__('OTP Code', 'wello-servicedesk-api'); ?></label><br>
            <input type="text" name="wello_otp_code" id="wello_otp_code" required>
        </p>
        <button type="submit" name="confirm_otp" class="button button-primary"><?php echo esc_html__('Confirm OTP', 'wello-servicedesk-api'); ?></button>
    </form>
    <?php
}
