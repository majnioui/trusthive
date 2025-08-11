# TrustHive Dashboard (example)

Minimal Node/Express dashboard that verifies the HMAC SSO token from the plugin and fetches reviews via the admin WP endpoints.
It also exposes a provisioning endpoint used by the WordPress plugin to create a merchant account and return a shared secret.

Environment:

- `DASHBOARD_SHARED_SECRET` or `DASH_SECRET`: the shared API key (same as set in the plugin settings) used to verify tokens.

Run:

- `npm install`
- `DASHBOARD_SHARED_SECRET=your_shared_secret node server.js`

Open:

- Visit `/dashboard?shop=SHOP_ID&ts=TIMESTAMP&token=TOKEN&wp_site=https://your-wp-site.com`

Provisioning API:

- `POST /api/register` — called by the plugin to create a shop and receive credentials. JSON body: `{ "site_url": "https://...", "site_name": "...", "admin_email": "..." }`. Returns `{ "ok": true, "shop_id": "...", "api_key": "..." }`.

The plugin will call this endpoint when the merchant clicks **Provision shop on dashboard** in the plugin settings; the returned `shop_id` and `api_key` will be stored in the plugin options automatically.
