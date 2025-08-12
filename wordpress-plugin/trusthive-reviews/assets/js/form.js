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

  function toggleReviewForm(widget) {
    const toggleBtn = widget.querySelector('.trusthive-review-toggle button');
    const form = widget.querySelector('.trusthive-review-form');

    if (form.classList.contains('expanded')) {
      form.classList.remove('expanded');
      toggleBtn.classList.remove('expanded');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Write a review
      `;
    } else {
      form.classList.add('expanded');
      toggleBtn.classList.add('expanded');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
        Close
      `;

      // Load reviews when form is opened
      loadReviews(widget);
    }
  }

  function loadReviews(widget) {
    const reviewsDisplay = widget.querySelector('.trusthive-reviews-display');
    if (!reviewsDisplay) return;

    const productId = parseInt(widget.getAttribute('data-product-id'), 10) || TrustHiveReviews.productId || 0;

    // Show loading state
    reviewsDisplay.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">Loading reviews...</div>';

    fetch(`${TrustHiveReviews.endpoint}?product_id=${productId}`, {
      method: 'GET',
      headers: {
        'X-WP-Nonce': TrustHiveReviews.nonce,
      },
      credentials: 'same-origin',
    })
    .then(async (res) => {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { json = { message: text }; }
      if (!res.ok) throw new Error(json.message || 'Failed to load reviews');

      displayReviews(reviewsDisplay, json);
    })
    .catch((err) => {
      reviewsDisplay.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading reviews: ${err.message}</div>`;
    });
  }

  function displayReviews(container, data) {
    const reviews = Array.isArray(data) ? data : (data.reviews || []);

    if (reviews.length === 0) {
      container.innerHTML = '<div class="trusthive-no-reviews">No reviews yet. Be the first to write one!</div>';
      return;
    }

    const reviewsHtml = reviews.map(review => `
      <div class="trusthive-review-item">
        <div class="trusthive-review-header">
          <div class="trusthive-review-author">${escapeHtml(review.author_name)}</div>
          <div class="trusthive-review-date">${formatDate(review.created_at)}</div>
        </div>
        <div class="trusthive-review-rating">
          ${generateStars(review.rating)}
        </div>
        ${review.title ? `<div class="trusthive-review-title">${escapeHtml(review.title)}</div>` : ''}
        <div class="trusthive-review-content">${escapeHtml(review.content)}</div>
      </div>
    `).join('');

    container.innerHTML = `
      <h3>Customer Reviews (${reviews.length})</h3>
      ${reviewsHtml}
    `;
  }

  function generateStars(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const color = i <= rating ? '#ffb238' : '#d1d5db';
      stars.push(`
        <span class="thr-star" style="color: ${color};">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .587l3.668 7.431L24 9.748l-6 5.848 1.416 8.264L12 19.771 4.584 23.86 6 15.596 0 9.748l8.332-1.73z"/>
          </svg>
        </span>
      `);
    }
    return stars.join('');
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      const msg = qs(form, '.thr-message');
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

      // Reload reviews to show the new one
      const widget = form.closest('.trusthive-review-widget');
      if (widget) {
        setTimeout(() => loadReviews(widget), 1000);
      }
    })
    .catch((err) => {
      if (msg) {
        msg.classList.add('error');
        msg.textContent = err.message || 'Submission failed.';
      }
    });
  }

  // Initialize widgets when DOM is ready
  function initWidgets() {
    const widgets = document.querySelectorAll('.trusthive-review-widget');
    widgets.forEach(widget => {
      const toggleBtn = widget.querySelector('.trusthive-review-toggle button');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleReviewForm(widget));
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgets);
  } else {
    initWidgets();
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
