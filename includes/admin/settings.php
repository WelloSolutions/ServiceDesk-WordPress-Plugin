<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Render the main settings page.
 */
function wello_servicedesk_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Service Desk Settings', 'wello-servicedesk-api'); ?></h1>

        <form method="post" action="<?php echo esc_url(admin_url('options.php')); ?>">
            <?php
            settings_fields('wello_servicedesk_options_group');
            do_settings_sections('wello-servicedesk-settings');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}

/**
 * Settings fields list (TOKEN REMOVED)
 */
function wello_servicedesk_settings_fields()
{
    return array(
        'wello_logo_primary',
        'wello_logo_secondary',
        'wello_color_primary',
        'wello_bg_image',
        'wello_support_page_content',
    );
}

/**
 * Sanitizers
 */
function wello_servicedesk_settings_sanitizers()
{
    return array(
        'wello_logo_primary'         => 'esc_url_raw',
        'wello_logo_secondary'       => 'esc_url_raw',
        'wello_color_primary'        => 'sanitize_hex_color',
        'wello_bg_image'             => 'esc_url_raw',
        'wello_support_page_content' => 'wp_kses_post',
    );
}

/**
 * Register settings
 */
function wello_servicedesk_register_settings()
{
    $sanitizers = wello_servicedesk_settings_sanitizers();

    foreach (wello_servicedesk_settings_fields() as $field) {
        register_setting(
            'wello_servicedesk_options_group',
            $field,
            array(
                'type'              => 'string',
                'sanitize_callback' => isset($sanitizers[$field])
                    ? $sanitizers[$field]
                    : 'sanitize_text_field',
            )
        );
    }
}

/**
 * Add settings fields
 */
function wello_servicedesk_add_settings_fields()
{
    add_settings_section(
        'wello_servicedesk_section',
        __('General Settings', 'wello-servicedesk-api'),
        function () {
            echo '<p>' . esc_html__('Configure your ServiceDesk integration settings below.', 'wello-servicedesk-api') . '</p>';
        },
        'wello-servicedesk-settings'
    );

    // ✅ Connection Status instead of Token field
    add_settings_field(
        'wello_connection_status',
        __('ServiceDesk Connection', 'wello-servicedesk-api'),
        'wello_servicedesk_connection_status_callback',
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
 * Init settings
 */
function wello_servicedesk_settings_init()
{
    wello_servicedesk_register_settings();
    wello_servicedesk_add_settings_fields();
}
add_action('admin_init', 'wello_servicedesk_settings_init');

/**
 * ✅ Connection status display (NEW)
 */
function wello_servicedesk_connection_status_callback()
{
    $token = get_option('wello_servicedesk_token', '');

    if (!empty($token)) {
        echo '<span style="color:green;font-weight:bold;">✔ ' . esc_html__('Connected to ServiceDesk', 'wello-servicedesk-api') . '</span>';
    } else {
        echo '<span style="color:red;font-weight:bold;">✖ ' . esc_html__('Not connected', 'wello-servicedesk-api') . '</span>';
    }

    echo '<br><br>';

    echo '<a href="' . esc_url(admin_url('admin.php?page=wello-servicedesk-generate-token')) . '" class="button button-secondary">';
    echo esc_html__('Manage Connection', 'wello-servicedesk-api');
    echo '</a>';

    echo '<p class="description">';
    echo esc_html__('Connect your site to the external Wello ServiceDesk platform. This does not affect WordPress users or authentication.', 'wello-servicedesk-api');
    echo '</p>';
}

/**
 * Media field helper
 */
function wello_servicedesk_media_setting_field($option_name, $button_label, $image_alt)
{
    $image_url = esc_url(get_option($option_name, ''));
    ?>
    <input type="text" name="<?php echo esc_attr($option_name); ?>" value="<?php echo esc_attr($image_url); ?>" class="regular-text" id="<?php echo esc_attr($option_name); ?>">

    <button type="button" class="button upload-media" data-target="<?php echo esc_attr($option_name); ?>">
        <?php echo esc_html($button_label); ?>
    </button>

    <p class="description"><?php echo esc_html__('Image should be maximum 2MB.', 'wello-servicedesk-api'); ?></p>

    <?php if (!empty($image_url)) : ?>
        <div style="margin-top:10px;">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($image_alt); ?>" style="max-width:150px;height:auto;border:1px solid #ccc;padding:5px;">
        </div>
    <?php endif;
}

/**
 * Field callbacks
 */
function wello_logo_primary_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_logo_primary',
        __('Select Image', 'wello-servicedesk-api'),
        __('Primary Logo', 'wello-servicedesk-api')
    );
}

function wello_logo_secondary_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_logo_secondary',
        __('Select Image', 'wello-servicedesk-api'),
        __('Secondary Logo', 'wello-servicedesk-api')
    );
}

function wello_color_primary_callback()
{
    $color = get_option('wello_color_primary', '#003327');
    ?>
    <input type="color" name="wello_color_primary" value="<?php echo esc_attr($color); ?>">
    <p class="description"><?php echo esc_html__('Select the primary color for the service desk.', 'wello-servicedesk-api'); ?></p>
    <?php
}

function wello_bg_image_callback()
{
    wello_servicedesk_media_setting_field(
        'wello_bg_image',
        __('Select Image', 'wello-servicedesk-api'),
        __('Background Image', 'wello-servicedesk-api')
    );
}