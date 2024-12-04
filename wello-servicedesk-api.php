<?php
/**
 * Plugin Name: Wello Service Desk API
 * Description: A plugin that integrates a React app.
 * Version: 1.0
 * Author: Hemant
 */

function wello_servicedesk_enqueue_scripts() {
    $plugin_dir_url = plugin_dir_url(__FILE__);
    $plugin_dir_path = plugin_dir_path(__FILE__);

    // Enqueue CSS if it exists
    if (file_exists($plugin_dir_path . 'build/static/css/main.eee09f64.css')) {
        wp_enqueue_style(
            'wello-react-app',
            $plugin_dir_url . 'build/static/css/main.eee09f64.css',
            array(),
            filemtime($plugin_dir_path . 'build/static/css/main.eee09f64.css')
        );
    } else {
        error_log('CSS file not found: ' . $plugin_dir_path . 'build/static/css/main.eee09f64.css');
    }

    // Enqueue JS if it exists
    if (file_exists($plugin_dir_path . 'build/static/js/main.9c19dd9e.js')) {
        wp_enqueue_script(
            'wello-react-app',
            $plugin_dir_url . 'build/static/js/main.9c19dd9e.js',
            array('wp-element'), // WordPress' React dependency
            filemtime($plugin_dir_path . 'build/static/js/main.9c19dd9e.js'),
            true
        );
    } else {
        error_log('JS file not found: ' . $plugin_dir_path . 'build/static/js/main.9c19dd9e.js');
    }
}
add_action('wp_enqueue_scripts', 'wello_servicedesk_enqueue_scripts');

// Register custom template
function wello_servicedesk_template($templates) { 
    $templates['wello-servicedesk-template.php'] = 'Wello Service Desk Template'; 
    return $templates; 
} 
add_filter('theme_page_templates', 'wello_servicedesk_template');

// Set the template for the custom page
function wello_servicedesk_template_include($template) { 
    if (get_page_template_slug() === 'wello-servicedesk-template.php') { 
        $template = plugin_dir_path(__FILE__) . 'template/wello-servicedesk-template.php'; 
    } 
    return $template; 
} 
add_filter('template_include', 'wello_servicedesk_template_include');

// Create a page with slug /service-desk if it doesn't exist
function wello_servicedesk_create_page() {
    $page_slug = 'service-desk';
    $page_title = 'Service Desk';

    if (null === get_page_by_path($page_slug)) {
        // Create the page
        wp_insert_post(array(
            'post_title'    => $page_title,
            'post_name'     => $page_slug,
            'post_content'  => '', // No shortcode needed
            'post_status'   => 'publish',
            'post_type'     => 'page',
            'meta_input'    => array('_wp_page_template' => 'wello-servicedesk-template.php'),
        ));
    }
}
register_activation_hook(__FILE__, 'wello_servicedesk_create_page');


function wello_servicedesk_rewrite_rule() {
    add_rewrite_rule(
        '^service-desk(/.*)?$',
        'index.php?pagename=service-desk',
        'top'
    );
}
add_action('init', 'wello_servicedesk_rewrite_rule');

// Flush rewrite rules upon plugin activation
function wello_servicedesk_flush_rewrite_rules() {
    wello_servicedesk_rewrite_rule();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'wello_servicedesk_flush_rewrite_rules');

