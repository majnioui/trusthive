(() => {
  function qs(el, s) { return el.querySelector(s); }

  function handleSubmit(e) {
    e.preventDefault();
    // find the form element from the event target (works when listener is on document)
    const form = (e.target && e.target.closest) ? e.target.closest('.trusthive-review-form') : e.target;
    if (!form) return;

    const getVal = (sel) => {
      const el = qs(form, sel);
      return el && typeof el.value !== 'undefined' ? el.value.trim() : '';
    };

    const productId = parseInt(form.getAttribute && form.getAttribute('data-product-id'), 10) || TrustHiveReviews.productId || 0;
    const data = {
      product_id: productId,
      author_name: getVal('input[name="author_name"]'),
      author_email: getVal('input[name="author_email"]'),
      rating: parseInt(getVal('input[name="rating"]'), 10) || 0,
      title: getVal('input[name="title"]'),
      content: getVal('textarea[name="content"]'),
    };

    const msg = qs(form, '.thr-message');
    if (msg) msg.textContent = 'Submitting...';

    fetch(TrustHiveReviews.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': TrustHiveReviews.nonce,
      },
      body: JSON.stringify(data),
      credentials: 'same-origin',
    })
    .then(async (res) => {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { json = { message: text }; }
      if (!res.ok) throw new Error(json.message || 'Submission failed');
      if (msg) msg.textContent = 'Thank you! Your review was submitted.';
      form.reset();
    })
    .catch((err) => {
      if (msg) msg.textContent = err.message || 'Submission failed.';
    });
  }

  document.addEventListener('submit', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('trusthive-review-form')) {
      handleSubmit(e);
    }
  });
})();

