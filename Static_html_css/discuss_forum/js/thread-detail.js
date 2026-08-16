(function () {
  "use strict";

  const threadId = new URLSearchParams(window.location.search).get("threadId");
  if (!threadId) return;

  const API = "http://localhost:5000/api";

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character]));
  }

  async function loadThread() {
    const response = await fetch(`${API}/threads/${encodeURIComponent(threadId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Thread not found");

    const thread = payload.thread;
    const article = document.querySelector("main > article");
    const title = article?.querySelector("h1");
    const meta = article?.querySelector(".meta-info");
    const content = article?.querySelector(".post-content");
    const editLink = article?.querySelector('a[href^="edit-post.html"]');

    if (title) title.textContent = thread.title;
    if (meta) meta.innerHTML = `Posted by: <strong>${escapeHtml(thread.author)}</strong> | ${new Date(thread.posted_at).toLocaleString()}`;
    if (content) content.innerHTML = `<p>${escapeHtml(thread.content)}</p>${thread.image ? `<img class="post-image" src="${escapeHtml(thread.image)}" alt="Reference image for ${escapeHtml(thread.title)}">` : ""}`;
    if (editLink) editLink.href = `edit-post.html?threadId=${encodeURIComponent(thread.id)}`;
    document.title = `${thread.title} - Request Details`;

    const replySection = document.querySelector(".reply-section");
    const replyHeading = replySection?.querySelector("h2");
    const replyForm = document.getElementById("reply-form");
    if (replyHeading) replyHeading.textContent = `Offers & Replies (${thread.replies.length})`;
    replySection?.querySelectorAll(".reply-card").forEach((card) => card.remove());

    if (replyForm && replySection) {
      thread.replies.forEach((reply) => {
        const card = document.createElement("article");
        card.className = "card reply-card";
        card.innerHTML = `
          <div class="flex-between mb-1"><h3 class="reply-title">${escapeHtml(reply.title)}</h3></div>
          <div class="meta-info mb-1">Reply from: <strong>${escapeHtml(reply.author)}</strong> | ${new Date(reply.posted_at).toLocaleString()}</div>
          <div class="post-content"><p>${escapeHtml(reply.content)}</p></div>
          ${Number(reply.price) > 0 ? `<div class="offer-section"><div><span class="meta-info">Proposed Price:</span><div class="offer-price">$${Number(reply.price).toFixed(2)}</div></div></div>` : ""}
        `;
        replySection.insertBefore(card, replyForm);
      });
    }
  }

  loadThread().catch((error) => {
    const main = document.querySelector("main");
    if (main) {
      const message = document.createElement("p");
      message.className = "meta-info";
      message.setAttribute("role", "alert");
      message.textContent = error.message;
      main.prepend(message);
    }
  });
})();
