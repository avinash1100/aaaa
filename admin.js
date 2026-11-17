/**
 * AEGIS LEARNING ACADEMY - STAFF & OWNER MEDIA ADMIN CONTROLLER (admin.html)
 * Uses Firebase Authentication (Google Sign-In) + Cloud Firestore.
 * Renders all user/admin text with textContent (never raw innerHTML).
 */

import {
  getAdminFirebaseClients,
  extractYouTubeId,
  createYouTubeIframe,
  getYouTubeWatchUrl,
  toTimestampMillis,
  ALLOWED_TYPES,
  ALLOWED_CLASSES,
  ALLOWED_SUBJECTS,
  ALLOWED_STATUSES
} from './media-shared.js';

const adminState = {
  db: null,
  auth: null,
  firestoreModule: null,
  authModule: null,
  currentUser: null,
  currentRole: null,
  mediaItems: [],
  editingItem: null
};

function showPanel(panelId) {
  const panels = [
    'adminConfigNotice',
    'adminSignedOutPanel',
    'adminPendingPanel',
    'adminWorkspacePanel'
  ];
  panels.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = id !== panelId;
    }
  });
}

function setBannerMessage(text, isError = false) {
  const banner = document.getElementById('adminStatusBanner');
  if (!banner) return;
  if (!text) {
    banner.hidden = true;
    banner.textContent = '';
    banner.className = 'admin-alert';
    return;
  }
  banner.hidden = false;
  banner.className = isError ? 'admin-alert admin-alert-error' : 'admin-alert admin-alert-success';
  banner.textContent = text;
}

function updateLiveYouTubePreview() {
  const urlInput = document.getElementById('mediaYoutubeInput');
  const feedbackEl = document.getElementById('youtubeUrlFeedback');
  const previewWrap = document.getElementById('adminYoutubePreviewWrap');
  const previewContainer = document.getElementById('adminYoutubePreviewPlayer');
  if (!urlInput || !feedbackEl || !previewWrap || !previewContainer) return null;

  const raw = urlInput.value.trim();
  if (!raw) {
    feedbackEl.textContent =
      'Paste a YouTube watch?v=, youtu.be/, /embed/, or /shorts/ link (unlisted links work too).';
    feedbackEl.className = 'admin-field-hint';
    previewWrap.hidden = true;
    previewContainer.replaceChildren();
    return null;
  }

  const ytId = extractYouTubeId(raw);
  if (!ytId) {
    feedbackEl.textContent =
      'Invalid YouTube URL. Please enter a valid watch?v=, youtu.be/, /embed/, or /shorts/ link with an 11-character video ID.';
    feedbackEl.className = 'admin-field-hint admin-field-error';
    previewWrap.hidden = true;
    previewContainer.replaceChildren();
    return null;
  }

  feedbackEl.textContent = `Valid YouTube ID extracted: ${ytId}`;
  feedbackEl.className = 'admin-field-hint admin-field-valid';
  previewWrap.hidden = false;

  if (previewContainer.dataset.previewId !== ytId) {
    previewContainer.dataset.previewId = ytId;
    previewContainer.replaceChildren(createYouTubeIframe(ytId, 'Admin YouTube Preview', false));
  }
  return ytId;
}

function updateCharCounts() {
  const titleInput = document.getElementById('mediaTitleInput');
  const titleCount = document.getElementById('titleCharCount');
  if (titleInput && titleCount) {
    titleCount.textContent = `${titleInput.value.length} / 120`;
  }

  const descInput = document.getElementById('mediaDescInput');
  const descCount = document.getElementById('descCharCount');
  if (descInput && descCount) {
    descCount.textContent = `${descInput.value.length} / 500`;
  }
}

function resetMediaForm() {
  adminState.editingItem = null;
  const form = document.getElementById('adminMediaForm');
  if (form) form.reset();

  const heading = document.getElementById('mediaFormHeading');
  if (heading) heading.textContent = 'Add New Podcast or Video';

  const submitBtn = document.getElementById('mediaFormSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Save Entry';

  const cancelBtn = document.getElementById('mediaFormCancelBtn');
  if (cancelBtn) cancelBtn.hidden = true;

  const previewContainer = document.getElementById('adminYoutubePreviewPlayer');
  if (previewContainer) {
    delete previewContainer.dataset.previewId;
    previewContainer.replaceChildren();
  }
  const previewWrap = document.getElementById('adminYoutubePreviewWrap');
  if (previewWrap) previewWrap.hidden = true;

  updateCharCounts();
  updateLiveYouTubePreview();
}

function populateFormForEdit(item) {
  adminState.editingItem = item;

  const heading = document.getElementById('mediaFormHeading');
  if (heading) heading.textContent = `Edit Entry: ${item.title}`;

  const typeSelect = document.getElementById('mediaTypeSelect');
  if (typeSelect) typeSelect.value = item.type;

  const titleInput = document.getElementById('mediaTitleInput');
  if (titleInput) titleInput.value = item.title;

  const ytInput = document.getElementById('mediaYoutubeInput');
  if (ytInput) ytInput.value = getYouTubeWatchUrl(item.youtubeId);

  const descInput = document.getElementById('mediaDescInput');
  if (descInput) descInput.value = item.description || '';

  const subjectSelect = document.getElementById('mediaSubjectSelect');
  if (subjectSelect) subjectSelect.value = item.subject;

  const statusSelect = document.getElementById('mediaStatusSelect');
  if (statusSelect) statusSelect.value = item.status;

  const classCheckboxes = document.querySelectorAll('input[name="mediaClassTag"]');
  classCheckboxes.forEach((cb) => {
    cb.checked = Array.isArray(item.classTags) && item.classTags.includes(cb.value);
  });

  const submitBtn = document.getElementById('mediaFormSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Update Entry';

  const cancelBtn = document.getElementById('mediaFormCancelBtn');
  if (cancelBtn) cancelBtn.hidden = false;

  updateCharCounts();
  updateLiveYouTubePreview();

  const formCard = document.getElementById('adminFormCard');
  if (formCard) {
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadAdminMediaEntries() {
  const listEl = document.getElementById('adminMediaList');
  const countEl = document.getElementById('adminMediaCount');
  if (!listEl) return;

  listEl.replaceChildren();
  const loadingP = document.createElement('p');
  loadingP.className = 'admin-empty-note';
  loadingP.textContent = 'Loading media entries...';
  listEl.appendChild(loadingP);

  try {
    const { collection, getDocs } = adminState.firestoreModule;
    const snap = await getDocs(collection(adminState.db, 'media'));
    const items = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({
        id: docSnap.id,
        type: data.type || 'video',
        title: String(data.title || ''),
        description: String(data.description || ''),
        youtubeId: String(data.youtubeId || ''),
        classTags: Array.isArray(data.classTags) ? data.classTags.map(String) : [],
        subject: String(data.subject || 'Maths & Science'),
        status: String(data.status || 'draft'),
        createdBy: data.createdBy || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });

    items.sort((a, b) => toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt));
    adminState.mediaItems = items;

    if (countEl) {
      countEl.textContent = `${items.length} total`;
    }

    listEl.replaceChildren();
    if (items.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'admin-empty-note';
      emptyP.textContent = 'No podcasts or videos added yet. Use the form on the left to add your first entry.';
      listEl.appendChild(emptyP);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'admin-entry-card';

      const topRow = document.createElement('div');
      topRow.className = 'admin-entry-top';

      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'media-badges-row';

      const statusBadge = document.createElement('span');
      statusBadge.className =
        item.status === 'published'
          ? 'media-badge media-badge-published'
          : 'media-badge media-badge-draft';
      statusBadge.textContent = item.status === 'published' ? 'Published' : 'Draft';
      badgesWrap.appendChild(statusBadge);

      const typeBadge = document.createElement('span');
      typeBadge.className = `media-badge media-badge-type media-badge-${item.type}`;
      typeBadge.textContent = item.type === 'podcast' ? 'Podcast' : 'Video';
      badgesWrap.appendChild(typeBadge);

      const subjBadge = document.createElement('span');
      subjBadge.className = 'media-badge media-badge-subject';
      subjBadge.textContent = item.subject;
      badgesWrap.appendChild(subjBadge);

      item.classTags
        .slice()
        .sort((a, b) => Number(a) - Number(b))
        .forEach((cls) => {
          const cBadge = document.createElement('span');
          cBadge.className = 'media-badge media-badge-class';
          cBadge.textContent = `Class ${cls}`;
          badgesWrap.appendChild(cBadge);
        });

      topRow.appendChild(badgesWrap);
      row.appendChild(topRow);

      const titleH4 = document.createElement('h4');
      titleH4.className = 'admin-entry-title';
      titleH4.textContent = item.title;
      row.appendChild(titleH4);

      if (item.description) {
        const descP = document.createElement('p');
        descP.className = 'admin-entry-desc';
        descP.textContent = item.description;
        row.appendChild(descP);
      }

      const metaRow = document.createElement('div');
      metaRow.className = 'admin-entry-meta';

      const ytSpan = document.createElement('a');
      ytSpan.href = getYouTubeWatchUrl(item.youtubeId);
      ytSpan.target = '_blank';
      ytSpan.rel = 'noopener noreferrer';
      ytSpan.className = 'media-watch-link';
      ytSpan.textContent = `YouTube ID: ${item.youtubeId}`;
      metaRow.appendChild(ytSpan);

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'admin-entry-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => populateFormForEdit(item));
      actionsWrap.appendChild(editBtn);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn-primary btn-sm';
      toggleBtn.textContent = item.status === 'published' ? 'Unpublish' : 'Publish';
      toggleBtn.addEventListener('click', () => handleTogglePublish(item));
      actionsWrap.appendChild(toggleBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm admin-btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => handleDeleteEntry(item));
      actionsWrap.appendChild(deleteBtn);

      metaRow.appendChild(actionsWrap);
      row.appendChild(metaRow);

      listEl.appendChild(row);
    });
  } catch (err) {
    listEl.replaceChildren();
    const errP = document.createElement('p');
    errP.className = 'admin-empty-note';
    errP.textContent = `Error loading media entries: ${err.message || 'Check permissions'}`;
    listEl.appendChild(errP);
  }
}

async function handleTogglePublish(item) {
  const nextStatus = item.status === 'published' ? 'draft' : 'published';
  try {
    const { doc, setDoc, serverTimestamp } = adminState.firestoreModule;
    const ref = doc(adminState.db, 'media', item.id);
    await setDoc(ref, {
      type: item.type,
      title: item.title,
      description: item.description,
      youtubeId: item.youtubeId,
      classTags: item.classTags,
      subject: item.subject,
      status: nextStatus,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: serverTimestamp()
    });
    setBannerMessage(
      `"${item.title}" is now ${nextStatus === 'published' ? 'Published' : 'set to Draft'}.`
    );
    await loadAdminMediaEntries();
  } catch (err) {
    setBannerMessage(`Could not update status: ${err.message || 'Permission denied'}`, true);
  }
}

async function handleDeleteEntry(item) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${item.title}"?`
  );
  if (!confirmed) return;

  try {
    const { doc, deleteDoc } = adminState.firestoreModule;
    await deleteDoc(doc(adminState.db, 'media', item.id));
    if (adminState.editingItem && adminState.editingItem.id === item.id) {
      resetMediaForm();
    }
    setBannerMessage(`Deleted "${item.title}".`);
    await loadAdminMediaEntries();
  } catch (err) {
    setBannerMessage(`Could not delete entry: ${err.message || 'Permission denied'}`, true);
  }
}

async function handleMediaFormSubmit(e) {
  e.preventDefault();
  setBannerMessage('');

  const typeVal = document.getElementById('mediaTypeSelect')?.value || 'video';
  const titleVal = (document.getElementById('mediaTitleInput')?.value || '').trim();
  const rawUrl = (document.getElementById('mediaYoutubeInput')?.value || '').trim();
  const descVal = (document.getElementById('mediaDescInput')?.value || '').trim();
  const subjectVal = document.getElementById('mediaSubjectSelect')?.value || 'Maths & Science';
  const statusVal = document.getElementById('mediaStatusSelect')?.value || 'draft';

  const selectedClasses = Array.from(
    document.querySelectorAll('input[name="mediaClassTag"]:checked')
  )
    .map((cb) => cb.value)
    .filter((v) => ALLOWED_CLASSES.includes(v));

  if (!ALLOWED_TYPES.includes(typeVal)) {
    setBannerMessage('Please select a valid type (Video or Podcast).', true);
    return;
  }
  if (!titleVal || titleVal.length > 120) {
    setBannerMessage('Please enter a title between 1 and 120 characters.', true);
    return;
  }
  const youtubeId = extractYouTubeId(rawUrl);
  if (!youtubeId) {
    setBannerMessage(
      'Please enter a valid YouTube link (watch?v=, youtu.be/, /embed/, or /shorts/).',
      true
    );
    return;
  }
  if (descVal.length > 500) {
    setBannerMessage('Description must be 500 characters or fewer.', true);
    return;
  }
  if (selectedClasses.length === 0) {
    setBannerMessage('Please select at least one Class (Class 6 to 10).', true);
    return;
  }
  if (!ALLOWED_SUBJECTS.includes(subjectVal)) {
    setBannerMessage('Please select a valid Subject.', true);
    return;
  }
  if (!ALLOWED_STATUSES.includes(statusVal)) {
    setBannerMessage('Please select a valid Status (Draft or Published).', true);
    return;
  }

  const submitBtn = document.getElementById('mediaFormSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { collection, addDoc, doc, setDoc, serverTimestamp } = adminState.firestoreModule;
    if (adminState.editingItem) {
      const ref = doc(adminState.db, 'media', adminState.editingItem.id);
      await setDoc(ref, {
        type: typeVal,
        title: titleVal,
        description: descVal,
        youtubeId,
        classTags: selectedClasses,
        subject: subjectVal,
        status: statusVal,
        createdBy: adminState.editingItem.createdBy,
        createdAt: adminState.editingItem.createdAt,
        updatedAt: serverTimestamp()
      });
      setBannerMessage(`Updated "${titleVal}" successfully.`);
    } else {
      await addDoc(collection(adminState.db, 'media'), {
        type: typeVal,
        title: titleVal,
        description: descVal,
        youtubeId,
        classTags: selectedClasses,
        subject: subjectVal,
        status: statusVal,
        createdBy: adminState.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setBannerMessage(`Added "${titleVal}" successfully.`);
    }

    resetMediaForm();
    await loadAdminMediaEntries();
  } catch (err) {
    setBannerMessage(`Failed to save entry: ${err.message || 'Check rules/inputs'}`, true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function loadTeamUsers() {
  if (adminState.currentRole !== 'owner') return;
  const teamList = document.getElementById('adminTeamList');
  if (!teamList) return;

  teamList.replaceChildren();
  const loadingP = document.createElement('p');
  loadingP.className = 'admin-empty-note';
  loadingP.textContent = 'Loading staff accounts...';
  teamList.appendChild(loadingP);

  try {
    const { collection, getDocs } = adminState.firestoreModule;
    const snap = await getDocs(collection(adminState.db, 'users'));
    const users = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      users.push({
        uid: docSnap.id,
        email: String(d.email || ''),
        displayName: String(d.displayName || 'Staff User'),
        role: String(d.role || 'pending'),
        createdAt: d.createdAt || null
      });
    });

    users.sort((a, b) => toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt));
    teamList.replaceChildren();

    users.forEach((u) => {
      const card = document.createElement('div');
      card.className = 'admin-team-row';

      const info = document.createElement('div');
      info.className = 'admin-team-info';

      const nameStrong = document.createElement('strong');
      nameStrong.className = 'admin-team-name';
      nameStrong.textContent = u.displayName;
      info.appendChild(nameStrong);

      const emailSpan = document.createElement('span');
      emailSpan.className = 'admin-team-email';
      emailSpan.textContent = `${u.email} (UID: ${u.uid})`;
      info.appendChild(emailSpan);

      card.appendChild(info);

      const controls = document.createElement('div');
      controls.className = 'admin-team-controls';

      const roleBadge = document.createElement('span');
      roleBadge.className = `media-badge admin-role-badge admin-role-${u.role}`;
      roleBadge.textContent = u.role.toUpperCase();
      controls.appendChild(roleBadge);

      if (u.uid === adminState.currentUser.uid || u.role === 'owner') {
        const selfNote = document.createElement('span');
        selfNote.className = 'admin-self-note';
        selfNote.textContent = u.uid === adminState.currentUser.uid ? 'You (Owner)' : 'Owner';
        controls.appendChild(selfNote);
      } else {
        const nextRole = u.role === 'admin' ? 'pending' : 'admin';
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className =
          nextRole === 'admin' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
        actionBtn.textContent =
          nextRole === 'admin' ? 'Approve as Admin' : 'Set to Pending';
        actionBtn.addEventListener('click', () => handleUpdateUserRole(u, nextRole));
        controls.appendChild(actionBtn);
      }

      card.appendChild(controls);
      teamList.appendChild(card);
    });
  } catch (err) {
    teamList.replaceChildren();
    const errP = document.createElement('p');
    errP.className = 'admin-empty-note';
    errP.textContent = `Could not load team list: ${err.message || 'Check permissions'}`;
    teamList.appendChild(errP);
  }
}

async function handleUpdateUserRole(targetUser, newRole) {
  if (!targetUser || targetUser.uid === adminState.currentUser.uid) return;
  try {
    const { doc, setDoc } = adminState.firestoreModule;
    await setDoc(doc(adminState.db, 'users', targetUser.uid), {
      email: targetUser.email,
      displayName: targetUser.displayName,
      role: newRole,
      createdAt: targetUser.createdAt
    });
    setBannerMessage(`Updated ${targetUser.displayName} (${targetUser.email}) to "${newRole}".`);
    await loadTeamUsers();
  } catch (err) {
    setBannerMessage(`Could not update user role: ${err.message || 'Permission denied'}`, true);
  }
}

async function ensureUserDocAndRoute(user) {
  adminState.currentUser = user;
  const userSummary = document.getElementById('adminSignedInUserText');
  if (userSummary) {
    userSummary.textContent = `${user.displayName || 'Staff'} (${user.email || user.uid})`;
  }

  const { doc, getDoc, setDoc, serverTimestamp } = adminState.firestoreModule;
  const userRef = doc(adminState.db, 'users', user.uid);
  let snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: String(user.email || '').slice(0, 254),
      displayName: String(user.displayName || user.email || 'Staff Member').slice(0, 120),
      role: 'pending',
      createdAt: serverTimestamp()
    });
    snap = await getDoc(userRef);
  }

  const data = snap.data() || {};
  const role = data.role || 'pending';
  adminState.currentRole = role;

  const roleChip = document.getElementById('adminUserRoleChip');
  if (roleChip) {
    roleChip.textContent = role.toUpperCase();
  }

  if (role !== 'admin' && role !== 'owner') {
    const pendingEmail = document.getElementById('pendingUserEmail');
    const pendingUid = document.getElementById('pendingUserUid');
    if (pendingEmail) pendingEmail.textContent = user.email || 'No email';
    if (pendingUid) pendingUid.textContent = user.uid;
    showPanel('adminPendingPanel');
    return;
  }

  const teamTabBtn = document.getElementById('adminTabTeamBtn');
  if (teamTabBtn) {
    teamTabBtn.hidden = role !== 'owner';
  }

  showPanel('adminWorkspacePanel');
  await loadAdminMediaEntries();
  if (role === 'owner') {
    await loadTeamUsers();
  }
}

function bindAdminUiEvents() {
  const signInBtn = document.getElementById('adminGoogleSignInBtn');
  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      if (!adminState.auth || !adminState.authModule) return;
      setBannerMessage('');
      try {
        const provider = new adminState.authModule.GoogleAuthProvider();
        await adminState.authModule.signInWithPopup(adminState.auth, provider);
      } catch (err) {
        setBannerMessage(`Sign-in failed: ${err.message || 'Popup closed or blocked'}`, true);
      }
    });
  }

  const signOutBtns = document.querySelectorAll('[data-admin-signout]');
  signOutBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!adminState.auth || !adminState.authModule) return;
      await adminState.authModule.signOut(adminState.auth);
      resetMediaForm();
      setBannerMessage('');
    });
  });

  const refreshPendingBtn = document.getElementById('adminRefreshRoleBtn');
  if (refreshPendingBtn) {
    refreshPendingBtn.addEventListener('click', async () => {
      if (adminState.currentUser) {
        await ensureUserDocAndRoute(adminState.currentUser);
      }
    });
  }

  const urlInput = document.getElementById('mediaYoutubeInput');
  if (urlInput) {
    urlInput.addEventListener('input', updateLiveYouTubePreview);
  }

  const titleInput = document.getElementById('mediaTitleInput');
  if (titleInput) {
    titleInput.addEventListener('input', updateCharCounts);
  }

  const descInput = document.getElementById('mediaDescInput');
  if (descInput) {
    descInput.addEventListener('input', updateCharCounts);
  }

  const cancelBtn = document.getElementById('mediaFormCancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', resetMediaForm);
  }

  const form = document.getElementById('adminMediaForm');
  if (form) {
    form.addEventListener('submit', handleMediaFormSubmit);
  }

  const tabMediaBtn = document.getElementById('adminTabMediaBtn');
  const tabTeamBtn = document.getElementById('adminTabTeamBtn');
  const mediaPane = document.getElementById('adminMediaPane');
  const teamPane = document.getElementById('adminTeamPane');

  if (tabMediaBtn && tabTeamBtn && mediaPane && teamPane) {
    tabMediaBtn.addEventListener('click', () => {
      tabMediaBtn.classList.add('active');
      tabTeamBtn.classList.remove('active');
      mediaPane.hidden = false;
      teamPane.hidden = true;
    });

    tabTeamBtn.addEventListener('click', () => {
      if (adminState.currentRole !== 'owner') return;
      tabTeamBtn.classList.add('active');
      tabMediaBtn.classList.remove('active');
      mediaPane.hidden = true;
      teamPane.hidden = false;
      loadTeamUsers();
    });
  }
}

async function initAdminPage() {
  bindAdminUiEvents();
  updateCharCounts();
  updateLiveYouTubePreview();

  try {
    const clients = await getAdminFirebaseClients();
    if (!clients.configured) {
      showPanel('adminConfigNotice');
      return;
    }

    adminState.db = clients.db;
    adminState.auth = clients.auth;
    adminState.firestoreModule = clients.firestoreModule;
    adminState.authModule = clients.authModule;

    adminState.authModule.onAuthStateChanged(adminState.auth, async (user) => {
      const authBar = document.getElementById('adminAuthBar');
      if (!user) {
        adminState.currentUser = null;
        adminState.currentRole = null;
        if (authBar) authBar.hidden = true;
        showPanel('adminSignedOutPanel');
        return;
      }

      if (authBar) authBar.hidden = false;
      try {
        await ensureUserDocAndRoute(user);
      } catch (err) {
        setBannerMessage(`Authentication check error: ${err.message || 'Check Firestore rules'}`, true);
      }
    });
  } catch (err) {
    showPanel('adminConfigNotice');
    setBannerMessage(`Could not initialize Firebase: ${err.message || 'Check configuration'}`, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
  initAdminPage();
}
