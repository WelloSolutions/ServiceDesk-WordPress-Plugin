<?php
if (!defined('ABSPATH')) {
    exit;
}

/*
 * IMPORTANT:
 * This module connects to an external Wello ServiceDesk API.
 * It does NOT authenticate WordPress users or create sessions.
 * All credentials are used only for external API communication.
 */

/**
 * Render Access Token Page
 */
function wello_servicedesk_render_api_connection_page()
{
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Insufficient permissions.', 'wello-servicedesk-api'));
    }

    $state = array(
        'error_msg'    => '',
        'success_msg'  => '',
        'api_token'    => get_option('wello_api_token', ''),
    );

    $token_cleared = isset($_GET['token_cleared'])
        ? sanitize_text_field(wp_unslash($_GET['token_cleared']))
        : '';

    if ($token_cleared === '1') {
        $state['success_msg'] = __('API token cleared successfully.', 'wello-servicedesk-api');
    }

    if (
        wello_servicedesk_is_post_request() &&
        wello_servicedesk_verify_post_nonce('wello_nonce', 'wello_action', $_POST)
    ) {
        $state = wello_servicedesk_handle_api_post($state);
    }

    wello_servicedesk_render_api_page($state);
}

/**
 * Handle POST
 */
function wello_servicedesk_handle_api_post($state)
{
    if (isset($_POST['clear_token'])) {
        delete_option('wello_servicedesk_token');
        delete_transient('wello_api_otp');

        $state['api_token'] = '';
        $state['success_msg'] = __('Token cleared.', 'wello-servicedesk-api');
        return $state;
    }

    if (isset($_POST['request_code'])) {
        return wello_servicedesk_request_api_code($state);
    }

    if (isset($_POST['verify_code'])) {
        return wello_servicedesk_verify_api_code($state);
    }

    return $state;
}

/**
 * Request OTP (external API)
 */
function wello_servicedesk_request_api_code($state)
{
    $email = wello_servicedesk_post_text('api_email', '', $_POST);
    $secret = wello_servicedesk_post_text('api_secret', '', $_POST);

    $response = wello_servicedesk_api_request('/api/Authentication/login', array(
        'method' => 'POST',
        'body'   => array(
            'useremail' => $email,
            'password'  => $secret,
        ),
    ));

    if (is_wp_error($response)) {
        $state['error_msg'] = $response->get_error_message();
        return $state;
    }

    $body = wello_servicedesk_api_response_body($response);

    if (!empty($body['otp_token'])) {
        set_transient('wello_api_otp', sanitize_text_field($body['otp_token']), 15 * MINUTE_IN_SECONDS);
        $state['success_msg'] = __('Verification code sent.', 'wello-servicedesk-api');
        return $state;
    }

    $state['error_msg'] = __('Unable to request verification code.', 'wello-servicedesk-api');
    return $state;
}

/**
 * Verify OTP
 */
function wello_servicedesk_verify_api_code($state)
{
    $otp = wello_servicedesk_post_text('otp_code', '', $_POST);
    $otp_token = get_transient('wello_api_otp');

    if (!$otp_token) {
        $state['error_msg'] = __('Session expired. Try again.', 'wello-servicedesk-api');
        return $state;
    }

    $response = wello_servicedesk_api_request('/api/Authentication/confirm-otp', array(
        'method' => 'POST',
        'body'   => array(
            'otp_token' => $otp_token,
            'otp_code'  => $otp,
        ),
    ));

    if (is_wp_error($response)) {
        $state['error_msg'] = $response->get_error_message();
        return $state;
    }

    $body = wello_servicedesk_api_response_body($response);

    if (!empty($body['access_token'])) {
        // Store external API token (NOT WP auth)
        update_option('wello_servicedesk_token', sanitize_text_field($body['access_token']));
        delete_transient('wello_api_otp');

        $state['api_token'] = $body['access_token'];
        $state['success_msg'] = __('API token generated successfully.', 'wello-servicedesk-api');
        return $state;
    }

    $state['error_msg'] = __('Verification failed.', 'wello-servicedesk-api');
    return $state;
}

/**
 * Render UI
 */
function wello_servicedesk_render_api_page($state)
{
    $otp_token = get_transient('wello_api_otp');
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Wello ServiceDesk Connection', 'wello-servicedesk-api'); ?></h1>

        <?php wello_servicedesk_admin_notice($state['success_msg'], 'success'); ?>
        <?php wello_servicedesk_admin_notice($state['error_msg'], 'error'); ?>

        <?php if (!empty($state['api_token'])) : ?>

            <p><strong><?php echo esc_html__('API Token:', 'wello-servicedesk-api'); ?></strong></p>
            <input type="text" value="<?php echo esc_attr($state['api_token']); ?>" readonly style="width:50%;" />

            <form method="post" style="margin-top:20px;">
                <?php wp_nonce_field('wello_action', 'wello_nonce'); ?>
                <button name="clear_token" class="button"
                    onclick="return confirm('<?php echo esc_js(__('Are you sure you want to clear the access token?', 'wello-servicedesk-api')); ?>');"
                ><?php echo esc_html__('Clear Token', 'wello-servicedesk-api'); ?></button>
            </form>

        <?php elseif (!$otp_token) : ?>

            <form method="post">
                <?php wp_nonce_field('wello_action', 'wello_nonce'); ?>

                <p>
                    <label><?php echo esc_html__('Email (ServiceDesk Account)', 'wello-servicedesk-api'); ?></label><br>
                    <input type="text" name="api_email" required>
                </p>

                <p>
                    <label><?php echo esc_html__('Password (External Service)', 'wello-servicedesk-api'); ?></label><br>
                    <input type="password" name="api_secret" required>
                </p>

                <button name="request_code" class="button button-primary">
                    <?php echo esc_html__('Request Verification Code', 'wello-servicedesk-api'); ?>
                </button>
            </form>

        <?php else : ?>

            <form method="post">
                <?php wp_nonce_field('wello_action', 'wello_nonce'); ?>

                <p>
                    <label><?php echo esc_html__('Verification Code', 'wello-servicedesk-api'); ?></label><br>
                    <input type="text" name="otp_code" required>
                </p>

                <button name="verify_code" class="button button-primary">
                    <?php echo esc_html__('Verify Code', 'wello-servicedesk-api'); ?>
                </button>
            </form>

        <?php endif; ?>
    </div>
    <?php
}