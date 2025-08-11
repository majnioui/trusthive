(() => {
  function qs(el, s) { return el.querySelector(s); }

  function updateStarDisplay(container, value) {
    const stars = container.querySelectorAll('.thr-star');
    stars.forEach((s, i) => {
      if (i < value) s.classList.add('active'); else s.classList.remove('active');
    });
    // update rating meta if present
    const meta = container.closest('.trusthive-review-form').querySelector('.thr-rating-value');
    if (meta) meta.textContent = String(value || 0);
  }

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
    // rating may be stored in hidden input
    const ratingVal = parseInt(getVal('input[name="rating"]'), 10) || 0;
    const nameVal = getVal('input[name="author_name"]');
    const emailVal = getVal('input[name="author_email"]');
    const contentVal = getVal('textarea[name="content"]');

    // client-side validation
    const invalids = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!ratingVal || ratingVal < 1 || ratingVal > 5) invalids.push('rating');
    if (!nameVal) invalids.push('author_name');
    if (!emailVal || !emailRegex.test(emailVal)) invalids.push('author_email');
    if (!contentVal) invalids.push('content');

    // clear previous invalid markers
    ['input[name="rating"]','input[name="author_name"]','input[name="author_email"]','textarea[name="content"]'].forEach(sel=>{
      const el = qs(form, sel);
      if(el) el.classList.remove('invalid');
    });

    if (invalids.length) {
      if (msg) {
        msg.classList.add('error');
        msg.textContent = 'Please complete the required fields: ' + invalids.join(', ');
      }
      invalids.forEach(field => {
        const sel = field === 'rating' ? 'input[name="rating"]' : (field === 'content' ? 'textarea[name="content"]' : `input[name="${field}"]`);
        const el = qs(form, sel);
        if (el) el.classList.add('invalid');
      });
      return;
    }

    const data = {
      product_id: productId,
      author_name: nameVal,
      author_email: emailVal,
      rating: ratingVal,
      title: getVal('input[name="title"]'),
      content: contentVal,
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
      if (msg) {
        msg.classList.remove('error');
        msg.textContent = 'Thank you! Your review was submitted.';
      }
      form.reset();
      // reset star display if present
      const starContainer = form.querySelector('.thr-stars');
      if (starContainer) updateStarDisplay(starContainer, 0);
    })
    .catch((err) => {
      if (msg) {
        msg.classList.add('error');
        msg.textContent = err.message || 'Submission failed.';
      }
    });
  }

  document.addEventListener('submit', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('trusthive-review-form')) {
      handleSubmit(e);
    }
  });

  // star interactions
  document.addEventListener('click', (ev) => {
    const star = ev.target.closest ? ev.target.closest('.thr-star') : null;
    if (!star) return;
    const container = star.closest('.thr-stars');
    if (!container) return;
    const all = Array.from(container.querySelectorAll('.thr-star'));
    const index = all.indexOf(star);
    const value = index + 1;
    // set hidden input value
    const form = star.closest('.trusthive-review-form');
    if (form) {
      const hidden = form.querySelector('input[name="rating"]');
      if (hidden) hidden.value = String(value);
    }
    updateStarDisplay(container, value);
  });

  // hover state
  document.addEventListener('mouseover', (ev) => {
    const star = ev.target.closest ? ev.target.closest('.thr-star') : null;
    if (!star) return;
    const container = star.closest('.thr-stars');
    if (!container) return;
    const all = Array.from(container.querySelectorAll('.thr-star'));
    const index = all.indexOf(star);
    all.forEach((s, i) => {
      if (i <= index) s.classList.add('hover'); else s.classList.remove('hover');
    });
  });
  document.addEventListener('mouseout', (ev) => {
    const star = ev.target.closest ? ev.target.closest('.thr-star') : null;
    if (!star) return;
    const container = star.closest('.thr-stars');
    if (!container) return;
    const all = Array.from(container.querySelectorAll('.thr-star'));
    all.forEach((s) => s.classList.remove('hover'));
  });
})();
