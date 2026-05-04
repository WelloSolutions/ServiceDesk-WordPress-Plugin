<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Find the first generated asset matching a glob pattern.
 */
function wello_servicedesk_first_asset_file($directory, $pattern)
{
    if (! is_dir($directory)) {
        return '';
    }

    // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
    $files = @glob($directory . $pattern);

    if (empty($files) || ! is_array($files)) {
        return '';
    }

    $file_path = reset($files);

    return file_exists($file_path) ? $file_path : '';
}

/**
 * Get sanitized React settings for the frontend app.
 */
function wello_servicedesk_frontend_settings()
{
    return array(
        'logo_primary'         => wello_get_option('wello_logo_primary', '', 'url'),
        'logo_secondary'       => wello_get_option('wello_logo_secondary', '', 'url'),
        'color_primary'        => wello_get_option('wello_color_primary', '#003327', 'hex_color'),
        'background_image'     => wello_get_option('wello_bg_image', '', 'url'),
        'support_page_content' => wello_get_option('wello_support_page_content', '', 'html'),
        'service_access_token' => wello_get_option('wello_servicedesk_token', '', 'text'),
    );
}

/**
 * Enqueue frontend scripts and styles.
 */
function wello_servicedesk_enqueue_scripts()
{
    if (is_admin()) {
        return;
    }

    $script_handle = 'wello-servicedesk-script';
    $style_handle = 'wello-servicedesk-style';
    $css_dir = WELLO_SERVICEDESK_PLUGIN_DIR . 'app/build/static/css/';
    $js_dir = WELLO_SERVICEDESK_PLUGIN_DIR . 'app/build/static/js/';

    $css_file_path = wello_servicedesk_first_asset_file($css_dir, '*.css');
    if (! empty($css_file_path)) {
        wp_enqueue_style(
            $style_handle,
            WELLO_SERVICEDESK_PLUGIN_URL . 'app/build/static/css/' . basename($css_file_path),
            array(),
            filemtime($css_file_path)
        );
    }

    $js_file_path = wello_servicedesk_first_asset_file($js_dir, 'main.*.js');
    if (empty($js_file_path)) {
        return;
    }

    wp_register_script(
        $script_handle,
        WELLO_SERVICEDESK_PLUGIN_URL . 'app/build/static/js/' . basename($js_file_path),
        array('wp-element'),
        filemtime($js_file_path),
        true
    );
    wp_enqueue_script($script_handle);
    wp_localize_script($script_handle, 'welloServiceDesk', wello_servicedesk_frontend_settings());
}
add_action('wp_enqueue_scripts', 'wello_servicedesk_enqueue_scripts', 999);

/**
 * Enqueue media uploader assets for admin settings pages.
 */
function wello_enqueue_media_uploader()
{
    if (! is_admin()) {
        return;
    }

    wp_enqueue_media();

    $media_script_path = WELLO_SERVICEDESK_PLUGIN_DIR . 'js/wello-media.js';
    if (! file_exists($media_script_path)) {
        return;
    }

    wp_enqueue_script(
        'wello-media-uploader',
        WELLO_SERVICEDESK_PLUGIN_URL . 'js/wello-media.js',
        array('jquery'),
        filemtime($media_script_path),
        true
    );
}
add_action('admin_enqueue_scripts', 'wello_enqueue_media_uploader');

/**
 * Keep only plugin styles on the Service Desk template page.
 */
function wello_keep_plugin_styles_only()
{
    if (is_admin()) {
        return;
    }

    if ('wello-servicedesk-template.php' !== get_page_template_slug(get_queried_object_id())) {
        return;
    }

    $allowed_styles = array('wello-servicedesk-style');
    global $wp_styles;

    if (empty($wp_styles->queue)) {
        return;
    }

    foreach ($wp_styles->queue as $handle) {
        if (! in_array($handle, $allowed_styles, true)) {
            wp_dequeue_style($handle);
            wp_deregister_style($handle);
        }
    }
}
add_action('wp_enqueue_scripts', 'wello_keep_plugin_styles_only', 999);

/**
 * Hide WordPress admin bar on the Service Desk template.
 */
function wello_servicedesk_api_hide_admin_bar_for_template()
{
    if (is_page_template('wello-servicedesk-template.php')) {
        return false;
    }

    return true;
}
add_filter('show_admin_bar', 'wello_servicedesk_api_hide_admin_bar_for_template');
