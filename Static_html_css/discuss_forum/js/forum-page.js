(function () {
    'use strict';

    const API_URL = 'http://localhost:5000/api/threads';
    const list = document.querySelector('.thread-list');
    const form = document.querySelector('#forum-filters form');
    if (!list || !form) return;

    const fields = {
        title: document.getElementById('search-title'),
        content: document.getElementById('search-content'),
        sort: document.getElementById('sort-by')
    };

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[character]));
    }

    function renderThreads(threads) {
        if (!threads.length) {
            list.innerHTML = '<p class="no-results" role="status">No requests match your filters.</p>';
            return;
        }

        list.innerHTML = threads.map((thread) => `
            <article class="card thread-card">
                <div class="card-header thread-card-header">
                    ${thread.image ? `<img class="thread-thumb" src="${escapeHtml(thread.image)}" alt="">` : ''}
                    <div>
                        <a href="thread-detail.html?threadId=${encodeURIComponent(thread.id)}" class="card-title">${escapeHtml(thread.title)}</a>
                        <div class="meta-info mt-1">Posted by: <strong>${escapeHtml(thread.author)}</strong> | ${new Date(thread.posted_at).toLocaleString()}</div>
                    </div>
                </div>
                <p>${escapeHtml(thread.content)}</p>
                <div class="mt-1"><span class="meta-info">${thread.replyCount || 0} Replies | Status: ${escapeHtml(thread.status)}</span></div>
            </article>
        `).join('');
    }

    async function loadThreads(event) {
        if (event) event.preventDefault();
        const params = new URLSearchParams();
        if (fields.title.value.trim()) params.set('title', fields.title.value.trim());
        if (fields.content.value.trim()) params.set('content', fields.content.value.trim());
        if (fields.sort.value) params.set('sort', fields.sort.value);

        try {
            const response = await fetch(`${API_URL}?${params.toString()}`);
            if (!response.ok) throw new Error('Unable to load forum requests');
            const payload = await response.json();
            renderThreads(payload.threads || []);
        } catch (error) {
            const status = document.createElement('p');
            status.className = 'no-results';
            status.textContent = 'Forum service is unavailable. Please try again.';
            list.replaceChildren(status);
            console.error(error);
        }
    }

    form.addEventListener('submit', loadThreads);
    [fields.title, fields.content].forEach((field) => field.addEventListener('input', () => loadThreads()));
    fields.sort.addEventListener('change', () => loadThreads());
    loadThreads();
})();
