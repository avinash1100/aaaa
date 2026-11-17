/**
 * AEGIS LEARNING ACADEMY - SHARED MEDIA & YOUTUBE HELPERS
 * ES module shared by media-page.js, home-media.js, and admin.js.
 */

import { FIREBASE_SDK_VERSION, firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

export const ALLOWED_TYPES = ['video', 'podcast'];
export const ALLOWED_CLASSES = ['6', '7', '8', '9', '10'];
export const ALLOWED_SUBJECTS = ['Maths', 'Science', 'Maths & Science'];
export const ALLOWED_STATUSES = ['draft', 'published'];

const YT_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

let cachedServicesPromise = null;

/**
 * Dynamically loads Firebase App and Firestore from the pinned gstatic CDN version.
 * Only imports when firebaseConfig has been filled in with real project credentials.
 */
export async function getFirestoreClient() {
  if (!isFirebaseConfigured()) {
    return { configured: false, app: null, db: null, firestoreModule: null };
  }
  if (!cachedServicesPromise) {
    cachedServicesPromise = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
      const [appModule, firestoreModule] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-firestore.js`)
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);
      const db = firestoreModule.getFirestore(app);
      return { configured: true, app, db, appModule, firestoreModule };
    })();
  }
  return cachedServicesPromise;
}

/**
 * Dynamically loads Firebase Auth alongside App and Firestore for admin.html.
 */
export async function getAdminFirebaseClients() {
  const baseClient = await getFirestoreClient();
  if (!baseClient.configured) {
    return { configured: false, app: null, db: null, auth: null, firestoreModule: null, authModule: null };
  }
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const authModule = await import(`${base}/firebase-auth.js`);
  const auth = authModule.getAuth(baseClient.app);
  return {
    ...baseClient,
    auth,
    authModule
  };
}

/**
 * Extracts a strict 11-character YouTube video ID from supported URL formats:
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX
 * - https://youtu.be/XXXXXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXXXXX
 * - https://www.youtube-nocookie.com/embed/XXXXXXXXXXX
 * - https://www.youtube.com/shorts/XXXXXXXXXXX
 * - Direct 11-character YouTube ID
 * Returns null for anything else.
 */
export function extractYouTubeId(rawInput) {
  if (typeof rawInput !== 'string') return null;
  const input = rawInput.trim();
  if (!input) return null;

  // Reject any input containing HTML angle brackets or script attempts
  if (/[<>'"`\s]/.test(input)) return null;

  if (YT_ID_REGEX.test(input)) {
    return input;
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  let candidate = null;

  if (host === 'youtu.be') {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      candidate = segments[0];
    }
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length === 2 && (segments[0] === 'embed' || segments[0] === 'shorts')) {
        candidate = segments[1];
      }
    }
  }

  if (candidate && YT_ID_REGEX.test(candidate)) {
    return candidate;
  }
  return null;
}

export function isValidYouTubeId(id) {
  return typeof id === 'string' && YT_ID_REGEX.test(id);
}

export function getYouTubeEmbedUrl(youtubeId, autoplay = false) {
  if (!isValidYouTubeId(youtubeId)) return '';
  const base = `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  return autoplay ? `${base}?autoplay=1&rel=0` : `${base}?rel=0`;
}

export function getYouTubeThumbnailUrl(youtubeId) {
  if (!isValidYouTubeId(youtubeId)) return '';
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function getYouTubeWatchUrl(youtubeId) {
  if (!isValidYouTubeId(youtubeId)) return '#';
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function toTimestampMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
}

/**
 * Fetches published media items using where('status', '==', 'published')
 * and sorts by createdAt descending in JS so no composite index is required.
 */
export async function fetchPublishedMedia(limitCount = 0) {
  const { configured, db, firestoreModule } = await getFirestoreClient();
  if (!configured || !db || !firestoreModule) {
    return { configured: false, items: [] };
  }

  const { collection, query, where, getDocs } = firestoreModule;
  const q = query(collection(db, 'media'), where('status', '==', 'published'));
  const snapshot = await getDocs(q);

  const items = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data && isValidYouTubeId(data.youtubeId)) {
      items.push({
        id: docSnap.id,
        type: ALLOWED_TYPES.includes(data.type) ? data.type : 'video',
        title: String(data.title || '').slice(0, 120),
        description: String(data.description || '').slice(0, 500),
        youtubeId: data.youtubeId,
        classTags: Array.isArray(data.classTags)
          ? data.classTags.filter((c) => ALLOWED_CLASSES.includes(String(c)))
          : [],
        subject: ALLOWED_SUBJECTS.includes(data.subject) ? data.subject : 'Maths & Science',
        status: data.status,
        createdAt: data.createdAt || null
      });
    }
  });

  items.sort((a, b) => toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt));

  if (limitCount > 0) {
    return { configured: true, items: items.slice(0, limitCount) };
  }
  return { configured: true, items };
}

/**
 * Real-time listener for published media using Firestore onSnapshot.
 * Notifies subscriber with live items whenever Firestore media collection changes.
 * Returns an unsubscribe callback.
 */
export async function subscribePublishedMedia(onUpdate, onError, limitCount = 0) {
  const { configured, db, firestoreModule } = await getFirestoreClient();
  if (!configured || !db || !firestoreModule) {
    if (typeof onUpdate === 'function') {
      onUpdate({ configured: false, items: [] });
    }
    return () => {};
  }

  const { collection, query, where, onSnapshot } = firestoreModule;
  const q = query(collection(db, 'media'), where('status', '==', 'published'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && isValidYouTubeId(data.youtubeId)) {
          items.push({
            id: docSnap.id,
            type: ALLOWED_TYPES.includes(data.type) ? data.type : 'video',
            title: String(data.title || '').slice(0, 120),
            description: String(data.description || '').slice(0, 500),
            youtubeId: data.youtubeId,
            classTags: Array.isArray(data.classTags)
              ? data.classTags.filter((c) => ALLOWED_CLASSES.includes(String(c)))
              : [],
            subject: ALLOWED_SUBJECTS.includes(data.subject) ? data.subject : 'Maths & Science',
            status: data.status,
            createdAt: data.createdAt || null
          });
        }
      });

      items.sort((a, b) => toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt));

      const finalItems = limitCount > 0 ? items.slice(0, limitCount) : items;
      if (typeof onUpdate === 'function') {
        onUpdate({ configured: true, items: finalItems });
      }
    },
    (err) => {
      console.warn('Real-time media subscription error:', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );

  return unsubscribe;
}

/**
 * Builds a compliant YouTube iframe element (no overlays, strict-origin-when-cross-origin).
 */
export function createYouTubeIframe(youtubeId, titleText = 'YouTube player', autoplay = false) {
  const iframe = document.createElement('iframe');
  iframe.className = 'media-iframe';
  iframe.src = getYouTubeEmbedUrl(youtubeId, autoplay);
  iframe.title = titleText || 'YouTube video player';
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.setAttribute(
    'allow',
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
  );
  iframe.allowFullscreen = true;
  return iframe;
}

/**
 * Builds a media card DOM element using textContent (never raw innerHTML)
 * and click-to-load player swap.
 */
export function createMediaCard(item) {
  const article = document.createElement('article');
  article.className = `media-card media-card-${item.type} insight-card insight-card-${item.type}`;
  article.dataset.mediaType = item.type;
  article.dataset.mediaSubject = item.subject;
  article.dataset.mediaClasses = (item.classTags || []).join(',');

  // 16:9 Player / Thumbnail Wrapper (nothing overlays the iframe once swapped)
  const playerWrap = document.createElement('div');
  playerWrap.className = 'media-player-wrap';

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.className = 'media-thumb-btn';
  thumbBtn.setAttribute('aria-label', `Play ${item.title}`);

  const thumbImg = document.createElement('img');
  thumbImg.className = 'media-thumb-img';
  thumbImg.src = getYouTubeThumbnailUrl(item.youtubeId);
  thumbImg.alt = item.title;
  thumbImg.loading = 'lazy';

  const playIndicator = document.createElement('span');
  playIndicator.className = `media-play-btn media-play-btn-${item.type}`;
  playIndicator.setAttribute('aria-hidden', 'true');
  const playIcon = document.createElement('i');
  playIcon.className = item.type === 'podcast' ? 'fas fa-headphones' : 'fas fa-play';
  playIndicator.appendChild(playIcon);

  thumbBtn.appendChild(thumbImg);
  thumbBtn.appendChild(playIndicator);

  thumbBtn.addEventListener('click', () => {
    const iframe = createYouTubeIframe(item.youtubeId, item.title, true);
    playerWrap.replaceChildren(iframe);
  });

  playerWrap.appendChild(thumbBtn);
  article.appendChild(playerWrap);

  // Card Body
  const body = document.createElement('div');
  body.className = 'media-card-body insight-card-body';

  // Badges Row (Type, Subject, Classes)
  const badgesRow = document.createElement('div');
  badgesRow.className = 'media-badges-row insight-badges-row';

  const typeBadge = document.createElement('span');
  typeBadge.className = `media-badge media-badge-type media-badge-${item.type} insight-badge insight-badge-${item.type}`;
  const typeIcon = document.createElement('i');
  typeIcon.className = item.type === 'podcast' ? 'fas fa-microphone-alt' : 'fas fa-video';
  typeBadge.appendChild(typeIcon);
  typeBadge.appendChild(document.createTextNode(item.type === 'podcast' ? ' Podcast' : ' Video Lesson'));
  badgesRow.appendChild(typeBadge);

  if (item.subject) {
    const subjectBadge = document.createElement('span');
    subjectBadge.className = 'media-badge media-badge-subject insight-badge insight-badge-subject';
    subjectBadge.textContent = item.subject;
    badgesRow.appendChild(subjectBadge);
  }

  const sortedClasses = [...(item.classTags || [])].sort((a, b) => Number(a) - Number(b));
  sortedClasses.forEach((cls) => {
    const classBadge = document.createElement('span');
    classBadge.className = 'media-badge media-badge-class insight-badge insight-badge-class';
    classBadge.textContent = `Class ${cls}`;
    badgesRow.appendChild(classBadge);
  });

  body.appendChild(badgesRow);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'media-card-title insight-card-title';
  titleEl.textContent = item.title;
  body.appendChild(titleEl);

  // Description
  if (item.description) {
    const descEl = document.createElement('p');
    descEl.className = 'media-card-desc insight-card-desc';
    descEl.textContent = item.description;
    body.appendChild(descEl);
  }

  // Footer with Watch on YouTube fallback link
  const footer = document.createElement('div');
  footer.className = 'media-card-footer insight-card-footer';

  const watchLink = document.createElement('a');
  watchLink.className = `media-watch-link media-watch-link-${item.type}`;
  watchLink.href = getYouTubeWatchUrl(item.youtubeId);
  watchLink.target = '_blank';
  watchLink.rel = 'noopener noreferrer';
  const ytIcon = document.createElement('i');
  ytIcon.className = item.type === 'podcast' ? 'fas fa-headphones' : 'fab fa-youtube';
  watchLink.appendChild(ytIcon);
  watchLink.appendChild(document.createTextNode(item.type === 'podcast' ? ' Listen on YouTube' : ' Watch on YouTube'));

  footer.appendChild(watchLink);
  body.appendChild(footer);

  article.appendChild(body);
  return article;
}
