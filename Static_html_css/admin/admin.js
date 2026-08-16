(function () {
    'use strict';

    const API = 'http://localhost:5000/api';
    const currentUserId = () => localStorage.getItem('userId') || '';
    const currentUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_error) { return null; } };
    const headers = () => ({ 'Content-Type': 'application/json', ...(currentUserId() ? { 'x-user-id': currentUserId() } : {}) });

    async function request(path, options = {}) {
        const response = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
        return payload;
    }

    function message(text, type = 'info') {
        let target = document.getElementById('adminMessage');
        if (!target) {
            target = document.createElement('p');
            target.id = 'adminMessage';
            target.setAttribute('role', 'status');
            document.querySelector('main')?.prepend(target);
        }
        target.textContent = text;
        target.dataset.type = type;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    }

    function ensureAdmin() {
        const user = currentUser();
        if (!user || !(user.username === 'admin' || user.userType?.includes('admin') || user.role === 'admin')) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async function login(form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = form.elements.username.value.trim();
            const password = form.elements.password.value;
            try {
                const response = await request('/auth/login', { method: 'POST', headers: { 'x-user-id': '' }, body: JSON.stringify({ username, password }) });
                const user = response.user;
                if (!(user.username === 'admin' || user.userType?.includes('admin') || user.role === 'admin')) throw new Error('Administrator account required');
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('userId', user.id || user._id);
                localStorage.setItem('userType', 'admin');
                localStorage.setItem('authToken', response.token);
                window.location.href = 'dashboard.html';
            } catch (error) { message(error.message, 'error'); }
        });
    }

    async function loadStats() {
        if (!ensureAdmin()) return;
        try {
            const { stats } = await request('/admin/stats');
            const values = document.querySelectorAll('.stat-value');
            const numbers = [stats.users, stats.blogs, stats.lockedUsers, stats.threads];
            values.forEach((element, index) => { if (numbers[index] !== undefined) element.textContent = numbers[index]; });
        } catch (error) { message(error.message, 'error'); }
    }

    async function loadUsers() {
        if (!ensureAdmin()) return;
        const form = document.querySelector('.filters');
        const params = new URLSearchParams(new FormData(form));
        try {
            const { users } = await request(`/admin/users?${params.toString()}`);
            const body = document.querySelector('.data-table tbody');
            const heading = document.querySelector('#users-table-heading');
            if (heading) heading.textContent = `All users (${users.length} total)`;
            body.innerHTML = users.map((user) => {
                const role = user.userType?.[0] || 'user';
                return `<tr data-user-id="${escapeHtml(user.id)}"><td><strong>${escapeHtml(user.username)}</strong></td><td>${escapeHtml(user.email)}</td><td><span class="role-badge ${role === 'admin' ? 'role-admin' : 'role-user'}">${escapeHtml(role)}</span></td><td><span class="status-badge ${user.active ? 'status-active' : 'status-locked'}">${user.active ? 'Active' : 'Locked'}</span></td><td>${escapeHtml(user.createdAt || 'Current')}</td><td><div class="table-actions"><button type="button" class="btn ${user.active ? 'btn-danger' : 'btn-success'} btn-sm" data-action="status">${user.active ? 'Lock' : 'Unlock'}</button><button type="button" class="btn btn-outline btn-sm" data-action="role">${role === 'admin' ? 'Make user' : 'Make admin'}</button><button type="button" class="btn btn-danger btn-sm" data-action="delete">Delete</button></div></td></tr>`;
            }).join('');
            body.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => handleUserAction(button)));
        } catch (error) { message(error.message, 'error'); }
    }

    async function handleUserAction(button) {
        const row = button.closest('tr');
        const id = row.dataset.userId;
        const action = button.dataset.action;
        try {
            if (action === 'status') {
                const locked = button.textContent.trim() === 'Lock';
                await request(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ active: !locked }) });
            } else if (action === 'role') {
                await request(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'PUT', body: JSON.stringify({ role: button.textContent.trim() === 'Make admin' ? 'admin' : 'poster' }) });
            } else if (action === 'delete' && confirm('Delete this user?')) {
                await request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
            }
            await loadUsers();
        } catch (error) { message(error.message, 'error'); }
    }

    async function loadProfile() {
        if (!ensureAdmin()) return;
        try {
            const user = (await request(`/auth/user/${encodeURIComponent(currentUserId())}`));
            document.getElementById('profile-firstname').value = user.firstName || '';
            document.getElementById('profile-lastname').value = user.lastName || '';
            document.getElementById('profile-email').value = user.email || '';
            document.getElementById('profile-description').value = user.description || '';
            const profileForm = document.querySelector('#personal-info form');
            profileForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try { await request(`/auth/user/${encodeURIComponent(currentUserId())}`, { method: 'PUT', body: JSON.stringify({ firstName: profileForm.elements.firstname.value, lastName: profileForm.elements.lastname.value, email: profileForm.elements.email.value, description: profileForm.elements.description.value }) }); message('Profile saved.', 'success'); } catch (error) { message(error.message, 'error'); }
            });
            const passwordForm = document.querySelector('#security form');
            passwordForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (passwordForm.elements.new_password.value !== passwordForm.elements.confirm_password.value) return message('Passwords do not match.', 'error');
                try { await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ userId: currentUserId(), currentPassword: passwordForm.elements.current_password.value, newPassword: passwordForm.elements.new_password.value }) }); passwordForm.reset(); message('Password updated.', 'success'); } catch (error) { message(error.message, 'error'); }
            });
        } catch (error) { message(error.message, 'error'); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.querySelector('.auth-card form');
        if (loginForm && location.pathname.endsWith('/login.html')) return login(loginForm);
        if (document.querySelector('.stats-grid')) loadStats();
        if (document.querySelector('.data-table')) {
            const form = document.querySelector('.filters');
            form.addEventListener('submit', (event) => { event.preventDefault(); loadUsers(); });
            form.querySelectorAll('input, select').forEach((field) => field.addEventListener('input', loadUsers));
            loadUsers();
        }
        if (document.querySelector('#personal-info form')) loadProfile();
    });
})();
