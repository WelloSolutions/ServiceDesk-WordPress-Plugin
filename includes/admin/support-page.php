<?php
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Render the support page content editor.
 */
function wello_servicedesk_api_render_support_page_editor()
{
    if (! current_user_can('manage_options')) {
        wp_die(esc_html__('You do not have sufficient permissions to access this page.', 'wello-servicedesk-api'));
    }

    $success_msg = wello_servicedesk_support_page_handle_save();
    $content = get_option('wello_support_page_content', '');
    ?>

    <div class="wrap">
        <h1><?php echo esc_html__('Support Page Content', 'wello-servicedesk-api'); ?></h1>

        <?php wello_servicedesk_admin_notice($success_msg, 'success'); ?>

        <form method="post" style="margin-top: 20px;">
            <?php
            wp_nonce_field('wello_save_support_page_content', 'wello_support_page_content_nonce');

            wp_editor(
                $content,
                'wello_support_page_content',
                array(
                    'textarea_name' => 'wello_support_page_content',
                    'media_buttons' => true,
                    'textarea_rows' => 15,
                    'teeny'         => false,
                )
            );
            ?>

            <p class="submit">
                <button type="submit" class="button button-primary">
                    <?php echo esc_html__('Save Content', 'wello-servicedesk-api'); ?>
                </button>
            </p>
        </form>
    </div>

    <?php
}

function wello_servicedesk_support_page_handle_save()
{
    if (! isset($_POST['wello_support_page_content_nonce'])) {
        return '';
    }

    check_admin_referer('wello_save_support_page_content');

    $content = isset($_POST['wello_support_page_content'])
        ? wp_kses_post(wp_unslash($_POST['wello_support_page_content']))
        : '';

    update_option('wello_support_page_content', $content);

    return __('Support page content saved.', 'wello-servicedesk-api');
}
