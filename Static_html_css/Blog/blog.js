(function () {
    'use strict';

    const API = 'http://localhost:5000/api/blogs';
    const userId = () => localStorage.getItem('userId') || '';
    const headers = () => ({ 'Content-Type': 'application/json', ...(userId() ? { 'x-user-id': userId() } : {}) });

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[character]));
    }

    function showMessage(message, type = 'info') {
        let target = document.getElementById('blogMessage');
        if (!target) {
            target = document.createElement('p');
            target.id = 'blogMessage';
            target.setAttribute('role', 'status');
            const main = document.querySelector('main');
            if (main) main.prepend(target);
        }
        target.textContent = message;
        target.dataset.type = type;
    }

    async function request(url, options = {}) {
        const response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
        return payload;
    }

    function renderList(posts) {
        const container = document.querySelector('.blog-list');
        if (!container) return;
        container.innerHTML = `<h2 id="list-heading">Post previews</h2><p class="muted">${posts.length} post${posts.length === 1 ? '' : 's'} found.</p>${posts.map((post) => `
            <article class="card blog-post-card">
                ${post.image ? `<img class="post-thumbnail" src="${escapeHtml(post.image)}" alt="">` : ''}
                <div class="post-body">
                    <div class="post-badges"><span class="category-badge">${escapeHtml(post.category)}</span>${(post.tags || []).map((tag) => `<span class="tag-static">${escapeHtml(tag)}</span>`).join('')}</div>
                    <h3 class="post-title"><a href="blog-detail.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3>
                    <p class="post-summary">${escapeHtml(post.summary || post.content)}</p>
                    <p class="post-meta">By <strong>${escapeHtml(post.author)}</strong> · ${escapeHtml(post.date)}</p>
                    <div class="post-actions"><a href="blog-detail.html?id=${encodeURIComponent(post.id)}" class="btn btn-primary btn-sm">Read full post</a><a href="blog-edit.html?id=${encodeURIComponent(post.id)}" class="btn btn-secondary btn-sm">Edit</a></div>
                </div>
            </article>
        `).join('')}`;
    }

    async function loadList() {
        const form = document.querySelector('.filters');
        if (!form) return;
        const params = new URLSearchParams(new FormData(form));
        try {
            const payload = await request(`${API}?${params.toString()}`);
            renderList(payload.blogs || []);
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    function formPayload(form) {
        const data = Object.fromEntries(new FormData(form).entries());
        data.tags = String(data.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
        return data;
    }

    async function handleForm(form) {
        const editId = new URLSearchParams(location.search).get('id');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!userId()) return showMessage('Please sign in before saving a blog post.', 'error');
            const payload = formPayload(form);
            if (!payload.title || payload.title.trim().length < 5 || !payload.content || payload.content.trim().length < 20 || !payload.category) return showMessage('Please provide a title, category, and at least 20 characters of content.', 'error');
            try {
                const result = await request(editId ? `${API}/${encodeURIComponent(editId)}` : API, { method: editId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
                window.location.href = `blog-detail.html?id=${encodeURIComponent(result.blog.id)}`;
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    async function loadEditForm(form) {
        const id = new URLSearchParams(location.search).get('id');
        if (!id) return handleForm(form);
        try {
            const { blog } = await request(`${API}/${encodeURIComponent(id)}`);
            const values = { title: blog.title, author: blog.author, date: blog.date, category: blog.category, tags: (blog.tags || []).join(', '), image: blog.image, summary: blog.summary, content: blog.content };
            Object.entries(values).forEach(([key, value]) => { const field = form.elements[key]; if (field) field.value = value; });
            handleForm(form);
        } catch (error) { showMessage(error.message, 'error'); }
    }

    async function loadDetail() {
        const id = new URLSearchParams(location.search).get('id');
        if (!id) return;
        try {
            const { blog } = await request(`${API}/${encodeURIComponent(id)}`);
            const title = document.querySelector('.blog-detail h1');
            const meta = document.querySelector('.blog-detail .post-meta');
            const content = document.querySelector('.blog-detail .post-content');
            const image = document.querySelector('.blog-detail .detail-image');
            if (title) title.textContent = blog.title;
            if (meta) meta.textContent = `By ${blog.author} · Published ${blog.date}`;
            if (content) content.innerHTML = `<p>${escapeHtml(blog.content)}</p>`;
            if (image && blog.image) image.src = blog.image;
            document.querySelectorAll('a[href="blog-edit.html"]').forEach((link) => { link.href = `blog-edit.html?id=${encodeURIComponent(blog.id)}`; });
            const deleteButton = document.querySelector('.detail-actions .btn-danger');
            if (deleteButton) deleteButton.addEventListener('click', async () => {
                if (!confirm('Delete this post?')) return;
                try { await request(`${API}/${encodeURIComponent(blog.id)}`, { method: 'DELETE' }); window.location.href = 'blog-list.html'; } catch (error) { showMessage(error.message, 'error'); }
            });
        } catch (error) { showMessage(error.message, 'error'); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('.blog-list')) {
            const form = document.querySelector('.filters');
            form.addEventListener('submit', (event) => { event.preventDefault(); loadList(); });
            form.querySelectorAll('input, select').forEach((field) => field.addEventListener('input', loadList));
            loadList();
        }
        const blogForm = document.querySelector('.blog-form');
        if (blogForm) {
            if (location.pathname.endsWith('blog-edit.html')) loadEditForm(blogForm);
            else handleForm(blogForm);
        }
        if (document.querySelector('.blog-detail')) loadDetail();
    });
})();
