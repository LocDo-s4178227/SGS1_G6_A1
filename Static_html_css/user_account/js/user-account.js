(function () {
  const API_BASE_URL = "http://localhost:5000/api";

  function normalizeEndpoint(endpoint) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return path.startsWith("/api") ? path : `${API_BASE_URL}${path}`;
  }

  async function apiRequest(endpoint, options = {}) {
    const url = normalizeEndpoint(endpoint);
    const config = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body !== "string" && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    let payload = {};

    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.message || `Request failed (${response.status})`);
    }

    return payload;
  }

  function isStrongPassword(value) {
    if (typeof value !== "string") return false;
    return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_error) {
      return null;
    }
  }

  function setCurrentUser(user, token = null) {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      const userId = user.id || user._id;
      if (userId) localStorage.setItem("userId", userId);
      const username = user.username || user.email || "";
      if (username) localStorage.setItem("username", username);
      const role = Array.isArray(user.userType) ? user.userType[0] : (user.role || "poster");
      if (role) localStorage.setItem("userType", role);
    }

    if (token) {
      localStorage.setItem("authToken", token);
    }
  }

  async function login({ username, email, password }) {
    return apiRequest("/auth/login", {
      method: "POST",
      body: { username, email, password }
    });
  }

  async function register({ username, email, password, role, userType }) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: {
        username,
        email,
        password,
        role,
        userType: userType || role
      }
    });
  }

  async function forgotPassword(email) {
    return apiRequest("/auth/forgot-password", {
      method: "POST",
      body: { email }
    });
  }

  async function resetPassword(token, newPassword) {
    return apiRequest("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword }
    });
  }

  async function getUserProfile(userId) {
    return apiRequest(`/auth/user/${userId}`);
  }

  async function updateUserProfile(userId, profileData) {
    return apiRequest(`/auth/user/${userId}`, {
      method: "PUT",
      body: profileData
    });
  }

  async function changePassword(userId, currentPassword, newPassword) {
    return apiRequest("/auth/change-password", {
      method: "POST",
      body: { userId, currentPassword, newPassword }
    });
  }

  async function deactivateUser(userId) {
    return apiRequest(`/auth/user/${userId}/deactivate`, {
      method: "PUT"
    });
  }

  async function deleteUser(userId, password) {
    return apiRequest(`/auth/user/${userId}`, {
      method: "DELETE",
      body: { password }
    });
  }

  function showNotification(message, type = "info", duration = 3000) {
    const container = document.body || document.querySelector("body");
    if (!container) return null;

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.setAttribute("role", "alert");
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "⚠" : "ℹ"}</span>
        <span class="notification-message">${String(message)}</span>
        <button class="notification-close" aria-label="Close notification">×</button>
      </div>
    `;

    notification.querySelector(".notification-close").addEventListener("click", () => notification.remove());
    document.body.appendChild(notification);

    if (duration > 0) {
      setTimeout(() => notification.remove(), duration);
    }

    return notification;
  }

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("userType");
    localStorage.removeItem("username");
    localStorage.removeItem("authToken");
    localStorage.removeItem("resetToken");
  }

  const UserAccountAPI = {
    API_BASE_URL,
    apiRequest,
    isStrongPassword,
    getCurrentUser,
    setCurrentUser,
    showNotification,
    login,
    register,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    changePassword,
    deactivateUser,
    deleteUser,
    logout
  };

  window.UserAccountAPI = UserAccountAPI;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = UserAccountAPI;
  }
})();
