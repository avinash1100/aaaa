/**
 * AEGIS LEARNING ACADEMY - HOME PAGE AEGIS INSIGHTS (REAL-TIME MEDIA)
 * Connects in real-time to Firebase Firestore (onSnapshot) to load and display
 * real published video lessons and podcast episodes dynamically.
 */

async function initHomeMedia() {
  const section = document.getElementById('insights') || document.getElementById('latest-media');
  const grid = document.getElementById('homeMediaGrid');
  const stateBox = document.getElementById('homeMediaState');
  const ctaWrap = document.getElementById('homeMediaCta');
  if (!section || !grid) return;

  function renderStateCard(icon, title, desc) {
    if (!stateBox) return;
    stateBox.replaceChildren();
    stateBox.hidden = false;

    const card = document.createElement('div');
    card.className = 'media-state-card';
    card.style.textAlign = 'center';
    card.style.padding = '2.5rem 1.5rem';
    card.style.background = 'var(--slate-50)';
    card.style.border = '1px solid var(--border-light)';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.maxWidth = '640px';
    card.style.margin = '0 auto';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'media-state-icon';
    iconWrap.style.fontSize = '2.5rem';
    iconWrap.style.color = 'var(--gold-500)';
    iconWrap.style.marginBottom = '1rem';
    const iEl = document.createElement('i');
    iEl.className = icon;
    iconWrap.appendChild(iEl);
    card.appendChild(iconWrap);

    const h3 = document.createElement('h3');
    h3.className = 'media-state-title';
    h3.style.fontSize = '1.25rem';
    h3.style.fontWeight = '700';
    h3.style.color = 'var(--navy-900)';
    h3.style.marginBottom = '0.5rem';
    h3.textContent = title;
    card.appendChild(h3);

    const p = document.createElement('p');
    p.className = 'media-state-desc';
    p.style.color = 'var(--slate-600)';
    p.style.fontSize = '0.95rem';
    p.style.lineHeight = '1.6';
    p.style.margin = '0';
    p.textContent = desc;
    card.appendChild(p);

    stateBox.appendChild(card);
  }

  try {
    const { isFirebaseConfigured } = await import('./firebase-config.js');
    if (!isFirebaseConfigured()) {
      renderStateCard(
        'fas fa-photo-video',
        'New Episodes Coming Soon',
        'Our academic faculty is currently recording new concept videos and podcast episodes. Check back soon!'
      );
      grid.hidden = true;
      if (ctaWrap) ctaWrap.hidden = true;
      return;
    }

    const { subscribePublishedMedia, createMediaCard } = await import('./media-shared.js');

    // Subscribe to live Firestore updates in real time
    await subscribePublishedMedia(
      ({ configured, items }) => {
        if (!configured) {
          renderStateCard(
            'fas fa-photo-video',
            'New Episodes Coming Soon',
            'Our academic faculty is currently recording new concept videos and podcast episodes. Check back soon!'
          );
          grid.hidden = true;
          if (ctaWrap) ctaWrap.hidden = true;
          return;
        }

        if (!Array.isArray(items) || items.length === 0) {
          // No published items yet in Firestore
          renderStateCard(
            'fas fa-photo-video',
            'New Episodes Coming Soon',
            'Our academic faculty is preparing brand-new concept videos and podcast episodes. Real-time updates published in the staff portal will appear here automatically.'
          );
          grid.hidden = true;
          grid.replaceChildren();
          if (ctaWrap) ctaWrap.hidden = true;
          return;
        }

        // Real items received from Firebase!
        if (stateBox) {
          stateBox.hidden = true;
          stateBox.replaceChildren();
        }

        grid.hidden = false;
        grid.replaceChildren();
        items.forEach((item) => {
          grid.appendChild(createMediaCard(item));
        });

        if (ctaWrap) ctaWrap.hidden = false;
      },
      (error) => {
        console.warn('Real-time media listener error:', error);
        renderStateCard(
          'fas fa-photo-video',
          'New Episodes Coming Soon',
          'Our academic faculty is recording new concept videos and podcast episodes. Check back soon!'
        );
        grid.hidden = true;
        if (ctaWrap) ctaWrap.hidden = true;
      },
      4 // Display up to 4 latest real-time published items on the homepage
    );
  } catch (err) {
    console.error('Error initializing Aegis Insights real-time media:', err);
    renderStateCard(
      'fas fa-photo-video',
      'New Episodes Coming Soon',
      'Our academic faculty is recording new concept videos and podcast episodes. Check back soon!'
    );
    grid.hidden = true;
    if (ctaWrap) ctaWrap.hidden = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeMedia);
} else {
  initHomeMedia();
}
