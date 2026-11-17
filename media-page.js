/**
 * AEGIS LEARNING ACADEMY - PODCASTS & VIDEOS PAGE CONTROLLER (media.html)
 */

import {
  subscribePublishedMedia,
  createMediaCard,
  ALLOWED_CLASSES,
  ALLOWED_SUBJECTS
} from './media-shared.js';

const state = {
  allItems: [],
  typeFilter: 'all',
  classFilter: 'all',
  subjectFilter: 'all'
};

function renderStateMessage(container, { icon, title, subtitle, showReset = false, onReset = null }) {
  container.replaceChildren();
  container.hidden = false;

  const box = document.createElement('div');
  box.className = 'media-state-card';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'media-state-icon';
  const iEl = document.createElement('i');
  iEl.className = icon || 'fas fa-play-circle';
  iconWrap.appendChild(iEl);
  box.appendChild(iconWrap);

  const heading = document.createElement('h3');
  heading.className = 'media-state-title';
  heading.textContent = title;
  box.appendChild(heading);

  const para = document.createElement('p');
  para.className = 'media-state-desc';
  para.textContent = subtitle;
  box.appendChild(para);

  if (showReset && typeof onReset === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm';
    btn.style.marginTop = '1rem';
    btn.textContent = 'Reset Filters';
    btn.addEventListener('click', onReset);
    box.appendChild(btn);
  }

  container.appendChild(box);
}

function applyFilters() {
  const grid = document.getElementById('mediaGrid');
  const stateBox = document.getElementById('mediaStateBox');
  const countLabel = document.getElementById('mediaCountLabel');
  if (!grid || !stateBox) return;

  const filtered = state.allItems.filter((item) => {
    if (state.typeFilter !== 'all' && item.type !== state.typeFilter) {
      return false;
    }
    if (state.classFilter !== 'all') {
      const tags = Array.isArray(item.classTags) ? item.classTags : [];
      if (!tags.includes(state.classFilter)) return false;
    }
    if (state.subjectFilter !== 'all') {
      if (state.subjectFilter === 'Maths') {
        if (item.subject !== 'Maths' && item.subject !== 'Maths & Science') return false;
      } else if (state.subjectFilter === 'Science') {
        if (item.subject !== 'Science' && item.subject !== 'Maths & Science') return false;
      } else if (item.subject !== state.subjectFilter) {
        return false;
      }
    }
    return true;
  });

  if (countLabel) {
    countLabel.textContent =
      filtered.length === 1 ? 'Showing 1 episode' : `Showing ${filtered.length} episodes`;
  }

  grid.replaceChildren();

  if (filtered.length === 0) {
    grid.hidden = true;
    renderStateMessage(stateBox, {
      icon: 'fas fa-filter',
      title: 'No matching podcasts or videos found',
      subtitle: 'Try selecting a different Class, Subject, or switching back to "All".',
      showReset: true,
      onReset: resetAllFilters
    });
    return;
  }

  stateBox.hidden = true;
  stateBox.replaceChildren();
  grid.hidden = false;

  filtered.forEach((item) => {
    grid.appendChild(createMediaCard(item));
  });
}

function resetAllFilters() {
  state.typeFilter = 'all';
  state.classFilter = 'all';
  state.subjectFilter = 'all';

  document.querySelectorAll('.media-tab-btn').forEach((btn) => {
    const active = btn.dataset.mediaTab === 'all';
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const classSelect = document.getElementById('mediaClassFilter');
  const subjectSelect = document.getElementById('mediaSubjectFilter');
  if (classSelect) classSelect.value = 'all';
  if (subjectSelect) subjectSelect.value = 'all';

  applyFilters();
}

function bindFilterControls() {
  const tabButtons = document.querySelectorAll('.media-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.typeFilter = btn.dataset.mediaTab || 'all';
      applyFilters();
    });
  });

  const classSelect = document.getElementById('mediaClassFilter');
  if (classSelect) {
    classSelect.addEventListener('change', () => {
      const val = classSelect.value;
      state.classFilter = ALLOWED_CLASSES.includes(val) ? val : 'all';
      applyFilters();
    });
  }

  const subjectSelect = document.getElementById('mediaSubjectFilter');
  if (subjectSelect) {
    subjectSelect.addEventListener('change', () => {
      const val = subjectSelect.value;
      state.subjectFilter = ALLOWED_SUBJECTS.includes(val) ? val : 'all';
      applyFilters();
    });
  }
}

async function initMediaPage() {
  bindFilterControls();

  const grid = document.getElementById('mediaGrid');
  const stateBox = document.getElementById('mediaStateBox');
  const countLabel = document.getElementById('mediaCountLabel');
  if (!grid || !stateBox) return;

  try {
    await subscribePublishedMedia(
      ({ configured, items }) => {
        if (!configured) {
          grid.hidden = true;
          if (countLabel) countLabel.textContent = 'Library updating soon';
          renderStateMessage(stateBox, {
            icon: 'fas fa-podcast',
            title: 'Aegis Insights Coming Soon',
            subtitle:
              'Our Bengaluru faculty is curating chapter-by-chapter Maths & Science concept explainers, board exam tips, and parent guidance episodes for Classes 6 to 10. Please check back soon!'
          });
          return;
        }

        state.allItems = items;

        if (items.length === 0) {
          grid.hidden = true;
          if (countLabel) countLabel.textContent = '0 episodes available';
          renderStateMessage(stateBox, {
            icon: 'fas fa-video',
            title: 'No Aegis Insights Published Yet',
            subtitle:
              'New Maths and Science episodes from our teachers will appear here as soon as they are published.'
          });
          return;
        }

        stateBox.hidden = true;
        grid.hidden = false;
        applyFilters();
      },
      (err) => {
        console.warn('Real-time media error:', err);
        grid.hidden = true;
        if (countLabel) countLabel.textContent = '';
        renderStateMessage(stateBox, {
          icon: 'fas fa-exclamation-circle',
          title: 'Unable to Load Aegis Insights Right Now',
          subtitle:
            'We had trouble connecting to the media library. Please check your internet connection or refresh the page in a moment.'
        });
      },
      0
    );
  } catch {
    grid.hidden = true;
    if (countLabel) countLabel.textContent = '';
    renderStateMessage(stateBox, {
      icon: 'fas fa-exclamation-circle',
      title: 'Unable to Load Aegis Insights Right Now',
      subtitle:
        'We had trouble connecting to the media library. Please check your internet connection or refresh the page in a moment.'
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMediaPage);
} else {
  initMediaPage();
}
