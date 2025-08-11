const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();

app.use(express.json());

// simple file store for shops
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, 'data');
const SHOPS_FILE = path.join(DATA_DIR, 'shops.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SHOPS_FILE)) fs.writeFileSync(SHOPS_FILE, JSON.stringify({ shops: {} }, null, 2));
if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, JSON.stringify({ reviews: [] }, null, 2));

function loadShops() {
  try {
    return JSON.parse(fs.readFileSync(SHOPS_FILE, 'utf8'));
  } catch (e) {
    return { shops: {} };
  }
}

function saveShops(data) {
  fs.writeFileSync(SHOPS_FILE, JSON.stringify(data, null, 2));
}

function loadReviews() {
  try {
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  } catch (e) {
    return { reviews: [] };
  }
}

function saveReviews(data) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2));
}

const PORT = process.env.PORT || 3000;
const DASH_SECRET = process.env.DASHBOARD_SHARED_SECRET || process.env.DASH_SECRET || '';

function verifyToken(shop, ts, token, secret, maxAge = 300) {
  if (!shop || !ts || !token || !secret) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(ts, 10)) > maxAge) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${shop}|${ts}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch (e) {
    return false;
  }
}

app.get('/dashboard', async (req, res) => {
  const { shop, ts, token, wp_site } = req.query;
  // lookup shop secret from store
  const shopsData = loadShops();
  const shopEntry = shopsData.shops && shopsData.shops[shop] ? shopsData.shops[shop] : null;
  if (!shopEntry) {
    return res.status(404).send('Unknown shop');
  }
  const shopSecret = shopEntry.api_key;
  if (!verifyToken(shop, ts, token, shopSecret)) {
    return res.status(401).send('Invalid SSO token');
  }

  // Determine WP origin: prefer explicit `wp_site` query, otherwise use stored site_url from provisioning
  const wpOrigin = (wp_site && wp_site.trim()) ? wp_site : (shopEntry && shopEntry.site_url ? shopEntry.site_url : '');
  if (!wpOrigin) {
    return res.status(400).json({ ok: false, error: 'No WP site configured for this shop' });
  }
  const wpApi = `${wpOrigin.replace(/\/$/, '')}/wp-json/trusthive/v1/admin/reviews?shop=${encodeURIComponent(shop)}&ts=${ts}&token=${token}`;

  let reviews = { ok: false, items: [] };
  try {
    const r = await fetch(wpApi);
    reviews = await r.json();
  } catch (err) {
    // show fetch errors clearly
    reviews = { ok: false, error: err && err.message ? err.message : String(err) };
  }

  res.send(`<!doctype html>
  <html>
    <head><meta charset="utf-8"><title>TrustHive Dashboard - ${shop}</title></head>
    <body>
      <h1>TrustHive Dashboard - ${shop}</h1>
      <p>Connected to WP: ${wpOrigin || 'unspecified'}</p>
      <pre>${JSON.stringify(reviews, null, 2)}</pre>
      <p>Actions (examples):</p>
      <ul>
        <li>Approve: POST /wp-json/trusthive/v1/admin/reviews/{id}/action?action=approve&shop=...&ts=...&token=...</li>
        <li>Hide: POST ... action=hide</li>
        <li>Delete: POST ... action=delete</li>
      </ul>
    </body>
  </html>`);
});

// Provisioning endpoint: register a new shop and return a shared secret
app.post('/api/register', (req, res) => {
  const { site_url, site_name, admin_email } = req.body || {};
  if (!site_url) {
    return res.status(400).json({ ok: false, error: 'missing site_url' });
  }

  const data = loadShops();
  // generate a shop id and secret
  const shopId = 'shop-' + crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');

  data.shops[shopId] = {
    site_url,
    site_name: site_name || '',
    admin_email: admin_email || '',
    api_key: secret,
    created_at: new Date().toISOString(),
  };

  saveShops(data);

  return res.json({ ok: true, shop_id: shopId, api_key: secret });
});

// Accept reviews forwarded by the WP plugin. Persist to local store and return OK.
app.post('/api/reviews', (req, res) => {
  const payload = req.body || {};
  const shopId = payload.shop_id;
  const productId = payload.product_id;
  const author = payload.author || {};
  const rating = payload.rating;
  const title = payload.title || '';
  const content = payload.content || '';

  if (!shopId || !productId || !author || !author.name || !author.email || !rating || !content) {
    return res.status(400).json({ ok: false, error: 'missing required fields' });
  }

  // ensure shop exists (provisioned)
  const shopsData = loadShops();
  const shopEntry = shopsData.shops && shopsData.shops[shopId] ? shopsData.shops[shopId] : null;
  if (!shopEntry) {
    return res.status(404).json({ ok: false, error: 'unknown shop' });
  }

  const reviewsData = loadReviews();
  const id = 'rev-' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();
  const rec = {
    id,
    shop_id: shopId,
    product_id: productId,
    author: { name: author.name, email: author.email },
    rating: rating,
    title: title,
    content: content,
    source: payload.source || '',
    site_url: payload.site_url || shopEntry.site_url || '',
    created_at: now,
  };

  reviewsData.reviews.push(rec);
  saveReviews(reviewsData);

  return res.status(201).json({ ok: true, id });
});


app.listen(PORT, () => console.log(`TrustHive dashboard running on http://localhost:${PORT}`));
