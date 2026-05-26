<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * IMPORTANT:
 * External API only.
 * Does NOT affect WordPress authentication.
 */

/**
 * Render API Connection Page
 */
function wello_servicedesk_render_api_connection_page() {

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'wello-servicedesk-api' ) );
	}

	$state = array(
		'error_msg'   => '',
		'success_msg' => '',
		'api_token'   => get_option( 'wello_servicedesk_token', '' ),
	);

	/**
	 * Safe GET handling.
	 * Read-only display message.
	 */
	$token_cleared = filter_input(
		INPUT_GET,
		'token_cleared',
		FILTER_SANITIZE_FULL_SPECIAL_CHARS
	);

	if ( '1' === $token_cleared ) {
		$state['success_msg'] = __(
			'API token cleared successfully.',
			'wello-servicedesk-api'
		);
	}

	/**
	 * Handle POST requests only when nonce exists.
	 * PHPCS / WP.org compliant.
	 */
	$wello_nonce = filter_input(
	INPUT_POST,
	'wello_nonce',
	FILTER_SANITIZE_FULL_SPECIAL_CHARS
);

if ( ! empty( $wello_nonce ) ) {
	$state = wello_servicedesk_handle_api_post( $state );
}

	wello_servicedesk_render_api_page( $state );
}

/**
 * Handle POST requests
 */
function wello_servicedesk_handle_api_post( $state ) {

	/**
	 * Verify nonce before processing POST data.
	 */
	if (
	! isset( $_POST['wello_nonce'] ) ||
	! wp_verify_nonce(
		sanitize_text_field( wp_unslash( $_POST['wello_nonce'] ) ),
		'wello_action'
	)
) {
	wp_die(
		esc_html__( 'Security check failed.', 'wello-servicedesk-api' )
	);
}

	/**
	 * Clear Token
	 */
	if ( isset( $_POST['clear_token'] ) ) {

		delete_option( 'wello_servicedesk_token' );
		delete_transient( 'wello_api_otp' );

		$state['api_token']   = '';
		$state['success_msg'] = __(
			'Token cleared.',
			'wello-servicedesk-api'
		);

		return $state;
	}

	/**
	 * Request Verification Code
	 */
	if ( isset( $_POST['request_code'] ) ) {

		$email = isset( $_POST['api_email'] )
			? sanitize_email( wp_unslash( $_POST['api_email'] ) )
			: '';

		$secret = isset( $_POST['api_secret'] )
			? sanitize_text_field( wp_unslash( $_POST['api_secret'] ) )
			: '';

		if ( empty( $email ) || empty( $secret ) ) {

			$state['error_msg'] = __(
				'Invalid input.',
				'wello-servicedesk-api'
			);

			return $state;
		}

		$response = wello_servicedesk_api_request(
			'/api/Authentication/login',
			array(
				'method' => 'POST',
				'body'   => array(
					'useremail' => $email,
					'password'  => $secret,
				),
			)
		);

		if ( is_wp_error( $response ) ) {

			$state['error_msg'] = $response->get_error_message();

			return $state;
		}

		$body = wello_servicedesk_api_response_body( $response );

		if ( ! empty( $body['otp_token'] ) ) {

			set_transient(
				'wello_api_otp',
				wp_unslash( $body['otp_token'] ),
				15 * MINUTE_IN_SECONDS
			);

			$state['success_msg'] = __(
				'Verification code sent.',
				'wello-servicedesk-api'
			);

			return $state;
		}

		$state['error_msg'] = __(
			'Unable to request verification code.',
			'wello-servicedesk-api'
		);

		return $state;
	}

	/**
	 * Verify OTP Code
	 */
	if ( isset( $_POST['verify_code'] ) ) {

		$otp = isset( $_POST['otp_code'] )
			? sanitize_text_field( wp_unslash( $_POST['otp_code'] ) )
			: '';

		$otp_token = get_transient( 'wello_api_otp' );

		if ( empty( $otp_token ) ) {

			$state['error_msg'] = __(
				'Session expired. Try again.',
				'wello-servicedesk-api'
			);

			return $state;
		}

		$response = wello_servicedesk_api_request(
			'/api/Authentication/confirm-otp',
			array(
				'method' => 'POST',
				'body'   => array(
					'otp_token' => $otp_token,
					'otp_code'  => $otp,
				),
			)
		);

		if ( is_wp_error( $response ) ) {

			$state['error_msg'] = $response->get_error_message();

			return $state;
		}

		$body = wello_servicedesk_api_response_body( $response );

		if ( ! empty( $body['access_token'] ) ) {

			/**
			 * Do NOT sanitize tokens with sanitize_text_field().
			 * Tokens may contain + / = characters.
			 */
			$access_token = wp_unslash( $body['access_token'] );

			update_option(
				'wello_servicedesk_token',
				$access_token
			);

			delete_transient( 'wello_api_otp' );

			$state['api_token']   = $access_token;

			$state['success_msg'] = __(
				'API token generated successfully.',
				'wello-servicedesk-api'
			);

			return $state;
		}

		$state['error_msg'] = __(
			'Verification failed.',
			'wello-servicedesk-api'
		);

		return $state;
	}

	return $state;
}

/**
 * Render UI
 */
function wello_servicedesk_render_api_page( $state ) {

	$otp_token = get_transient( 'wello_api_otp' );
	?>

	<div class="wrap">

		<h1>
			<?php
			echo esc_html__(
				'Wello ServiceDesk Connection',
				'wello-servicedesk-api'
			);
			?>
		</h1>

		<?php wello_servicedesk_admin_notice( $state['success_msg'], 'success' ); ?>

		<?php wello_servicedesk_admin_notice( $state['error_msg'], 'error' ); ?>

		<?php if ( ! empty( $state['api_token'] ) ) : ?>

			<p>
				<strong>
					<?php
					echo esc_html__(
						'API Token:',
						'wello-servicedesk-api'
					);
					?>
				</strong>
			</p>

			<input
				type="text"
				value="<?php echo esc_attr( $state['api_token'] ); ?>"
				readonly
				style="width:50%;"
			/>

			<form method="post" style="margin-top:20px;">

				<?php wp_nonce_field( 'wello_action', 'wello_nonce' ); ?>

				<button
					type="submit"
					name="clear_token"
					class="button"
					onclick="return confirm('<?php echo esc_js( __( 'Are you sure you want to clear the access token?', 'wello-servicedesk-api' ) ); ?>');"
				>
					<?php
					echo esc_html__(
						'Clear Token',
						'wello-servicedesk-api'
					);
					?>
				</button>

			</form>

		<?php elseif ( ! $otp_token ) : ?>

			<form method="post">

				<?php wp_nonce_field( 'wello_action', 'wello_nonce' ); ?>

				<p>
					<label for="api_email">
						<?php
						echo esc_html__(
							'Email (ServiceDesk Account)',
							'wello-servicedesk-api'
						);
						?>
					</label>
					<br>

					<input
						type="email"
						id="api_email"
						name="api_email"
						required
					/>
				</p>

				<p>
					<label for="api_secret">
						<?php
						echo esc_html__(
							'Password (External Service)',
							'wello-servicedesk-api'
						);
						?>
					</label>
					<br>

					<input
						type="password"
						id="api_secret"
						name="api_secret"
						required
					/>
				</p>

				<button
					type="submit"
					name="request_code"
					class="button button-primary"
				>
					<?php
					echo esc_html__(
						'Request Verification Code',
						'wello-servicedesk-api'
					);
					?>
				</button>

			</form>

		<?php else : ?>

			<form method="post">

				<?php wp_nonce_field( 'wello_action', 'wello_nonce' ); ?>

				<p>
					<label for="otp_code">
						<?php
						echo esc_html__(
							'Verification Code',
							'wello-servicedesk-api'
						);
						?>
					</label>
					<br>

					<input
						type="text"
						id="otp_code"
						name="otp_code"
						required
					/>
				</p>

				<button
					type="submit"
					name="verify_code"
					class="button button-primary"
				>
					<?php
					echo esc_html__(
						'Verify Code',
						'wello-servicedesk-api'
					);
					?>
				</button>

			</form>

		<?php endif; ?>

	</div>

	<?php
}