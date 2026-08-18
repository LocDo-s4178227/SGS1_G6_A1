/**
* Discussion Forum Module JavaScript
* - Live form validation + error prevention
* - Web Storage API draft persistence (all forms)
* - Dynamic data retrieval + rendering (forum.html, thread list)
* - Client-side search/sort/filter (forum.html) + backend search/sort/filter on "Apply Filters"
* - Dynamic CRUD wired to the NodeJS API via fetch()
* - Auth wired to the shared User Account module (window.UserAccountAPI)
*/
// ==========================================
// CURRENT LOGGED-IN USER
// Reads from the real shared User Account module (user-account.js), which
// stores the logged-in user under localStorage key "user" and their token
// under "authToken" after a successful /api/auth/login or /api/auth/register.
// Make sure <script src=".../user-account.js"></script> is loaded on the
// page BEFORE this file, so window.UserAccountAPI is available.
// ==========================================
function getCurrentUser() {
if (window.UserAccountAPI && typeof window.UserAccountAPI.getCurrentUser === 'function') {
return window.UserAccountAPI.getCurrentUser();
}
// Fallback in case user-account.js hasn't loaded on this page yet.
try {
return JSON.parse(localStorage.getItem('user') || 'null');
} catch (e) {
return null;
}
}
function getAuthToken() {
return localStorage.getItem('authToken') || '';
}
// ==========================================
// API BASE URL
// The backend (server.js) runs on its own port, separate from wherever
// this static frontend is served from (Live Server, file://, etc).
// Change this if your backend runs on a different host/port.
// ==========================================
const API_BASE = 'http://localhost:5000';
// ==========================================
// SMALL HELPERS
// ==========================================
function getQueryParam(name) {
return new URLSearchParams(window.location.search).get(name);
}
async function apiRequest(path, options = {}) {
const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
const token = getAuthToken();
const response = await fetch(url, {
...options,
headers: {
'Content-Type': 'application/json',
// Sends the REAL login token issued by /api/auth/login (or /register).
// The server looks this token up itself to find out who is making the
// request - it does not trust any username the client claims to be,
// so a request can't be spoofed into editing/deleting someone else's post.
...(token ? { 'Authorization': `Bearer ${token}` } : {}),
...(options.headers || {})
}
});
let data = null;
try {
data = await response.json();
} catch (e) {
// no JSON body (e.g. some DELETE responses) - ignore
}
if (response.status === 401) {
// Token missing/expired/invalid - the server no longer recognizes this
// session. Send the user to the login page instead of leaving them on
// a broken form.
alert('Your session has expired. Please log in again.');
window.location.href = '../user_account/auth.html';
throw new Error('Not authenticated');
}
if (!response.ok) {
const message = (data && data.message) || `Request failed (${response.status})`;
throw new Error(message);
}
return data;
}
function escapeHtml(value) {
if (value === null || typeof value === 'undefined') return '';
return String(value)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');
}
function formatPostedDate(isoString) {
const date = new Date(isoString);
if (isNaN(date.getTime())) return '';
return date.toLocaleString('en-US', {
year: 'numeric',
month: 'short',
day: 'numeric',
hour: 'numeric',
minute: '2-digit'
});
}
function truncateText(text, maxLength = 160) {
if (!text) return '';
const trimmed = String(text).trim();
if (trimmed.length <= maxLength) return trimmed;
return `${trimmed.slice(0, maxLength).trim()}…`;
}
function showFieldError(inputEl, message) {
if (!inputEl) return;
const errorEl = document.getElementById(`${inputEl.id}-error`);
if (errorEl) {
errorEl.textContent = message;
errorEl.style.display = 'block';
}
inputEl.style.borderColor = '#dc3545';
}
function clearFieldError(inputEl) {
if (!inputEl) return;
const errorEl = document.getElementById(`${inputEl.id}-error`);
if (errorEl) {
errorEl.textContent = '';
errorEl.style.display = 'none';
}
inputEl.style.borderColor = '';
}
function validateTitleField(inputEl) {
if (!inputEl) return true;
const val = inputEl.value.trim();
if (!val) { showFieldError(inputEl, 'Title cannot be empty.'); return false; }
if (val.length < 5) { showFieldError(inputEl, 'Title must be at least 5 characters long.'); return false; }
clearFieldError(inputEl);
return true;
}
function validateContentField(inputEl, minLen = 10) {
if (!inputEl) return true;
const val = inputEl.value.trim();
if (!val) { showFieldError(inputEl, 'Content cannot be empty.'); return false; }
if (val.length < minLen) { showFieldError(inputEl, `Content must be at least ${minLen} characters long.`); return false; }
clearFieldError(inputEl);
return true;
}
function validateRequiredField(inputEl, label) {
if (!inputEl) return true;
if (!inputEl.value || !inputEl.value.trim()) {
showFieldError(inputEl, `${label} is required.`);
return false;
}
clearFieldError(inputEl);
return true;
}
function showFormError(message) {
const el = document.getElementById('form-error');
if (el) {
el.textContent = message;
el.style.display = message ? 'block' : 'none';
} else if (message) {
alert(message);
}
}
// ==========================================
// WEB STORAGE DRAFT HELPERS
// Generic save/restore/clear so every form in this module (create-thread,
// edit-thread, edit-reply, post-reply) can keep in-progress input across
// a page refresh, not just the create-thread form.
// `fields` is an object like { title: titleInput, content: contentInput }.
// ==========================================
function saveDraftToStorage(key, fields) {
const payload = {};
Object.keys(fields).forEach((fieldName) => {
const el = fields[fieldName];
if (el) payload[fieldName] = el.value;
});
localStorage.setItem(key, JSON.stringify(payload));
}
function restoreDraftFromStorage(key, fields) {
const saved = localStorage.getItem(key);
if (!saved) return false;
try {
const draft = JSON.parse(saved);
Object.keys(fields).forEach((fieldName) => {
const el = fields[fieldName];
if (el && draft[fieldName]) el.value = draft[fieldName];
});
return true;
} catch (e) {
console.error('Failed to parse saved draft:', e);
return false;
}
}
function clearDraftFromStorage(key) {
localStorage.removeItem(key);
}
function bindDraftAutoSave(key, fields) {
Object.values(fields).forEach((el) => {
if (!el) return;
el.addEventListener('input', () => saveDraftToStorage(key, fields));
});
}
// ==========================================
// BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
renderCurrentUser();
initCreateThreadForm();
initEditThreadForm();
initEditReplyForm();
initPostReplyForm();
initDeleteThreadForm();
initDeleteReplyForms();
initForumBoard();
initThreadDetailPage();
});
function renderCurrentUser() {
const userDisplay = document.getElementById('currentUserDisplay');
if (!userDisplay) return;
const currentUser = getCurrentUser();
if (currentUser) {
userDisplay.textContent = currentUser.username;
} else {
userDisplay.textContent = 'Guest (Please login first)';
userDisplay.style.color = 'red';
}
}
// ==========================================
// 1. CREATE THREAD (create-thread.html) -> POST /api/threads
// ==========================================
function initCreateThreadForm() {
const form = document.getElementById('create-thread-form');
if (!form) return;
// Guests can't create a thread - the server would reject it anyway (401),
// so block it up front with a clear message instead of a confusing error
// after they've already typed everything out.
if (!getCurrentUser()) {
showFormError('You must be logged in to create a post. Please log in first.');
form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = true; });
return;
}
form.setAttribute('novalidate', 'true');
const titleInput = document.getElementById('edit-title');
const contentInput = document.getElementById('edit-content');
const submitBtn = form.querySelector('button[type="submit"]');
const DRAFT_KEY = 'forum_new_thread_draft';
// --- Restore draft from Web Storage ---
const saved = localStorage.getItem(DRAFT_KEY);
if (saved) {
try {
const draft = JSON.parse(saved);
if (titleInput && draft.title) titleInput.value = draft.title;
if (contentInput && draft.content) contentInput.value = draft.content;
} catch (e) {
console.error('Failed to parse saved draft:', e);
}
}
function saveDraft() {
localStorage.setItem(DRAFT_KEY, JSON.stringify({
title: titleInput.value,
content: contentInput.value
}));
}
[titleInput, contentInput].forEach((el) => {
el.addEventListener('input', () => {
saveDraft();
if (el === titleInput) validateTitleField(titleInput);
if (el === contentInput) validateContentField(contentInput);
});
el.addEventListener('blur', () => {
if (el === titleInput) validateTitleField(titleInput);
if (el === contentInput) validateContentField(contentInput);
});
});
form.addEventListener('submit', async (e) => {
e.preventDefault();
showFormError('');
const isTitleValid = validateTitleField(titleInput);
const isContentValid = validateContentField(contentInput);
if (!isTitleValid || !isContentValid) return;
if (submitBtn) submitBtn.disabled = true;
try {
const data = await apiRequest('/api/threads', {
method: 'POST',
body: JSON.stringify({
// No "author" field here - the server sets it from the authenticated
// session (req.user.username), so a client can never claim to be someone else.
title: titleInput.value.trim(),
content: contentInput.value.trim()
})
});
localStorage.removeItem(DRAFT_KEY);
alert('Thread published successfully!');
window.location.href = `thread-detail.html?threadId=${data.thread.id}`;
} catch (err) {
console.error('Create thread error:', err);
showFormError('Error: ' + err.message);
} finally {
if (submitBtn) submitBtn.disabled = false;
}
});
}
// ==========================================
// 2. EDIT THREAD (edit-post.html) -> GET + PUT /api/threads/:id
// ==========================================
function initEditThreadForm() {
const form = document.getElementById('edit-thread-form');
if (!form) return;
form.setAttribute('novalidate', 'true');
const titleInput = document.getElementById('edit-title');
const contentInput = document.getElementById('edit-content');
const submitBtn = form.querySelector('button[type="submit"]');
const threadId = getQueryParam('threadId') || 'desk-001';
// Web Storage draft key is scoped to this specific thread, so editing
// two different threads never mixes up their unsaved drafts.
const DRAFT_KEY = `forum_edit_thread_draft_${threadId}`;
const draftFields = { title: titleInput, content: contentInput };
// --- Load current thread data from the server ---
(async () => {
try {
const data = await apiRequest(`/api/threads/${threadId}`);
if (titleInput) titleInput.value = data.thread.title;
if (contentInput) contentInput.value = data.thread.content;
// If the user had unsaved edits in progress (e.g. the page was
// refreshed by accident), restore those over the server values.
restoreDraftFromStorage(DRAFT_KEY, draftFields);
// Ownership check: only the original author may edit this thread.
// (The server enforces this too on submit - this just gives the user
// immediate feedback instead of letting them fill out the whole form first.)
const currentUser = getCurrentUser();
const isOwnerOfThread = currentUser &&
String(data.thread.author || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase();
if (!isOwnerOfThread) {
showFormError('You can only edit your own posts.');
if (titleInput) titleInput.disabled = true;
if (contentInput) contentInput.disabled = true;
if (submitBtn) submitBtn.disabled = true;
}
} catch (err) {
console.error('Could not load thread for editing:', err);
showFormError('Could not load this request from the server.');
}
})();
bindDraftAutoSave(DRAFT_KEY, draftFields);
[titleInput, contentInput].forEach((el) => {
el.addEventListener('input', () => {
if (el === titleInput) validateTitleField(titleInput);
if (el === contentInput) validateContentField(contentInput);
});
el.addEventListener('blur', () => {
if (el === titleInput) validateTitleField(titleInput);
if (el === contentInput) validateContentField(contentInput);
});
});
form.addEventListener('submit', async (e) => {
e.preventDefault();
showFormError('');
const isTitleValid = validateTitleField(titleInput);
const isContentValid = validateContentField(contentInput);
if (!isTitleValid || !isContentValid) return;
if (submitBtn) submitBtn.disabled = true;
try {
await apiRequest(`/api/threads/${threadId}`, {
method: 'PUT',
body: JSON.stringify({
title: titleInput.value.trim(),
content: contentInput.value.trim()
})
});
clearDraftFromStorage(DRAFT_KEY);
alert('Changes saved successfully!');
window.location.href = `thread-detail.html?threadId=${threadId}`;
} catch (err) {
console.error('Update thread error:', err);
showFormError('Error: ' + err.message);
} finally {
if (submitBtn) submitBtn.disabled = false;
}
});
}
// ==========================================
// 3. EDIT REPLY (edit-reply.html) -> GET thread (to find reply) + PUT /api/replies/:id
// ==========================================
function initEditReplyForm() {
const form = document.getElementById('edit-reply-form');
if (!form) return;
form.setAttribute('novalidate', 'true');
const titleInput = document.getElementById('edit-reply-title');
const contentInput = document.getElementById('edit-reply-content');
const submitBtn = form.querySelector('button[type="submit"]');
const replyId = getQueryParam('replyId') || 'reply-001';
const threadId = getQueryParam('threadId') || 'desk-001';
// Web Storage draft key is scoped to this specific reply.
const DRAFT_KEY = `forum_edit_reply_draft_${replyId}`;
const draftFields = { title: titleInput, content: contentInput };
// --- Load current reply data from the server ---
(async () => {
try {
const data = await apiRequest(`/api/threads/${threadId}`);
const reply = (data.thread.replies || []).find((r) => r.id === replyId);
if (reply) {
if (titleInput) titleInput.value = reply.title;
if (contentInput) contentInput.value = reply.content;
// If the user had unsaved edits in progress (e.g. the page was
// refreshed by accident), restore those over the server values.
restoreDraftFromStorage(DRAFT_KEY, draftFields);
// Ownership check: only the original author may edit this reply.
// (The server enforces this too on submit - this just gives the user
// immediate feedback instead of letting them fill out the whole form first.)
const currentUser = getCurrentUser();
const isOwnerOfReply = currentUser &&
String(reply.author || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase();
if (!isOwnerOfReply) {
showFormError('You can only edit your own replies.');
if (titleInput) titleInput.disabled = true;
if (contentInput) contentInput.disabled = true;
if (submitBtn) submitBtn.disabled = true;
}
} else {
showFormError('Could not find this reply on the server.');
}
} catch (err) {
console.error('Could not load reply for editing:', err);
showFormError('Could not load this reply from the server.');
}
})();
bindDraftAutoSave(DRAFT_KEY, draftFields);
[titleInput, contentInput].forEach((el) => {
el.addEventListener('input', () => {
if (el === titleInput) validateRequiredField(titleInput, 'Reply title');
if (el === contentInput) validateRequiredField(contentInput, 'Reply content');
});
el.addEventListener('blur', () => {
if (el === titleInput) validateRequiredField(titleInput, 'Reply title');
if (el === contentInput) validateRequiredField(contentInput, 'Reply content');
});
});
form.addEventListener('submit', async (e) => {
e.preventDefault();
showFormError('');
const isTitleValid = validateRequiredField(titleInput, 'Reply title');
const isContentValid = validateRequiredField(contentInput, 'Reply content');
if (!isTitleValid || !isContentValid) return;
if (submitBtn) submitBtn.disabled = true;
try {
await apiRequest(`/api/replies/${replyId}`, {
method: 'PUT',
body: JSON.stringify({
title: titleInput.value.trim(),
content: contentInput.value.trim()
})
});
clearDraftFromStorage(DRAFT_KEY);
alert('Reply updated successfully!');
window.location.href = `thread-detail.html?threadId=${threadId}`;
} catch (err) {
console.error('Update reply error:', err);
showFormError('Error: ' + err.message);
} finally {
if (submitBtn) submitBtn.disabled = false;
}
});
}
// ==========================================
// 4. POST REPLY (thread-detail.html) -> POST /api/threads/:id/replies
// ==========================================
function initPostReplyForm() {
const form = document.getElementById('post-reply-form');
if (!form) return;
// Guests can't post a reply - the server would reject it anyway (401).
if (!getCurrentUser()) {
showFormError('You must be logged in to reply. Please log in first.');
form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = true; });
return;
}
const titleInput = document.getElementById('reply-title');
const contentInput = document.getElementById('reply-content');
const submitBtn = form.querySelector('button[type="submit"]');
const threadId = getQueryParam('threadId') || 'desk-001';
// Web Storage draft key is scoped to this specific thread, so a
// half-written reply survives an accidental page refresh.
const DRAFT_KEY = `forum_new_reply_draft_${threadId}`;
const draftFields = { title: titleInput, content: contentInput };
restoreDraftFromStorage(DRAFT_KEY, draftFields);
bindDraftAutoSave(DRAFT_KEY, draftFields);
[titleInput, contentInput].forEach((el) => {
el.addEventListener('input', () => {
if (el === titleInput) validateRequiredField(titleInput, 'Reply title');
if (el === contentInput) validateRequiredField(contentInput, 'Reply content');
});
el.addEventListener('blur', () => {
if (el === titleInput) validateRequiredField(titleInput, 'Reply title');
if (el === contentInput) validateRequiredField(contentInput, 'Reply content');
});
});
form.addEventListener('submit', async (e) => {
e.preventDefault();
showFormError('');
const isTitleValid = validateRequiredField(titleInput, 'Reply title');
const isContentValid = validateRequiredField(contentInput, 'Reply content');
if (!isTitleValid || !isContentValid) return;
if (submitBtn) submitBtn.disabled = true;
try {
await apiRequest(`/api/threads/${threadId}/replies`, {
method: 'POST',
body: JSON.stringify({
// No "author" field here - the server sets it from the authenticated
// session (req.user.username), so a client can never claim to be someone else.
title: titleInput.value.trim(),
content: contentInput.value.trim()
})
});
clearDraftFromStorage(DRAFT_KEY);
alert('Reply posted successfully!');
form.reset();
window.location.href = `thread-detail.html?threadId=${threadId}`;
} catch (err) {
console.error('Post reply error:', err);
showFormError('Error: ' + err.message);
} finally {
if (submitBtn) submitBtn.disabled = false;
}
});
}
// ==========================================
// 5. DELETE THREAD (thread-detail.html) -> DELETE /api/threads/:id
// ==========================================
function initDeleteThreadForm() {
const form = document.getElementById('delete-thread-form');
if (!form) return;
form.addEventListener('submit', async (e) => {
e.preventDefault();
if (!confirm('Are you sure you want to delete this post?')) return;
const threadId = form.dataset.threadId || getQueryParam('threadId') || 'desk-001';
try {
await apiRequest(`/api/threads/${threadId}`, { method: 'DELETE' });
alert('Post deleted.');
window.location.href = 'forum.html';
} catch (err) {
console.error('Delete thread error:', err);
alert('Error: ' + err.message);
}
});
}
// ==========================================
// 6. DELETE REPLY (thread-detail.html, supports multiple reply cards)
// -> DELETE /api/replies/:replyId
// ==========================================
function initDeleteReplyForms() {
const forms = document.querySelectorAll('.delete-reply-form');
forms.forEach((form) => {
form.addEventListener('submit', async (e) => {
e.preventDefault();
if (!confirm('Are you sure you want to delete this reply?')) return;
const replyId = form.dataset.replyId;
const threadId = form.dataset.threadId || getQueryParam('threadId') || 'desk-001';
if (!replyId) {
alert('Missing reply reference — cannot delete.');
return;
}
try {
await apiRequest(`/api/replies/${replyId}`, { method: 'DELETE' });
alert('Reply deleted.');
window.location.href = `thread-detail.html?threadId=${threadId}`;
} catch (err) {
console.error('Delete reply error:', err);
alert('Error: ' + err.message);
}
});
});
}
// ==========================================
// 7. FORUM BOARD (forum.html)
// - Dynamically fetches real threads from GET /api/threads and renders cards
// - Live typing filters/sorts the already-loaded data in pure JS (no backend call)
// - "Apply Filters" submits a real query to the NodeJS search/sort/filter route
// ==========================================
// Holds whatever thread data is currently loaded in memory, used by the
// pure client-side (no backend round-trip) live filter/sort below.
let allThreadsCache = [];
async function fetchThreadsFromServer(params = {}) {
const query = new URLSearchParams();
if (params.title) query.set('title', params.title);
if (params.content) query.set('content', params.content);
if (params.sort) query.set('sort', params.sort);
const queryString = query.toString();
const path = `/api/threads${queryString ? `?${queryString}` : ''}`;
const data = await apiRequest(path);
return data.threads || [];
}
function buildThreadCardHTML(thread) {
const imageBlock = thread.image
? `<img class="thread-thumb" src="${escapeHtml(thread.image)}" alt="Reference image for ${escapeHtml(thread.title)}">`
: `<div class="thread-thumb" aria-hidden="true" style="width:110px;height:80px;display:flex;align-items:center;justify-content:center;background:#e9ecef;color:#888;font-size:0.8em;border-radius:4px;">No image</div>`;
const replyLabel = (thread.replyCount === 1) ? 'Reply' : 'Replies';
return `
<div class="card-header thread-card-header">
${imageBlock}
<div>
<a href="thread-detail.html?threadId=${encodeURIComponent(thread.id)}" class="card-title">${escapeHtml(thread.title)}</a>
<div class="meta-info mt-1">Posted by: <strong>${escapeHtml(thread.author)}</strong> | ${formatPostedDate(thread.posted_at)}</div>
</div>
</div>
<p>${escapeHtml(truncateText(thread.content))}</p>
<div class="mt-1" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
<span class="meta-info">${thread.replyCount || 0} ${replyLabel} | Status: ${escapeHtml(thread.status || 'Open')}</span>
<button class="btn btn-secondary btn-sm" onclick="saveThreadToWishlist('${thread.id}', '${escapeHtml(thread.title).replace(/'/g, "\\'")}', '${escapeHtml(thread.image || '')}', '${escapeHtml(thread.status || 'Open')}')">Save to Wishlist</button>
</div>
`;
}
function renderThreadList(threads) {
const threadList = document.querySelector('.thread-list');
if (!threadList) return;
threadList.innerHTML = '';
if (!threads || !threads.length) {
threadList.innerHTML = '<p class="empty-state" style="text-align:center; color:#666; padding: 20px 0;">No requests match your filters right now. Try clearing the search fields.</p>';
return;
}
threads.forEach((thread) => {
const article = document.createElement('article');
article.className = 'card thread-card';
article.dataset.threadId = thread.id;
article.innerHTML = buildThreadCardHTML(thread);
threadList.appendChild(article);
});
}
async function initForumBoard() {
const threadList = document.querySelector('.thread-list');
const filterForm = document.querySelector('#forum-filters form');
if (!threadList || !filterForm) return; // only run on forum.html
const searchTitleInput = document.getElementById('search-title');
const searchContentInput = document.getElementById('search-content');
const sortBySelect = document.getElementById('sort-by');
// --- Initial load: fetch real data from the NodeJS API and render it ---
try {
allThreadsCache = await fetchThreadsFromServer();
renderThreadList(allThreadsCache);
} catch (err) {
console.error('Failed to load threads:', err);
threadList.innerHTML = '<p class="empty-state" style="text-align:center; color:#666; padding: 20px 0;">Could not load requests from the server. Please refresh the page.</p>';
return;
}
// --- Live client-side filter/sort: pure JS on already-loaded data, no backend call ---
function applyClientFilterAndSort() {
const searchTitle = searchTitleInput.value.trim().toLowerCase();
const searchContent = searchContentInput.value.trim().toLowerCase();
const sortBy = sortBySelect.value;
let filtered = allThreadsCache.filter((thread) => {
const matchesTitle = !searchTitle || (thread.title || '').toLowerCase().includes(searchTitle);
const matchesContent = !searchContent || (thread.content || '').toLowerCase().includes(searchContent);
return matchesTitle && matchesContent;
});
filtered = filtered.slice().sort((a, b) => {
if (sortBy === 'oldest') return new Date(a.posted_at) - new Date(b.posted_at);
if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
if (sortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '');
return new Date(b.posted_at) - new Date(a.posted_at); // newest first (default)
});
renderThreadList(filtered);
}
[searchTitleInput, searchContentInput].forEach((input) => {
input.addEventListener('input', applyClientFilterAndSort);
});
sortBySelect.addEventListener('change', applyClientFilterAndSort);
// --- "Apply Filters" button: re-queries the backend search/sort/filter route ---
// This exercises the NodeJS GET /api/threads?title=&content=&sort= endpoint,
// so a fresh, canonical result set (including threads added by other users) is fetched.
filterForm.addEventListener('submit', async (e) => {
e.preventDefault();
threadList.innerHTML = '<p class="loading-state" style="text-align:center; color:#666; padding: 20px 0;">Searching…</p>';
try {
allThreadsCache = await fetchThreadsFromServer({
title: searchTitleInput.value.trim(),
content: searchContentInput.value.trim(),
sort: sortBySelect.value
});
renderThreadList(allThreadsCache);
} catch (err) {
console.error('Failed to search threads:', err);
threadList.innerHTML = '<p class="empty-state" style="text-align:center; color:#666; padding: 20px 0;">Search failed. Please try again.</p>';
}
});
}

// ==========================================
// 8. THREAD DETAIL PAGE (thread-detail.html)
// Reads threadId from the URL, fetches the real thread from the server,
// and dynamically re-renders title/content/author/edit-link/delete-form/replies
// (previously this page only ever showed the hardcoded "desk-001" demo data).
// ==========================================
async function initThreadDetailPage() {
  const titleEl = document.querySelector('article.card h1');
  if (!titleEl) return; // only run on thread-detail.html

  const threadId = getQueryParam('threadId');
  if (!threadId) return;

  try {
    const data = await apiRequest(`/api/threads/${threadId}`);
    const thread = data.thread;
    const currentUser = getCurrentUser();
    const isOwnerOfThread = currentUser &&
      String(thread.author || '').trim().toLowerCase() ===
      String(currentUser.username || '').trim().toLowerCase();

    // Title + content
    titleEl.textContent = thread.title;
    const contentP = document.querySelector('.post-content p');
    if (contentP) contentP.textContent = thread.content;

    // Meta info (author + date)
    const metaEl = document.querySelector('.meta-info.mb-1');
    if (metaEl) {
      metaEl.innerHTML = `Posted by: <strong>${escapeHtml(thread.author)}</strong> | ${formatPostedDate(thread.posted_at)}`;
    }

    // Image (hide if none)
    const imgEl = document.querySelector('.post-image');
    if (imgEl) {
      imgEl.style.display = thread.image ? '' : 'none';
      if (thread.image) imgEl.src = thread.image;
    }

    // "Edit Request" link -> point to the REAL thread being viewed
    const editLink = document.querySelector('a[href^="edit-post.html"]');
    if (editLink) {
      editLink.href = `edit-post.html?threadId=${encodeURIComponent(threadId)}`;
      // Only the owner should see the Edit/Delete controls
      if (editLink.parentElement) {
        editLink.parentElement.style.display = isOwnerOfThread ? '' : 'none';
      }
    }

    // Delete-thread form -> use the REAL thread id
    const deleteForm = document.getElementById('delete-thread-form');
    if (deleteForm) deleteForm.dataset.threadId = threadId;

    // Replies count heading
    const headingEl = document.querySelector('.reply-section h2');
    if (headingEl) headingEl.textContent = `Offers & Replies (${thread.replies.length})`;

    // Render the real replies (removes the old hardcoded demo reply)
    renderThreadReplies(thread.replies, threadId, currentUser);

  } catch (err) {
    console.error('Failed to load thread:', err);
    showFormError('Could not load this thread from the server.');
  }
}

function renderThreadReplies(replies, threadId, currentUser) {
  const section = document.querySelector('.reply-section');
  const replyFormCard = document.getElementById('reply-form');
  if (!section || !replyFormCard) return;

  // Remove any existing reply cards (including the old hardcoded demo one)
  section.querySelectorAll('.reply-card').forEach((el) => el.remove());

  replies.forEach((reply) => {
    const isOwner = currentUser &&
      String(reply.author || '').trim().toLowerCase() ===
      String(currentUser.username || '').trim().toLowerCase();

    const article = document.createElement('article');
    article.className = 'card reply-card';
    article.innerHTML = `
      <div class="flex-between mb-1">
        <h3 class="reply-title">${escapeHtml(reply.title)}</h3>
        ${isOwner ? `
        <div>
          <a href="edit-reply.html?replyId=${encodeURIComponent(reply.id)}&threadId=${encodeURIComponent(threadId)}" class="btn btn-secondary btn-sm">Edit Reply</a>
          <form class="delete-reply-form inline-form" data-reply-id="${reply.id}" data-thread-id="${threadId}">
            <button type="submit" class="btn btn-danger btn-sm">Delete</button>
          </form>
        </div>` : ''}
      </div>
      <div class="meta-info mb-1">Reply from: <strong>${escapeHtml(reply.author)}</strong> | ${formatPostedDate(reply.posted_at)}</div>
      <div class="post-content"><p>${escapeHtml(reply.content)}</p></div>
    `;
    section.insertBefore(article, replyFormCard);
  });

  // Re-bind delete listeners since these reply forms are newly created
  initDeleteReplyForms();
}