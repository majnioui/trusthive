# TrustHive Reviews for WooCommerce

Collect product reviews via a simple shortcode and forward them to an external TrustHive dashboard.

## Overview

This plugin provides a lightweight review collection form you can place on product pages (or any page) with a shortcode. Submitted reviews are validated server-side and forwarded to your TrustHive API endpoint configured in the plugin settings.

## Installation

- Copy the `trusthive-reviews` folder into your WordPress `wp-content/plugins/` directory (or install via your preferred workflow).
- Activate the plugin from the WordPress admin `Plugins` screen.

## Configuration

1. Go to `Settings » TrustHive Reviews` in the admin area.
2. Enter the following values and click _Save Settings_: 
   - **API Base URL**: The base URL of your TrustHive API (e.g. `https://api.trusthive.example.com`).
   - **Dashboard URL**: URL of your TrustHive dashboard (e.g. `https://www.coolest.moe`).
   - **Shop ID**: (optional) Your TrustHive shop identifier; if not set the provisioning flow will create one.
   - **API Key (Bearer)**: (optional) Bearer token used to authenticate requests to the TrustHive API; when using provisioning this will be filled automatically.

Note: The plugin will refuse to send reviews if the `API Base URL` or `Shop ID` are not configured.

### Automatic provisioning

If you host the external dashboard (for example `https://www.coolest.moe`), you can configure its URL in **Dashboard URL** and then click **Provision shop on dashboard** in the plugin settings. The plugin will POST site information to the dashboard's `/api/register` endpoint; the dashboard should return a `shop_id` and a shared `api_key` (secret) which the plugin stores automatically. After provisioning the admin can click **Open TrustHive Dashboard** to open the SSO link.

## Usage

Place the review form anywhere using the `[trusthive_reviews]` shortcode.

Shortcode examples:

 - Default (on product pages):

   [trusthive_reviews]

 - Forcing a specific product ID:

   [trusthive_reviews product_id="123"]

The form collects: name, email, rating (1–5), title and review content. Submitted data is sent to the plugin's REST endpoint which forwards it to your TrustHive API.

## REST Endpoint

The plugin exposes a REST endpoint used by the frontend form at:

 - `POST /wp-json/trusthive/v1/review`

Expected parameters (JSON or form-encoded):

 - `product_id` (integer, required)
 - `author_name` (string, required)
 - `author_email` (string, required)
 - `rating` (integer 1–5, required)
 - `title` (string, optional)
 - `content` (string, required)

The endpoint requires a valid WP REST nonce (the frontend form includes one). On success the endpoint returns `{ "ok": true }`.

## Local Storage & Moderation

Submitted reviews are now also persisted locally in the WordPress database as comments attached to the product (`comment_type` = `review`). Reviews are saved as pending (not approved) so the shop admin can review and approve or hide them from the public product page. The plugin stores rating and title as comment meta keys:

 - `trusthive_rating` — integer rating (1–5)
 - `trusthive_title` — optional review title
 - `trusthive_shop_id` — configured shop id

This allows store owners to retain a local copy and moderate reviews independently of the external TrustHive dashboard.

## Dashboard SSO (Open Dashboard button)

If you set a **Dashboard URL** and an **API Key** in settings, the _Open TrustHive Dashboard_ button will include a short-lived HMAC token so the admin can open the external dashboard (hosted on your server) without logging in. The link will include the following query parameters:

 - `shop` — the shop id
 - `ts` — UNIX timestamp used to build the token
 - `token` — HMAC-SHA256 of `shop|ts` using the API Key as the secret

Example verification pseudocode (server-side on your dashboard at `www.coolest.moe`):

```
# Pseudocode (verify request)
shop = request.query['shop']
ts = int(request.query['ts'])
token = request.query['token']

# reject if timestamp is older than e.g. 5 minutes
if abs(now_unix() - ts) > 300:
    reject()

expected = hmac_sha256(shop + '|' + str(ts), API_KEY_SHARED_WITH_PLUGIN)
if not secure_compare(expected, token):
    reject()

# token valid -> allow access and show only resources belonging to `shop`
```

Important: You must host and verify the token on `www.coolest.moe` (or whichever dashboard URL you set). The plugin does not transmit user credentials; the HMAC token is the SSO mechanism and requires the external app to verify the token and map `shop` to the correct account.

## Development

 - The main plugin file is `trusthive-reviews.php`.
 - Admin settings: `includes/class-trusthive-admin.php`
 - Shortcode & form: `includes/class-trusthive-shortcodes.php`
 - REST handling: `includes/class-trusthive-rest.php`

## Contributing

Please open issues or PRs for bugs and feature requests. Follow the repository guidelines for commits and tests.

## License

GPL2
