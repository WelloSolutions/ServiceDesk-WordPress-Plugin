<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Register the plugin page template in the theme template selector.
 */
function wello_servicedesk_template($templates)
{
    $templates['wello-servicedesk-template.php'] = __('Wello Service Desk Template', 'wello-servicedesk-api');

    return $templates;
}
add_filter('theme_page_templates', 'wello_servicedesk_template');

/**
 * Load the plugin page template when it is selected.
 */
function wello_servicedesk_template_include($template)
{
    if ('wello-servicedesk-template.php' === get_page_template_slug()) {
        return WELLO_SERVICEDESK_PLUGIN_DIR . 'template/wello-servicedesk-template.php';
    }

    return $template;
}
add_filter('template_include', 'wello_servicedesk_template_include');

/**
 * Create the Service Desk page on plugin activation.
 */
function wello_servicedesk_create_page()
{
    $page_slug = 'service-desk';

    if (null !== get_page_by_path($page_slug)) {
        return;
    }

    wp_insert_post(
        array(
            'post_title'   => __('Service Desk', 'wello-servicedesk-api'),
            'post_name'    => $page_slug,
            'post_content' => '',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'meta_input'   => array(
                '_wp_page_template' => 'wello-servicedesk-template.php',
            ),
        )
    );
}
register_activation_hook(WELLO_SERVICEDESK_PLUGIN_FILE, 'wello_servicedesk_create_page');

/**
 * Add rewrite rule for React sub-routes under /service-desk.
 */
function wello_servicedesk_rewrite_rule()
{
    add_rewrite_rule('^service-desk(/.*)?$', 'index.php?pagename=service-desk', 'top');
}
add_action('init', 'wello_servicedesk_rewrite_rule');

/**
 * Refresh rewrite rules when the plugin is activated.
 */
function wello_servicedesk_flush_rewrite_rules()
{
    wello_servicedesk_rewrite_rule();
    flush_rewrite_rules();
}
register_activation_hook(WELLO_SERVICEDESK_PLUGIN_FILE, 'wello_servicedesk_flush_rewrite_rules');

/**
 * Flush rules on plugin deactivation.
 */
function wello_servicedesk_deactivate()
{
    flush_rewrite_rules();
}
register_deactivation_hook(WELLO_SERVICEDESK_PLUGIN_FILE, 'wello_servicedesk_deactivate');
