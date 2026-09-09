/**
 * Rshop Blog Module - Assessment 2
 * Features:
 * - Blog CRUD through Express API
 * - Authentication/ownership using authToken + authorId
 * - Search, category/tag/author/date filters and sorting
 * - Pagination
 * - Featured post
 * - Draft auto-save with localStorage
 * - Bookmark/save-post with localStorage
 * - Estimated reading time
 * - Interactive comments
 * - Client-side and server-side validation
 */

const BLOG_API = "http://localhost:5000/api/blogs";
const API_BASE = "http://localhost:5000";
const BLOGS_PER_PAGE = 6;

const BOOKMARKS_KEY = "rshop_blog_bookmarks";
const CREATE_DRAFT_KEY = "rshop_blog_draft_create";

let blogListState = {
    allBlogs: [],
    filteredBlogs: [],
    currentPage: 1
};

// ============================================================
// AUTHENTICATION
// ============================================================

function getCurrentUser() {
    if (
        window.UserAccountAPI &&
        typeof window.UserAccountAPI.getCurrentUser === "function"
    ) {
        return window.UserAccountAPI.getCurrentUser();
    }

    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_error) {
        return null;
    }
}

function getCurrentUserId() {
    const user = getCurrentUser();
    return user?.id || user?._id || localStorage.getItem("userId") || "";
}

function getAuthToken() {
    return localStorage.getItem("authToken") || "";
}

function isLoggedIn() {
    return Boolean(getCurrentUserId() && getAuthToken());
}

function redirectToLogin() {
    window.location.href = "../user_account/auth.html";
}

// ============================================================
// API
// ============================================================

async function blogApiRequest(endpoint, options = {}) {
    const token = getAuthToken();

    const headers = {
        ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(
        endpoint.startsWith("http")
            ? endpoint
            : `${API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data = {};
    try {
        data = await response.json();
    } catch (_error) {
        data = {};
    }

    if (response.status === 401) {
        if (window.UserAccountAPI?.showNotification) {
            window.UserAccountAPI.showNotification(
                "Please log in before performing this action.",
                "warning"
            );
        }
        redirectToLogin();
        throw new Error("Authentication required.");
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed with status ${response.status}`
        );
    }

    return data;
}

// ============================================================
// SECURITY / FORMATTING
// ============================================================

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function calculateReadTime(content) {
    const words = String(content || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return Math.max(1, Math.ceil(words.length / 200));
}

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;
}

function clearMessage(element) {
    if (element) {
        element.textContent = "";
        element.className = "form-message";
    }
}

// ============================================================
// BLOG CRUD
// ============================================================

async function getAllBlogs() {
    const data = await blogApiRequest("/api/blogs");
    return data.blogs || [];
}

async function getBlogById(id) {
    const data = await blogApiRequest(
        `/api/blogs/${encodeURIComponent(id)}`
    );
    return data.blog;
}

async function createBlog(form) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return;
    }

    if (!validateBlogForm(form)) return null;

    const tags = form.elements.tags.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

    const body = {
        title: form.elements.title.value.trim(),
        dateAdded: form.elements.date.value,
        category: form.elements.category.value,
        tags,
        image: form.elements.image.value.trim(),
        summary: form.elements.summary.value.trim(),
        content: form.elements.content.value.trim()
    };

    return blogApiRequest("/api/blogs", {
        method: "POST",
        body: JSON.stringify(body)
    });
}

async function updateBlog(id, form) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return null;
    }

    if (!validateBlogForm(form)) return null;

    const tags = form.elements.tags.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

    const body = {
        title: form.elements.title.value.trim(),
        dateAdded: form.elements.date.value,
        category: form.elements.category.value,
        tags,
        image: form.elements.image.value.trim(),
        summary: form.elements.summary.value.trim(),
        content: form.elements.content.value.trim()
    };

    return blogApiRequest(
        `/api/blogs/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            body: JSON.stringify(body)
        }
    );
}

async function deleteBlog(id) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return false;
    }

    if (!window.confirm("Are you sure you want to delete this blog post?")) {
        return false;
    }

    await blogApiRequest(
        `/api/blogs/${encodeURIComponent(id)}`,
        { method: "DELETE" }
    );

    return true;
}

// ============================================================
// SEARCH / FILTER / SORT
// ============================================================

function filterAndSortBlogs(blogs, filters) {
    let results = [...blogs];

    const search = String(filters.search || "").trim().toLowerCase();
    const category = String(filters.category || "").trim().toLowerCase();
    const tag = String(filters.tag || "").trim().toLowerCase();
    const author = String(filters.author || "").trim().toLowerCase();
    const date = String(filters.date || "").trim();
    const sort = filters.sort || "newest";

    if (search) {
        results = results.filter((blog) => {
            const searchableText = [
                blog.title,
                blog.authorName,
                blog.summary,
                blog.content,
                blog.category,
                ...(blog.tags || [])
            ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(search);
        });
    }

    if (category) {
        results = results.filter(
            (blog) =>
                String(blog.category || "").toLowerCase() === category
        );
    }

    if (tag) {
        results = results.filter((blog) =>
            (blog.tags || []).some(
                (item) =>
                    String(item).trim().toLowerCase() === tag
            )
        );
    }

    if (author) {
        results = results.filter((blog) =>
            String(blog.authorName || "")
                .toLowerCase()
                .includes(author)
        );
    }

    if (date) {
        results = results.filter((blog) => {
            const blogDate = String(blog.dateAdded || "").slice(0, 10);
            return blogDate === date;
        });
    }

    if (sort === "oldest") {
        results.sort(
            (a, b) => new Date(a.dateAdded) - new Date(b.dateAdded)
        );
    } else if (sort === "title_asc") {
        results.sort((a, b) =>
            String(a.title || "").localeCompare(String(b.title || ""))
        );
    } else if (sort === "title_desc") {
        results.sort((a, b) =>
            String(b.title || "").localeCompare(String(a.title || ""))
        );
    } else {
        results.sort(
            (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        );
    }

    return results;
}

// ============================================================
// BOOKMARKS
// Store a small snapshot so a saved post can still be opened
// if the API is temporarily unavailable.
// ============================================================

function getBookmarks() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(BOOKMARKS_KEY) || "[]"
        );

        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function isBookmarked(id) {
    return getBookmarks().some(
        (bookmark) => String(bookmark.id) === String(id)
    );
}

function toggleBookmark(blog) {
    const bookmarks = getBookmarks();
    const index = bookmarks.findIndex(
        (bookmark) => String(bookmark.id) === String(blog.id)
    );

    if (index >= 0) {
        bookmarks.splice(index, 1);
    } else {
        bookmarks.push({
            id: blog.id,
            title: blog.title,
            summary: blog.summary,
            content: blog.content,
            authorName: blog.authorName,
            dateAdded: blog.dateAdded,
            category: blog.category,
            tags: blog.tags || [],
            image: blog.image || ""
        });
    }

    localStorage.setItem(
        BOOKMARKS_KEY,
        JSON.stringify(bookmarks)
    );

    return index < 0;
}

// ============================================================
// DRAFTS
// ============================================================

function getDraftKey(type, id = "") {
    if (type === "create") return CREATE_DRAFT_KEY;
    return `rshop_blog_draft_edit_${id}`;
}

function saveDraft(form, key) {
    if (!form || !key) return;

    const draft = {};

    Array.from(form.elements).forEach((element) => {
        if (element.name) {
            draft[element.name] = element.value;
        }
    });

    localStorage.setItem(key, JSON.stringify(draft));
}

function restoreDraft(form, key) {
    if (!form || !key) return false;

    try {
        const draft = JSON.parse(
            localStorage.getItem(key) || "null"
        );

        if (!draft) return false;

        Object.entries(draft).forEach(([name, value]) => {
            const field = form.elements[name];
            if (field && typeof value === "string") {
                field.value = value;
            }
        });

        return true;
    } catch (_error) {
        return false;
    }
}

function clearDraft(key) {
    localStorage.removeItem(key);
}

function bindDraftAutoSave(form, key) {
    const handler = () => saveDraft(form, key);

    Array.from(form.elements).forEach((element) => {
        if (!element.name) return;

        element.addEventListener("input", handler);
        element.addEventListener("change", handler);
    });
}

// ============================================================
// VALIDATION
// ============================================================

function showFieldError(input, message) {
    if (!input) return;

    input.classList.add("input-error");

    const errorId = `${input.id}-error`;
    let errorElement = document.getElementById(errorId);

    if (!errorElement) {
        errorElement = document.createElement("p");
        errorElement.id = errorId;
        errorElement.className = "field-error";
        input.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
}

function clearFieldError(input) {
    if (!input) return;

    input.classList.remove("input-error");

    const errorElement = document.getElementById(
        `${input.id}-error`
    );

    if (errorElement) {
        errorElement.textContent = "";
    }
}

function validateBlogForm(form) {
    let valid = true;

    const title = form.elements.title;
    const date = form.elements.date;
    const category = form.elements.category;
    const summary = form.elements.summary;
    const content = form.elements.content;
    const image = form.elements.image;

    if (title.value.trim().length < 5) {
        showFieldError(
            title,
            "Title must be at least 5 characters."
        );
        valid = false;
    } else {
        clearFieldError(title);
    }

    if (!date.value) {
        showFieldError(date, "Date is required.");
        valid = false;
    } else if (Number.isNaN(new Date(date.value).getTime())) {
        showFieldError(date, "Please enter a valid date.");
        valid = false;
    } else {
        clearFieldError(date);
    }

    if (!category.value.trim()) {
        showFieldError(category, "Please select a category.");
        valid = false;
    } else {
        clearFieldError(category);
    }

    if (summary.value.trim().length < 20) {
        showFieldError(
            summary,
            "Summary must be at least 20 characters."
        );
        valid = false;
    } else {
        clearFieldError(summary);
    }

    if (content.value.trim().length < 50) {
        showFieldError(
            content,
            "Content must be at least 50 characters."
        );
        valid = false;
    } else {
        clearFieldError(content);
    }

    if (image.value.trim()) {
        try {
            const imageUrl = new URL(image.value.trim());

            if (!["http:", "https:"].includes(imageUrl.protocol)) {
                throw new Error("Unsupported protocol");
            }

            clearFieldError(image);
        } catch (_error) {
            showFieldError(
                image,
                "Please enter a valid HTTP or HTTPS image URL."
            );
            valid = false;
        }
    } else {
        clearFieldError(image);
    }

    return valid;
}

function setupLiveValidation(form) {
    Array.from(form.elements).forEach((element) => {
        if (!element.name) return;

        element.addEventListener("input", () => {
            if (element.name === "title" &&
                element.value.trim().length >= 5) {
                clearFieldError(element);
            }

            if (element.name === "summary" &&
                element.value.trim().length >= 20) {
                clearFieldError(element);
            }

            if (element.name === "content" &&
                element.value.trim().length >= 50) {
                clearFieldError(element);
            }

            if (element.name === "image" &&
                !element.value.trim()) {
                clearFieldError(element);
            }
        });

        element.addEventListener("change", () => {
            if (element.value.trim()) {
                clearFieldError(element);
            }
        });
    });
}

// ============================================================
// FEATURED POST
// ============================================================

function renderFeaturedBlog(blogs) {
    const container = document.getElementById("featured-blog");
    if (!container) return;

    if (!blogs.length) {
        container.innerHTML = "";
        return;
    }

    const featured =
        blogs.find((blog) => blog.featured === true) ||
        [...blogs].sort(
            (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        )[0];

    container.innerHTML = `
        <article class="featured-post">
            ${
                featured.image
                    ? `
                        <img
                            class="featured-image"
                            src="${escapeHtml(featured.image)}"
                            alt="${escapeHtml(featured.title)}"
                        >
                    `
                    : ""
            }

            <div class="featured-content">
                <span class="category-badge">
                    ${escapeHtml(featured.category)}
                </span>

                <h2>
                    ${escapeHtml(featured.title)}
                </h2>

                <p class="post-summary">
                    ${escapeHtml(featured.summary)}
                </p>

                <p class="post-meta">
                    By
                    <strong>${escapeHtml(featured.authorName || "Unknown")}</strong>
                    · ${escapeHtml(formatDate(featured.dateAdded))}
                    · ${calculateReadTime(featured.content)} min read
                </p>

                <a
                    href="blog-detail.html?id=${encodeURIComponent(featured.id)}"
                    class="btn btn-primary"
                >
                    Read featured post
                </a>
            </div>
        </article>
    `;
}

// ============================================================
// BLOG LIST + PAGINATION
// ============================================================

function renderBlogList(blogs) {
    const container = document.getElementById("blog-results");
    const countElement = document.getElementById("blog-result-count");

    if (!container) return;

    if (countElement) {
        countElement.textContent =
            `${blogs.length} post${blogs.length === 1 ? "" : "s"} found`;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(blogs.length / BLOGS_PER_PAGE)
    );

    if (blogListState.currentPage > totalPages) {
        blogListState.currentPage = totalPages;
    }

    const start =
        (blogListState.currentPage - 1) * BLOGS_PER_PAGE;

    const pageBlogs = blogs.slice(
        start,
        start + BLOGS_PER_PAGE
    );

    if (!pageBlogs.length) {
        container.innerHTML = `
            <div class="card empty-state">
                <h3>No blog posts found</h3>
                <p>
                    Try changing your search, filter or sort options.
                </p>
            </div>
        `;
    } else {
        container.innerHTML = pageBlogs.map((blog) => {
            const tags = (blog.tags || [])
                .map(
                    (tag) => `
                        <span class="tag-static">
                            ${escapeHtml(tag)}
                        </span>
                    `
                )
                .join("");

            const bookmarked = isBookmarked(blog.id);

            return `
                <article class="card blog-post-card">
                    ${
                        blog.image
                            ? `
                                <img
                                    class="post-thumbnail"
                                    src="${escapeHtml(blog.image)}"
                                    alt="${escapeHtml(blog.title)}"
                                >
                            `
                            : `
                                <div class="post-thumbnail post-thumbnail-placeholder">
                                    No image
                                </div>
                            `
                    }

                    <div class="post-body">
                        <div class="post-badges">
                            <span class="category-badge">
                                ${escapeHtml(blog.category)}
                            </span>
                            ${tags}
                        </div>

                        <h3 class="post-title">
                            <a
                                href="blog-detail.html?id=${encodeURIComponent(blog.id)}"
                            >
                                ${escapeHtml(blog.title)}
                            </a>
                        </h3>

                        <p class="post-summary">
                            ${escapeHtml(blog.summary)}
                        </p>

                        <p class="post-meta">
                            By
                            <strong>
                                ${escapeHtml(blog.authorName || "Unknown")}
                            </strong>
                            · ${escapeHtml(formatDate(blog.dateAdded))}
                            · ${calculateReadTime(blog.content)} min read
                        </p>

                        <div class="post-actions">
                            <a
                                href="blog-detail.html?id=${encodeURIComponent(blog.id)}"
                                class="btn btn-primary btn-sm"
                            >
                                Read full post
                            </a>

                            <button
                                type="button"
                                class="btn btn-secondary btn-sm bookmark-list-button"
                                data-bookmark-id="${escapeHtml(blog.id)}"
                                aria-pressed="${bookmarked}"
                            >
                                ${bookmarked ? "Saved" : "Save post"}
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    renderPagination(blogs.length);

    container
        .querySelectorAll(".bookmark-list-button")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const blog = blogListState.allBlogs.find(
                    (item) =>
                        String(item.id) ===
                        String(button.dataset.bookmarkId)
                );

                if (!blog) return;

                const saved = toggleBookmark(blog);

                button.textContent = saved ? "Saved" : "Save post";
                button.setAttribute("aria-pressed", String(saved));
            });
        });
}

function renderPagination(totalItems) {
    const container = document.getElementById("blog-pagination");
    if (!container) return;

    const totalPages = Math.ceil(
        totalItems / BLOGS_PER_PAGE
    );

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    const buttons = [];

    buttons.push(`
        <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-page="${blogListState.currentPage - 1}"
            ${blogListState.currentPage === 1 ? "disabled" : ""}
        >
            Previous
        </button>
    `);

    for (let page = 1; page <= totalPages; page += 1) {
        buttons.push(`
            <button
                type="button"
                class="btn ${
                    page === blogListState.currentPage
                        ? "btn-primary"
                        : "btn-secondary"
                } btn-sm"
                data-page="${page}"
                aria-current="${
                    page === blogListState.currentPage
                        ? "page"
                        : "false"
                }"
            >
                ${page}
            </button>
        `);
    }

    buttons.push(`
        <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-page="${blogListState.currentPage + 1}"
            ${
                blogListState.currentPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            Next
        </button>
    `);

    container.innerHTML = buttons.join("");

    container
        .querySelectorAll("[data-page]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const page = Number(button.dataset.page);

                if (
                    page >= 1 &&
                    page <= totalPages &&
                    page !== blogListState.currentPage
                ) {
                    blogListState.currentPage = page;
                    renderBlogList(blogListState.filteredBlogs);

                    document
                        .getElementById("list-heading")
                        ?.scrollIntoView({ behavior: "smooth" });
                }
            });
        });
}

async function initBlogList() {
    const filterForm =
        document.getElementById("blog-filter-form");

    if (!filterForm) return;

    const searchInput =
        document.getElementById("search-query");
    const categorySelect =
        document.getElementById("filter-category");
    const tagSelect =
        document.getElementById("filter-tag");
    const authorInput =
        document.getElementById("filter-author");
    const dateInput =
        document.getElementById("filter-date");
    const sortSelect =
        document.getElementById("sort-blog");

    try {
        blogListState.allBlogs = await getAllBlogs();
        renderFeaturedBlog(blogListState.allBlogs);
    } catch (error) {
        console.error(error);

        const container =
            document.getElementById("blog-results");

        if (container) {
            container.innerHTML = `
                <div class="card">
                    <p class="field-error">
                        ${escapeHtml(error.message)}
                    </p>
                </div>
            `;
        }

        return;
    }

    function applyClientFilters() {
        blogListState.filteredBlogs = filterAndSortBlogs(
            blogListState.allBlogs,
            {
                search: searchInput?.value || "",
                category: categorySelect?.value || "",
                tag: tagSelect?.value || "",
                author: authorInput?.value || "",
                date: dateInput?.value || "",
                sort: sortSelect?.value || "newest"
            }
        );

        blogListState.currentPage = 1;
        renderBlogList(blogListState.filteredBlogs);
    }

    filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyClientFilters();
    });

    [
        searchInput,
        categorySelect,
        tagSelect,
        authorInput,
        dateInput,
        sortSelect
    ]
        .filter(Boolean)
        .forEach((element) => {
            element.addEventListener("input", applyClientFilters);
            element.addEventListener("change", applyClientFilters);
        });

    document
        .querySelectorAll(".tag-list a[data-blog-tag]")
        .forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();

                if (tagSelect) {
                    tagSelect.value =
                        link.dataset.blogTag || "";
                }

                applyClientFilters();
            });
        });

    applyClientFilters();
}

// ============================================================
// COMMENTS
// ============================================================

async function getComments(blogId) {
    const data = await blogApiRequest(
        `/api/blogs/${encodeURIComponent(blogId)}/comments`
    );

    return data.comments || [];
}

async function createComment(blogId, content) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return null;
    }

    return blogApiRequest(
        `/api/blogs/${encodeURIComponent(blogId)}/comments`,
        {
            method: "POST",
            body: JSON.stringify({ content })
        }
    );
}

async function updateComment(blogId, commentId, content) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return null;
    }

    return blogApiRequest(
        `/api/blogs/${encodeURIComponent(blogId)}/comments/${encodeURIComponent(commentId)}`,
        {
            method: "PUT",
            body: JSON.stringify({ content })
        }
    );
}

async function deleteComment(blogId, commentId) {
    if (!isLoggedIn()) {
        redirectToLogin();
        return null;
    }

    return blogApiRequest(
        `/api/blogs/${encodeURIComponent(blogId)}/comments/${encodeURIComponent(commentId)}`,
        { method: "DELETE" }
    );
}

function renderComments(blogId, comments) {
    const list = document.getElementById("comments-list");
    if (!list) return;

    if (!comments.length) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No comments yet. Be the first to comment.</p>
            </div>
        `;
        return;
    }

    const currentUserId = String(getCurrentUserId());

    list.innerHTML = comments.map((comment) => {
        const owner =
            String(comment.authorId || "") === currentUserId;

        return `
            <article class="comment">
                <p class="comment-meta">
                    ${escapeHtml(comment.authorName || "Unknown")}
                    · ${escapeHtml(formatDate(comment.dateAdded))}
                </p>

                <p class="comment-content">
                    ${escapeHtml(comment.content)}
                </p>

                ${
                    owner
                        ? `
                            <div class="comment-actions">
                                <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    data-edit-comment="${escapeHtml(comment.id)}"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-danger btn-sm"
                                    data-delete-comment="${escapeHtml(comment.id)}"
                                >
                                    Delete
                                </button>
                            </div>
                        `
                        : ""
                }
            </article>
        `;
    }).join("");

    list.querySelectorAll("[data-edit-comment]")
        .forEach((button) => {
            button.addEventListener("click", async () => {
                const comment = comments.find(
                    (item) =>
                        String(item.id) ===
                        String(button.dataset.editComment)
                );

                if (!comment) return;

                const content = window.prompt(
                    "Edit your comment:",
                    comment.content
                );

                if (content === null) return;

                if (content.trim().length < 2) {
                    window.alert(
                        "Comment must be at least 2 characters."
                    );
                    return;
                }

                try {
                    await updateComment(
                        blogId,
                        comment.id,
                        content.trim()
                    );

                    await loadComments(blogId);
                } catch (error) {
                    window.alert(error.message);
                }
            });
        });

    list.querySelectorAll("[data-delete-comment]")
        .forEach((button) => {
            button.addEventListener("click", async () => {
                if (!window.confirm("Delete this comment?")) return;

                try {
                    await deleteComment(
                        blogId,
                        button.dataset.deleteComment
                    );

                    await loadComments(blogId);
                } catch (error) {
                    window.alert(error.message);
                }
            });
        });
}

async function loadComments(blogId) {
    const list = document.getElementById("comments-list");
    if (list) {
        list.innerHTML = "<p class=\"muted\">Loading comments...</p>";
    }

    try {
        const comments = await getComments(blogId);
        renderComments(blogId, comments);
    } catch (error) {
        if (list) {
            list.innerHTML = `
                <p class="field-error">
                    ${escapeHtml(error.message)}
                </p>
            `;
        }
    }
}

function renderCommentForm(blogId) {
    const container =
        document.getElementById("comment-form-container");

    if (!container) return;

    if (!isLoggedIn()) {
        container.innerHTML = `
            <div class="comment-form">
                <p>
                    <a href="../user_account/auth.html">
                        Log in
                    </a>
                    to leave a comment.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <form class="comment-form" id="blog-comment-form" novalidate>
            <h3>Leave a comment</h3>

            <div class="form-group">
                <label for="comment-content">
                    Comment
                </label>

                <textarea
                    class="input"
                    id="comment-content"
                    name="content"
                    rows="4"
                    minlength="2"
                    maxlength="1000"
                    required
                    placeholder="Share your thoughts about this article..."
                ></textarea>
            </div>

            <p
                id="comment-form-message"
                class="form-message"
                role="alert"
            ></p>

            <button
                type="submit"
                class="btn btn-primary"
            >
                Post comment
            </button>
        </form>
    `;

    const form =
        document.getElementById("blog-comment-form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const textarea =
            form.elements.content;
        const message =
            document.getElementById("comment-form-message");

        const content = textarea.value.trim();

        if (content.length < 2) {
            showMessage(
                message,
                "Comment must be at least 2 characters.",
                "error"
            );
            return;
        }

        try {
            await createComment(blogId, content);

            textarea.value = "";
            clearMessage(message);
            await loadComments(blogId);
        } catch (error) {
            showMessage(message, error.message, "error");
        }
    });
}

// ============================================================
// CREATE PAGE
// ============================================================

async function initCreateBlogPage() {
    const form =
        document.getElementById("blog-create-form");

    if (!form) return;

    if (!isLoggedIn()) {
        redirectToLogin();
        return;
    }

    const draftKey = getDraftKey("create");

    restoreDraft(form, draftKey);
    bindDraftAutoSave(form, draftKey);
    setupLiveValidation(form);

    if (!form.elements.date.value) {
        form.elements.date.value =
            new Date().toISOString().slice(0, 10);
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message =
            document.getElementById("create-form-message");

        clearMessage(message);

        try {
            const data = await createBlog(form);

            if (!data) return;

            clearDraft(draftKey);

            window.alert("Blog post created successfully.");

            window.location.href =
                `blog-detail.html?id=${encodeURIComponent(data.blog.id)}`;
        } catch (error) {
            showMessage(message, error.message, "error");
        }
    });

    form.addEventListener("reset", () => {
        setTimeout(() => {
            clearDraft(draftKey);
        }, 0);
    });

    const clearButton =
        document.getElementById("clear-create-form-button");

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            form.reset();
            clearDraft(draftKey);

            if (form.elements.date) {
                form.elements.date.value =
                    new Date().toISOString().slice(0, 10);
            }
        });
    }
}

// ============================================================
// EDIT PAGE
// ============================================================

async function initEditBlogPage() {
    const form =
        document.getElementById("blog-edit-form");

    if (!form) return;

    if (!isLoggedIn()) {
        redirectToLogin();
        return;
    }

    const id = getQueryParam("id");

    if (!id) {
        window.alert("Blog post ID is missing.");
        window.location.href = "blog-list.html";
        return;
    }

    try {
        const blog = await getBlogById(id);

        if (
            String(blog.authorId || "") !==
            String(getCurrentUserId())
        ) {
            window.alert(
                "You can only edit your own blog posts."
            );
            window.location.href =
                `blog-detail.html?id=${encodeURIComponent(id)}`;
            return;
        }

        form.elements.title.value = blog.title || "";
        form.elements.date.value = blog.dateAdded || "";
        form.elements.category.value = blog.category || "";
        form.elements.tags.value = (blog.tags || []).join(", ");
        form.elements.image.value = blog.image || "";
        form.elements.summary.value = blog.summary || "";
        form.elements.content.value = blog.content || "";

        const draftKey = getDraftKey("edit", id);

        restoreDraft(form, draftKey);
        bindDraftAutoSave(form, draftKey);
        setupLiveValidation(form);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const message =
                document.getElementById("edit-form-message");

            clearMessage(message);

            try {
                const data = await updateBlog(id, form);

                if (!data) return;

                clearDraft(draftKey);

                window.alert(
                    "Blog post updated successfully."
                );

                window.location.href =
                    `blog-detail.html?id=${encodeURIComponent(id)}`;
            } catch (error) {
                showMessage(message, error.message, "error");
            }
        });

        const deleteButton =
            document.getElementById("delete-blog-button");

        if (deleteButton) {
            deleteButton.addEventListener("click", async () => {
                try {
                    const deleted = await deleteBlog(id);

                    if (deleted) {
                        clearDraft(draftKey);
                        window.alert(
                            "Blog post deleted successfully."
                        );
                        window.location.href = "blog-list.html";
                    }
                } catch (error) {
                    const message =
                        document.getElementById("edit-form-message");

                    showMessage(
                        message,
                        error.message,
                        "error"
                    );
                }
            });
        }
    } catch (error) {
        window.alert(error.message);
        window.location.href = "blog-list.html";
    }
}

// ============================================================
// DETAIL PAGE
// ============================================================

async function initBlogDetailPage() {
    const container =
        document.getElementById("blog-detail");

    if (!container) return;

    const id = getQueryParam("id");

    if (!id) {
        container.innerHTML = `
            <p class="field-error">
                Blog post ID is missing.
            </p>
        `;
        return;
    }

    let blog;

    try {
        blog = await getBlogById(id);
    } catch (error) {
        const localBookmark =
            getBookmarks().find(
                (bookmark) =>
                    String(bookmark.id) === String(id)
            );

        if (localBookmark) {
            blog = localBookmark;
        } else {
            container.innerHTML = `
                <p class="field-error">
                    ${escapeHtml(error.message)}
                </p>
            `;
            return;
        }
    }

    const tags = (blog.tags || [])
        .map(
            (tag) => `
                <span class="tag-static">
                    ${escapeHtml(tag)}
                </span>
            `
        )
        .join("");

    const paragraphs = String(blog.content || "")
        .split(/\n+/)
        .filter(Boolean)
        .map(
            (paragraph) =>
                `<p>${escapeHtml(paragraph)}</p>`
        )
        .join("");

    const owner =
        String(blog.authorId || "") ===
        String(getCurrentUserId());

    const bookmarked = isBookmarked(blog.id);

    container.innerHTML = `
        <a
            href="blog-list.html"
            class="back-link"
        >
            &larr; Back to all posts
        </a>

        <div class="post-badges">
            <span class="category-badge">
                ${escapeHtml(blog.category)}
            </span>
            ${tags}
        </div>

        <h1>
            ${escapeHtml(blog.title)}
        </h1>

        <p class="post-meta">
            By
            <strong>
                ${escapeHtml(blog.authorName || "Unknown")}
            </strong>
            · Published ${escapeHtml(formatDate(blog.dateAdded))}
            · ${calculateReadTime(blog.content)} min read
        </p>

        ${
            blog.image
                ? `
                    <img
                        class="detail-image"
                        src="${escapeHtml(blog.image)}"
                        alt="${escapeHtml(blog.title)}"
                    >
                `
                : ""
        }

        ${
            blog.summary
                ? `
                    <p class="post-summary detail-summary">
                        ${escapeHtml(blog.summary)}
                    </p>
                `
                : ""
        }

        <div class="post-content">
            ${paragraphs}
        </div>

        <div class="detail-actions">
            <button
                type="button"
                id="bookmark-detail-button"
                class="btn btn-secondary"
                aria-pressed="${bookmarked}"
            >
                ${bookmarked ? "Saved" : "Save post"}
            </button>

            ${
                owner
                    ? `
                        <a
                            href="blog-edit.html?id=${encodeURIComponent(blog.id)}"
                            class="btn btn-primary"
                        >
                            Edit post
                        </a>

                        <button
                            type="button"
                            id="delete-detail-button"
                            class="btn btn-danger"
                        >
                            Delete post
                        </button>
                    `
                    : ""
            }

            <a
                href="blog-list.html"
                class="btn btn-secondary"
            >
                Back to list
            </a>
        </div>
    `;

    const bookmarkButton =
        document.getElementById(
            "bookmark-detail-button"
        );

    if (bookmarkButton) {
        bookmarkButton.addEventListener("click", () => {
            const saved = toggleBookmark(blog);

            bookmarkButton.textContent =
                saved ? "Saved" : "Save post";

            bookmarkButton.setAttribute(
                "aria-pressed",
                String(saved)
            );
        });
    }

    const deleteButton =
        document.getElementById("delete-detail-button");

    if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
            try {
                const deleted =
                    await deleteBlog(blog.id);

                if (deleted) {
                    window.alert(
                        "Blog post deleted successfully."
                    );
                    window.location.href =
                        "blog-list.html";
                }
            } catch (error) {
                window.alert(error.message);
            }
        });
    }

    renderCommentForm(blog.id);
    await loadComments(blog.id);
}

// ============================================================
// BOOTSTRAP
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initBlogList();
    initCreateBlogPage();
    initEditBlogPage();
    initBlogDetailPage();
});
