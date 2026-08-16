(function () {
  "use strict";

  const API_BASE = "http://localhost:5000/api";
  const sessionId = localStorage.getItem("sessionId") || crypto.randomUUID();
  const storageKey = `cart_${sessionId}`;
  localStorage.setItem("sessionId", sessionId);

  const elements = {
    body: document.getElementById("cartTableBody"),
    subtotalLabel: document.getElementById("subtotalLabel"),
    subtotalValue: document.getElementById("subtotalValue"),
    serviceFee: document.getElementById("serviceFee"),
    taxValue: document.getElementById("taxValue"),
    totalValue: document.getElementById("totalValue"),
    checkoutLink: document.getElementById("checkoutLink")
  };

  let items = [];
  let usingBackend = true;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character]));
  }

  function normalizeItem(item) {
    return {
      id: item.id || item.threadId || item.productId,
      productId: item.productId || item.threadId || item.id,
      title: item.title || item.productName || item.textDetails?.title || item.productId || "Cart item",
      maker: item.maker || item.textDetails?.maker || "Marketplace seller",
      price: Number(item.unitPrice ?? item.price ?? 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      status: item.status || item.textDetails?.status || "Ready for checkout"
    };
  }

  function saveFallback() {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
    return payload;
  }

  function render() {
    if (!items.length) {
      elements.body.innerHTML = '<tr><td colspan="5" class="cart-empty" role="status">Your cart is empty. Add an item from the marketplace or wishlist.</td></tr>';
    } else {
      elements.body.innerHTML = items.map((item) => `
        <tr data-item-id="${escapeHtml(item.id)}">
          <td><strong>${escapeHtml(item.title)}</strong><small class="cart-item-meta">${escapeHtml(item.maker)}</small></td>
          <td><a href="../discuss_forum/thread-detail.html?threadId=${encodeURIComponent(item.productId)}">${escapeHtml(item.productId)}</a></td>
          <td>$${item.price.toFixed(2)}</td>
          <td><span>${escapeHtml(item.status)}</span><label class="cart-quantity">Qty <input type="number" min="1" value="${item.quantity}" data-action="quantity" aria-label="Quantity for ${escapeHtml(item.title)}"></label></td>
          <td><button type="button" class="btn btn-link btn-small" data-action="remove">Remove</button></td>
        </tr>
      `).join("");
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const serviceFee = items.length ? items.length * 10 : 0;
    const tax = (subtotal + serviceFee) * 0.1;
    const total = subtotal + serviceFee + tax;
    elements.subtotalLabel.textContent = `Subtotal (${items.length} item${items.length === 1 ? "" : "s"})`;
    elements.subtotalValue.textContent = `$${subtotal.toFixed(2)}`;
    elements.serviceFee.textContent = `$${serviceFee.toFixed(2)}`;
    elements.taxValue.textContent = `$${tax.toFixed(2)}`;
    elements.totalValue.textContent = `$${total.toFixed(2)}`;
    elements.checkoutLink.classList.toggle("disabled", items.length === 0);
    elements.checkoutLink.setAttribute("aria-disabled", String(items.length === 0));
    elements.checkoutLink.href = items.length ? `checkout.html?sessionId=${encodeURIComponent(sessionId)}` : "#";
    document.querySelectorAll(".cart-badge").forEach((badge) => { badge.textContent = `(${items.length})`; });
  }

  async function load() {
    try {
      const payload = await request(`/cart/${encodeURIComponent(sessionId)}`);
      items = (payload.items || []).map(normalizeItem);
      usingBackend = true;

      const legacyItems = JSON.parse(localStorage.getItem("forumCart") || "[]");
      if (!items.length && Array.isArray(legacyItems) && legacyItems.length) {
        for (const legacyItem of legacyItems) {
          await request(`/cart/${encodeURIComponent(sessionId)}/items`, {
            method: "POST",
            body: JSON.stringify({
              productId: legacyItem.threadId || legacyItem.id,
              quantity: 1,
              unitPrice: Number(legacyItem.price || 0),
              textDetails: { title: legacyItem.title || "Cart item", maker: legacyItem.maker || "Marketplace seller", status: legacyItem.status || "Ready for checkout" }
            })
          });
        }
        localStorage.removeItem("forumCart");
        const migrated = await request(`/cart/${encodeURIComponent(sessionId)}`);
        items = (migrated.items || []).map(normalizeItem);
      } else if (items.length && legacyItems.length) {
        // The backend is authoritative once it has cart data; discard stale legacy entries.
        localStorage.removeItem("forumCart");
      }
      saveFallback();
    } catch (error) {
      usingBackend = false;
      try { items = JSON.parse(localStorage.getItem(storageKey) || "[]").map(normalizeItem); } catch (_storageError) { items = []; }
      console.warn("Cart API unavailable; using offline cart cache.", error);
    }
    render();
  }

  async function removeItem(itemId) {
    if (!confirm("Remove this item from your cart?")) return;
    try {
      if (usingBackend) {
        const payload = await request(`/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
        items = (payload.items || []).map(normalizeItem);
      } else {
        items = items.filter((item) => item.id !== itemId);
        saveFallback();
      }
      try {
        const legacyItems = JSON.parse(localStorage.getItem("forumCart") || "[]");
        localStorage.setItem("forumCart", JSON.stringify(legacyItems.filter((item) => (item.threadId || item.id) !== itemId)));
      } catch (_storageError) {
        localStorage.removeItem("forumCart");
      }
      saveFallback();
      render();
    } catch (error) { alert(error.message); }
  }

  async function updateQuantity(itemId, quantity) {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) return load();
    try {
      if (usingBackend) {
        const payload = await request(`/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`, { method: "PUT", body: JSON.stringify({ quantity: parsed }) });
        items = (payload.items || []).map(normalizeItem);
      } else {
        const item = items.find((entry) => entry.id === itemId);
        if (item) item.quantity = parsed;
        saveFallback();
      }
      saveFallback();
      render();
    } catch (error) { alert(error.message); }
  }

  elements.body.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove"]');
    if (button) removeItem(button.closest("tr").dataset.itemId);
  });
  elements.body.addEventListener("change", (event) => {
    const input = event.target.closest('[data-action="quantity"]');
    if (input) updateQuantity(input.closest("tr").dataset.itemId, input.value);
  });
  elements.checkoutLink.addEventListener("click", (event) => {
    if (!items.length) event.preventDefault();
  });

  load();
})();
