(function () {
    'use strict';

    const userId = localStorage.getItem('userId');
    const list = document.querySelector('.wishlist-list');
    if (!list) return;
    if (!userId) {
        list.innerHTML = '<p class="meta-info" role="status">Please sign in to view your wishlist.</p>';
        return;
    }

    const api = `http://localhost:5000/api/wishlist/${encodeURIComponent(userId)}`;
    const headers = { 'Content-Type': 'application/json', 'x-user-id': userId };

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    }

    async function load() {
        try {
            const response = await fetch(api, { headers });
            if (!response.ok) throw new Error('Unable to load wishlist');
            const payload = await response.json();

            const legacyIds = JSON.parse(localStorage.getItem('savedMarketThreads') || '[]');
            if (!(payload.items || []).length && legacyIds.length) {
                for (const threadId of legacyIds) {
                    try {
                        const threadResponse = await fetch(`http://localhost:5000/api/threads/${encodeURIComponent(threadId)}`);
                        if (!threadResponse.ok) continue;
                        const threadPayload = await threadResponse.json();
                        const thread = threadPayload.thread;
                        await fetch(`${api}/items`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                productId: thread.id,
                                title: thread.title,
                                price: 0,
                                image: thread.image || ''
                            })
                        });
                    } catch (_migrationError) {
                        // Ignore legacy entries that no longer have a matching thread.
                    }
                }
                localStorage.removeItem('savedMarketThreads');
                return load();
            }

            localStorage.removeItem('savedMarketThreads');
            list.innerHTML = (payload.items || []).map((item) => `
                <article class="card wishlist-item" data-item-id="${escapeHtml(item.id)}">
                    ${item.image ? `<img class="wishlist-img" src="${escapeHtml(item.image)}" alt="">` : ''}
                    <div class="wishlist-content"><a href="thread-detail.html?threadId=${encodeURIComponent(item.productId)}" class="card-title">${escapeHtml(item.title)}</a><p class="mt-1 mb-1">$${Number(item.price).toFixed(2)}</p></div>
                    <div class="wishlist-actions"><button class="btn btn-primary btn-sm" data-action="cart">Move to Cart</button><button class="btn btn-danger btn-sm" data-action="remove">Remove</button></div>
                </article>`).join('') || '<p class="meta-info">Your wishlist is empty.</p>';
            list.querySelectorAll('[data-action="remove"]').forEach((button) => button.addEventListener('click', async () => {
                const card = button.closest('[data-item-id]');
                await fetch(`${api}/items/${encodeURIComponent(card.dataset.itemId)}`, { method: 'DELETE', headers });
                load();
            }));
            list.querySelectorAll('[data-action="cart"]').forEach((button) => button.addEventListener('click', () => {
                const card = button.closest('[data-item-id]');
                const item = (payload.items || []).find((entry) => entry.id === card.dataset.itemId);
                const cart = JSON.parse(localStorage.getItem('forumCart') || '[]');
                cart.push({ id: item.productId, title: item.title, threadId: item.productId, price: item.price, status: 'Wishlist item', movedAt: new Date().toISOString() });
                localStorage.setItem('forumCart', JSON.stringify(cart));
                window.location.href = '../shopping_cart/cart.html';
            }));
        } catch (error) { list.innerHTML = `<p class="meta-info">${escapeHtml(error.message)}</p>`; }
    }

    load();
})();
