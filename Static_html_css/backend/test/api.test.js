const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { db, saveDb } = require('../src/data/db');

let server;
let baseUrl;
const created = { userId: null, blogId: null, reviewId: null, threadId: null, replyId: null, wishlistItemId: null };
const userId = 'user_001';
const adminId = 'admin_001';

function jsonHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', ...extra };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (created.replyId) db.replies = db.replies.filter((reply) => reply.id !== created.replyId);
  if (created.threadId) db.threads = db.threads.filter((thread) => thread.id !== created.threadId);
  if (created.blogId) db.blogs = db.blogs.filter((blog) => blog.id !== created.blogId);
  if (created.reviewId) db.reviews = db.reviews.filter((review) => review.id !== created.reviewId);
  if (created.wishlistItemId) db.wishlists[userId] = (db.wishlists[userId] || []).filter((item) => item.id !== created.wishlistItemId);
  saveDb(db);
  await new Promise((resolve) => server.close(resolve));
});

test('health endpoint responds', async () => {
  const { response, body } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
});

test('blog CRUD validates and persists ownership', async () => {
  const invalid = await request('/blogs', { method: 'POST', headers: jsonHeaders({ 'x-user-id': userId }), body: JSON.stringify({ title: 'bad' }) });
  assert.equal(invalid.response.status, 400);

  const createdBlog = await request('/blogs', {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ title: 'A Valid Blog Post', category: 'design', tags: ['UX'], summary: 'A useful summary', content: 'This blog post contains enough content for validation.' })
  });
  assert.equal(createdBlog.response.status, 201);
  created.blogId = createdBlog.body.blog.id;

  const list = await request('/blogs?q=valid');
  assert.equal(list.response.status, 200);
  assert.ok(list.body.blogs.some((blog) => blog.id === created.blogId));

  const updated = await request(`/blogs/${created.blogId}`, {
    method: 'PUT',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ title: 'Updated Valid Blog Post' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.blog.title, 'Updated Valid Blog Post');
});

test('review CRUD validates ownership', async () => {
  const createdReview = await request('/reviews', {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ title: 'Useful product review', product: 'Desk', category: 'Home', rating: 5, summary: 'Good value', description: 'This is a sufficiently detailed product review.' })
  });
  assert.equal(createdReview.response.status, 201);
  created.reviewId = createdReview.body.review.id;

  const forbidden = await request(`/reviews/${created.reviewId}`, {
    method: 'DELETE',
    headers: jsonHeaders()
  });
  assert.equal(forbidden.response.status, 403);

  const deleted = await request(`/reviews/${created.reviewId}`, {
    method: 'DELETE',
    headers: jsonHeaders({ 'x-user-id': userId })
  });
  assert.equal(deleted.response.status, 200);
  created.reviewId = null;
});

test('wishlist and admin routes enforce access and validation', async () => {
  const invalid = await request(`/wishlist/${userId}/items`, {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ productId: 'desk' })
  });
  assert.equal(invalid.response.status, 400);

  const added = await request(`/wishlist/${userId}/items`, {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ productId: 'desk', title: 'Desk', price: 420 })
  });
  assert.equal(added.response.status, 201);
  created.wishlistItemId = added.body.item.id;

  const forbidden = await request('/admin/users', { headers: jsonHeaders({ 'x-user-id': userId }) });
  assert.equal(forbidden.response.status, 403);

  const adminUsers = await request('/admin/users?q=demo', { headers: jsonHeaders({ 'x-user-id': adminId }) });
  assert.equal(adminUsers.response.status, 200);
  assert.ok(adminUsers.body.users.some((user) => user.username === 'demouser'));
});

test('forum CRUD validates and persists replies', async () => {
  const createdThread = await request('/threads', {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ userId, title: 'A Forum Thread', content: 'This forum request has enough detail for validation.' })
  });
  assert.equal(createdThread.response.status, 201);
  created.threadId = createdThread.body.thread.id;

  const createdReply = await request(`/threads/${created.threadId}/replies`, {
    method: 'POST',
    headers: jsonHeaders({ 'x-user-id': userId }),
    body: JSON.stringify({ author: 'Demo User', title: 'A Reply', content: 'This reply contains useful information.', price: 20 })
  });
  assert.equal(createdReply.response.status, 201);
  created.replyId = createdReply.body.reply.id;

  const detail = await request(`/threads/${created.threadId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.thread.replies.length, 1);
});
