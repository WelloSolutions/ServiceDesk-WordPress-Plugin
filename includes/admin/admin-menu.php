<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register admin menu pages.
 */
function wello_servicedesk_admin_menu()
{
    add_menu_page(
        __('Service Desk Settings', 'wello-servicedesk-api'),
        __('Service Desk', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-settings',
        'wello_servicedesk_settings_page'
    );

    add_submenu_page(
        'wello-servicedesk-settings',
        __('Connect to ServiceDesk', 'wello-servicedesk-api'),
        __('Connect', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-generate-token',
        'wello_servicedesk_render_api_connection_page' // ✅ FIXED
    );

    add_submenu_page(
        'wello-servicedesk-settings',
        __('Support Page Content', 'wello-servicedesk-api'),
        __('Support Page', 'wello-servicedesk-api'),
        'manage_options',
        'wello-servicedesk-support-page',
        'wello_servicedesk_api_render_support_page_editor'
    );
}
add_action('admin_menu', 'wello_servicedesk_admin_menu');