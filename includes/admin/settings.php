<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Render the main settings page.
 */
function wello_servicedesk_settings_page()
{
    echo '<div class="wrap">';
    echo '<h1>' . esc_html__('Service Desk Settings', 'wello-servicedesk-api') . '</h1>';
    echo '<form method="post" action="' . esc_url(admin_url('options.php')) . '">';
    settings_fields('wello_servicedesk_options_group');
    do_settings_sections('wello-servicedesk-settings');
    submit_button();
    echo '</form>';
    echo '</div>';
}

function wello_servicedesk_settings_fields()
{
    return array(
        'wello_servicedesk_token',
        'wello_logo_primary',
        'wello_logo_secondary',
        'wello_color_primary',
        'wello_bg_image',
        'wello_access_token',
        'wello_support_page_content',
    );
}

function wello_servicedesk_settings_sanitizers()
{
    return array(
        'wello_servicedesk_token'    => 'sanitize_text_field',
        'wello_logo_primary'         => 'esc_url_raw',
        'wello_logo_secondary'       => 'esc_url_raw',
        'wello_color_primary'        => 'sanitize_hex_color',
        'wello_bg_image'             => 'esc_url_raw',
        'wello_access_token'         => 'sanitize_text_field',
        'wello_support_page_content' => 'wp_kses_post',
    );
}

function wello_servicedesk_register_settings()
{
    $sanitizers = wello_servicedesk_settings_sanitizers();

    foreach (wello_servicedesk_settings_fields() as $field) {
        register_setting(
            'wello_servicedesk_options_group',
            $field,
            array(
                'type'              => 'string',
                'sanitize_callback' => isset($sanitizers[$field]) ? $sanitizers[$field] : 'sanitize_text_field',
            )
        );
    }
}

function wello_servicedesk_add_settings_fields()
{
    add_settings_section(
        'wello_servicedesk_section',
        __('General Settings', 'wello-servicedesk-api'),
        null,
        'wello-servicedesk-settings'
    );

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

/**
 * Register settings and settings fields.
 */
function wello_servicedesk_settings_init()
{
    wello_servicedesk_register_settings();
    wello_servicedesk_add_settings_fields();
}
add_action('admin_init', 'wello_servicedesk_settings_init');

function wello_servicedesk_handle_access_token_submission()
{
    if (! wello_servicedesk_is_post_request() || ! isset($_POST['access_token'])) {
        return;
    }

    check_admin_referer('wello_set_access_token_nonce');

    $token = wello_servicedesk_post_text('access_token');
    update_option('wello_servicedesk_token', $token);
    update_option('wello_access_token', $token);
}

function wello_servicedesk_token_callback()
{
    wello_servicedesk_handle_access_token_submission();

    $token = get_option('wello_servicedesk_token', '') ?: get_option('wello_access_token', '');
    $generate_url = admin_url('admin.php?page=wello-servicedesk-generate-token');

    echo '<input type="text" readonly name="wello_servicedesk_token" value="' . esc_attr($token) . '" class="regular-text">';
    echo ' <a href="' . esc_url($generate_url) . '" class="button button-secondary">' . esc_html__('Generate Access Token', 'wello-servicedesk-api') . '</a>';
    echo '<p><small>' . esc_html__('Generate your access token, then save your changes to enable secure access and apply your configuration.', 'wello-servicedesk-api') . '</small></p>';
}

function wello_servicedesk_media_setting_field($option_name, $button_label, $image_alt)
{
    $image_url = esc_url(get_option($option_name, ''));

    echo '<input type="text" name="' . esc_attr($option_name) . '" value="' . esc_attr($image_url) . '" class="regular-text" id="' . esc_attr($option_name) . '">';
    echo ' <button type="button" class="button upload-media" data-target="' . esc_attr($option_name) . '">' . esc_html($button_label) . '</button>';
    echo '<p><small>' . esc_html__('Image should be maximum 2MB.', 'wello-servicedesk-api') . '</small></p>';

    if (! empty($image_url)) {
        echo '<div style="margin-top:10px;"><img src="' . esc_url($image_url) . '" alt="' . esc_attr($image_alt) . '" style="max-width:150px;height:auto;border:1px solid #ccc;padding:5px;"></div>';
    }
}

function wello_logo_primary_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_logo_primary',
        __('Select Image', 'wello-servicedesk-api'),
        __('Logo Primary', 'wello-servicedesk-api')
    );
}

function wello_logo_secondary_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_logo_secondary',
        __('Select Image', 'wello-servicedesk-api'),
        __('Logo Secondary', 'wello-servicedesk-api')
    );
}

function wello_color_primary_callback()
{
    $color = get_option('wello_color_primary', '#003327');

    echo '<input type="color" name="wello_color_primary" value="' . esc_attr($color) . '" id="wello_color_primary">';
    echo '<p><small>' . esc_html__('Select the primary color for the service desk.', 'wello-servicedesk-api') . '</small></p>';
}

function wello_bg_image_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_bg_image',
        __('Select Image', 'wello-servicedesk-api'),
        __('Background Image', 'wello-servicedesk-api')
    );
}
