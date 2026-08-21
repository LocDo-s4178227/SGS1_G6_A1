/**
 * Rshop Blog Module - Assessment 2
 *
 * Responsibilities:
 * - Client-side validation
 * - Search
 * - Filter
 * - Sort
 * - Web Storage API / localStorage
 * - CRUD requests to Express API
 * - Authentication using shared authToken
 */

// ============================================================
// CONFIGURATION
// ============================================================

const BLOG_API = "http://localhost:5000/api/blogs";


// ============================================================
// AUTHENTICATION
// Reuses the existing User Account module.
// The same authToken is created by /api/auth/login.
// ============================================================

function getCurrentUser() {
    if (
        window.UserAccountAPI &&
        typeof window.UserAccountAPI.getCurrentUser === "function"
    ) {
        return window.UserAccountAPI.getCurrentUser();
    }

    try {
        return JSON.parse(
            localStorage.getItem("user") || "null"
        );
    } catch (_error) {
        return null;
    }
}


function getAuthToken() {
    return localStorage.getItem("authToken") || "";
}


// ============================================================
// API HELPER
// ============================================================

async function blogApiRequest(endpoint, options = {}) {
    const token = getAuthToken();

    const headers = {
        "Content-Type": "application/json",
        ...(token
            ? {
                  Authorization: `Bearer ${token}`
              }
            : {}),
        ...(options.headers || {})
    };

    const response = await fetch(
        endpoint.startsWith("http")
            ? endpoint
            : `http://localhost:5000${endpoint}`,
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
        alert("Please log in before performing this action.");

        window.location.href =
            "../user_account/auth.html";

        throw new Error("Authentication required.");
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}


// ============================================================
// HTML SECURITY HELPER
// Prevents blog content from injecting HTML into the page.
// ============================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// URL QUERY HELPER
// ============================================================

function getQueryParam(name) {
    return new URLSearchParams(
        window.location.search
    ).get(name);
}


// ============================================================
// CRUD - READ
// ============================================================

async function getAllBlogs() {
    const data = await blogApiRequest(
        "/api/blogs"
    );

    return data.blogs || [];
}


async function getBlogById(id) {
    const data = await blogApiRequest(
        `/api/blogs/${encodeURIComponent(id)}`
    );

    return data.blog;
}


// ============================================================
// CLIENT-SIDE SEARCH / FILTER / SORT
// ============================================================

function filterAndSortBlogs(blogs, filters) {
    let results = [...blogs];

    const search =
        String(filters.search || "")
            .trim()
            .toLowerCase();

    const category =
        String(filters.category || "")
            .trim()
            .toLowerCase();

    const tag =
        String(filters.tag || "")
            .trim()
            .toLowerCase();

    const author =
        String(filters.author || "")
            .trim()
            .toLowerCase();

    const date =
        String(filters.date || "").trim();

    const sort =
        filters.sort || "newest";


    // --------------------------------------------------------
    // SEARCH
    // Searches title, author, tags, summary and content.
    // --------------------------------------------------------

    if (search) {
        results = results.filter((blog) => {
            const searchableText = [
                blog.title,
                blog.authorName,
                blog.summary,
                blog.content,
                ...(blog.tags || [])
            ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(search);
        });
    }


    // --------------------------------------------------------
    // CATEGORY FILTER
    // --------------------------------------------------------

    if (category) {
        results = results.filter(
            (blog) =>
                String(blog.category || "")
                    .toLowerCase() === category
        );
    }


    // --------------------------------------------------------
    // TAG FILTER
    // --------------------------------------------------------

    if (tag) {
        results = results.filter((blog) =>
            (blog.tags || []).some(
                (item) =>
                    String(item)
                        .toLowerCase() === tag
            )
        );
    }


    // --------------------------------------------------------
    // AUTHOR FILTER
    // --------------------------------------------------------

    if (author) {
        results = results.filter((blog) =>
            String(blog.authorName || "")
                .toLowerCase()
                .includes(author)
        );
    }


    // --------------------------------------------------------
    // DATE FILTER
    // --------------------------------------------------------

    if (date) {
        results = results.filter(
            (blog) => blog.dateAdded === date
        );
    }


    // --------------------------------------------------------
    // SORT
    // --------------------------------------------------------

    if (sort === "oldest") {
        results.sort(
            (a, b) =>
                new Date(a.dateAdded) -
                new Date(b.dateAdded)
        );
    }

    else if (sort === "title_asc") {
        results.sort((a, b) =>
            String(a.title || "")
                .localeCompare(
                    String(b.title || "")
                )
        );
    }

    else if (sort === "title_desc") {
        results.sort((a, b) =>
            String(b.title || "")
                .localeCompare(
                    String(a.title || "")
                )
        );
    }

    else {
        // Default = newest first
        results.sort(
            (a, b) =>
                new Date(b.dateAdded) -
                new Date(a.dateAdded)
        );
    }


    return results;
}


// ============================================================
// RENDER BLOG LIST
// ============================================================

function renderBlogList(blogs) {
    const container =
        document.getElementById("blog-results");

    const countElement =
        document.getElementById("blog-result-count");


    if (!container) {
        return;
    }


    if (countElement) {
        countElement.textContent =
            `${blogs.length} post${blogs.length === 1 ? "" : "s"} found`;
    }


    if (blogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <h3>No blog posts found</h3>
                <p>
                    Try changing your search,
                    filter or sort options.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML = blogs
        .map((blog) => {
            const tags = (blog.tags || [])
                .map(
                    (tag) => `
                        <span class="tag-static">
                            ${escapeHtml(tag)}
                        </span>
                    `
                )
                .join("");


            return `
                <article class="card blog-post-card">

                    <img
                        class="post-thumbnail"
                        src="${escapeHtml(blog.image || "")}"
                        alt="${escapeHtml(blog.title)}"
                    >

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
                                ${escapeHtml(
                                    blog.authorName || "Unknown"
                                )}
                            </strong>

                            ·
                            ${escapeHtml(blog.dateAdded)}

                        </p>


                        <div class="post-actions">

                            <a
                                href="blog-detail.html?id=${encodeURIComponent(blog.id)}"
                                class="btn btn-primary btn-sm"
                            >
                                Read full post
                            </a>


                            <a
                                href="blog-edit.html?id=${encodeURIComponent(blog.id)}"
                                class="btn btn-secondary btn-sm"
                            >
                                Edit
                            </a>

                        </div>

                    </div>

                </article>
            `;
        })
        .join("");
}


// ============================================================
// BLOG LIST PAGE
// ============================================================

async function initBlogList() {
    const filterForm =
        document.getElementById(
            "blog-filter-form"
        );

    const searchInput =
        document.getElementById(
            "search-query"
        );

    const categorySelect =
        document.getElementById(
            "filter-category"
        );

    const tagSelect =
        document.getElementById(
            "filter-tag"
        );

    const authorInput =
        document.getElementById(
            "filter-author"
        );

    const dateInput =
        document.getElementById(
            "filter-date"
        );

    const sortSelect =
        document.getElementById(
            "sort-blog"
        );


    if (!filterForm) {
        return;
    }


    let allBlogs = [];


    try {
        allBlogs = await getAllBlogs();
    } catch (error) {
        console.error(error);

        const container =
            document.getElementById(
                "blog-results"
            );

        if (container) {
            container.innerHTML = `
                <div class="card">
                    <p class="field-error">
                        Unable to load blog posts.
                    </p>
                </div>
            `;
        }

        return;
    }


    function applyClientFilters() {

        const filters = {
            search:
                searchInput?.value || "",

            category:
                categorySelect?.value || "",

            tag:
                tagSelect?.value || "",

            author:
                authorInput?.value || "",

            date:
                dateInput?.value || "",

            sort:
                sortSelect?.value || "newest"
        };


        const filtered =
            filterAndSortBlogs(
                allBlogs,
                filters
            );


        renderBlogList(filtered);
    }


    // --------------------------------------------------------
    // Prevent normal GET form submission.
    // Filtering happens directly in the browser.
    // --------------------------------------------------------

    filterForm.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();
            applyClientFilters();
        }
    );


    // --------------------------------------------------------
    // Instant search / filtering / sorting.
    // --------------------------------------------------------

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

            element.addEventListener(
                "input",
                applyClientFilters
            );

            element.addEventListener(
                "change",
                applyClientFilters
            );
        });


    // --------------------------------------------------------
    // Popular tag links.
    // --------------------------------------------------------

    document
        .querySelectorAll(
            ".tag-list a[data-blog-tag]"
        )
        .forEach((link) => {

            link.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    const tag =
                        link.dataset.blogTag;

                    if (tagSelect) {
                        tagSelect.value =
                            tag;
                    }

                    applyClientFilters();
                }
            );
        });


    // Initial render.
    applyClientFilters();
}


// ============================================================
// CLIENT-SIDE FORM VALIDATION
// ============================================================

function showFieldError(
    input,
    message
) {
    if (!input) {
        return;
    }


    input.classList.add(
        "input-error"
    );


    const errorId =
        `${input.id}-error`;


    let errorElement =
        document.getElementById(errorId);


    if (!errorElement) {

        errorElement =
            document.createElement("p");

        errorElement.id =
            errorId;

        errorElement.className =
            "field-error";

        input.parentElement.appendChild(
            errorElement
        );
    }


    errorElement.textContent =
        message;
}


function clearFieldError(input) {
    if (!input) {
        return;
    }


    input.classList.remove(
        "input-error"
    );


    const errorElement =
        document.getElementById(
            `${input.id}-error`
        );


    if (errorElement) {
        errorElement.textContent = "";
    }
}


function validateBlogForm(form) {
    let valid = true;


    const title =
        form.elements.title;

    const date =
        form.elements.date;

    const category =
        form.elements.category;

    const summary =
        form.elements.summary;

    const content =
        form.elements.content;

    const image =
        form.elements.image;


    // Title
    if (!title.value.trim()) {

        showFieldError(
            title,
            "Title is required."
        );

        valid = false;

    } else if (
        title.value.trim().length < 5
    ) {

        showFieldError(
            title,
            "Title must be at least 5 characters."
        );

        valid = false;

    } else {

        clearFieldError(title);
    }


    // Date
    if (!date.value) {

        showFieldError(
            date,
            "Date is required."
        );

        valid = false;

    } else {

        clearFieldError(date);
    }


    // Category
    if (!category.value) {

        showFieldError(
            category,
            "Please select a category."
        );

        valid = false;

    } else {

        clearFieldError(category);
    }


    // Summary
    if (!summary.value.trim()) {

        showFieldError(
            summary,
            "Summary is required."
        );

        valid = false;

    } else if (
        summary.value.trim().length < 20
    ) {

        showFieldError(
            summary,
            "Summary must be at least 20 characters."
        );

        valid = false;

    } else {

        clearFieldError(summary);
    }


    // Content
    if (!content.value.trim()) {

        showFieldError(
            content,
            "Content is required."
        );

        valid = false;

    } else if (
        content.value.trim().length < 50
    ) {

        showFieldError(
            content,
            "Content must be at least 50 characters."
        );

        valid = false;

    } else {

        clearFieldError(content);
    }


    // Image is optional.
    // If provided, validate URL.

    if (image.value.trim()) {

        try {
            new URL(image.value.trim());
            clearFieldError(image);

        } catch (_error) {

            showFieldError(
                image,
                "Please enter a valid image URL."
            );

            valid = false;
        }
    }


    return valid;
}


// ============================================================
// IMMEDIATE / LIVE VALIDATION
// ============================================================

function setupLiveValidation(form) {

    const title =
        form.elements.title;

    const date =
        form.elements.date;

    const category =
        form.elements.category;

    const summary =
        form.elements.summary;

    const content =
        form.elements.content;

    const image =
        form.elements.image;


    title.addEventListener(
        "input",
        () => {

            if (
                title.value.trim().length >= 5
            ) {
                clearFieldError(title);
            }
        }
    );


    date.addEventListener(
        "change",
        () => {

            if (date.value) {
                clearFieldError(date);
            }
        }
    );


    category.addEventListener(
        "change",
        () => {

            if (category.value) {
                clearFieldError(category);
            }
        }
    );


    summary.addEventListener(
        "input",
        () => {

            if (
                summary.value.trim().length >= 20
            ) {
                clearFieldError(summary);
            }
        }
    );


    content.addEventListener(
        "input",
        () => {

            if (
                content.value.trim().length >= 50
            ) {
                clearFieldError(content);
            }
        }
    );


    image.addEventListener(
        "input",
        () => {

            if (!image.value.trim()) {
                clearFieldError(image);
                return;
            }

            try {
                new URL(image.value.trim());
                clearFieldError(image);
            } catch (_error) {
                // Keep the error visible.
            }
        }
    );
}


// ============================================================
// LOCAL STORAGE
// ============================================================

function getDraftKey(mode, id = "") {

    if (mode === "edit") {
        return `rshop_blog_edit_draft_${id}`;
    }

    return "rshop_blog_create_draft";
}


function getFormData(form) {

    return {
        title:
            form.elements.title?.value || "",

        date:
            form.elements.date?.value || "",

        category:
            form.elements.category?.value || "",

        tags:
            form.elements.tags?.value || "",

        image:
            form.elements.image?.value || "",

        summary:
            form.elements.summary?.value || "",

        content:
            form.elements.content?.value || ""
    };
}


function saveDraft(
    form,
    key
) {

    localStorage.setItem(
        key,
        JSON.stringify(
            getFormData(form)
        )
    );
}


function restoreDraft(
    form,
    key
) {

    const saved =
        localStorage.getItem(key);

    if (!saved) {
        return false;
    }


    try {

        const draft =
            JSON.parse(saved);


        if (form.elements.title)
            form.elements.title.value =
                draft.title || "";


        if (form.elements.date)
            form.elements.date.value =
                draft.date || "";


        if (form.elements.category)
            form.elements.category.value =
                draft.category || "";


        if (form.elements.tags)
            form.elements.tags.value =
                draft.tags || "";


        if (form.elements.image)
            form.elements.image.value =
                draft.image || "";


        if (form.elements.summary)
            form.elements.summary.value =
                draft.summary || "";


        if (form.elements.content)
            form.elements.content.value =
                draft.content || "";


        return true;

    } catch (error) {

        console.error(
            "Unable to restore Blog draft.",
            error
        );

        return false;
    }
}


function clearDraft(key) {
    localStorage.removeItem(key);
}


function bindDraftAutoSave(
    form,
    key
) {

    form.addEventListener(
        "input",
        () => {
            saveDraft(form, key);
        }
    );


    form.addEventListener(
        "change",
        () => {
            saveDraft(form, key);
        }
    );
}


// ============================================================
// CREATE BLOG
// ============================================================

async function createBlog(
    form
) {

    if (!validateBlogForm(form)) {
        return;
    }


    const tags =
        form.elements.tags.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);


    const body = {

        title:
            form.elements.title.value.trim(),

        dateAdded:
            form.elements.date.value,

        category:
            form.elements.category.value,

        tags,

        image:
            form.elements.image.value.trim(),

        summary:
            form.elements.summary.value.trim(),

        content:
            form.elements.content.value.trim()
    };


    try {

        const data =
            await blogApiRequest(
                "/api/blogs",
                {
                    method: "POST",
                    body: JSON.stringify(body)
                }
            );


        clearDraft(
            getDraftKey("create")
        );


        alert(
            "Blog post created successfully."
        );


        window.location.href =
            `blog-detail.html?id=${encodeURIComponent(
                data.blog.id
            )}`;

    } catch (error) {

        alert(error.message);
    }
}


// ============================================================
// UPDATE BLOG
// ============================================================

async function updateBlog(
    id,
    form
) {

    if (!validateBlogForm(form)) {
        return;
    }


    const tags =
        form.elements.tags.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);


    const body = {

        title:
            form.elements.title.value.trim(),

        dateAdded:
            form.elements.date.value,

        category:
            form.elements.category.value,

        tags,

        image:
            form.elements.image.value.trim(),

        summary:
            form.elements.summary.value.trim(),

        content:
            form.elements.content.value.trim()
    };


    try {

        await blogApiRequest(
            `/api/blogs/${encodeURIComponent(id)}`,
            {
                method: "PUT",
                body: JSON.stringify(body)
            }
        );


        clearDraft(
            getDraftKey("edit", id)
        );


        alert(
            "Blog post updated successfully."
        );


        window.location.href =
            `blog-detail.html?id=${encodeURIComponent(id)}`;

    } catch (error) {

        alert(error.message);
    }
}


// ============================================================
// DELETE BLOG
// ============================================================

async function deleteBlog(id) {

    const confirmed =
        window.confirm(
            "Are you sure you want to delete this blog post?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await blogApiRequest(
            `/api/blogs/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );


        clearDraft(
            getDraftKey("edit", id)
        );


        alert(
            "Blog post deleted successfully."
        );


        window.location.href =
            "blog-list.html";

    } catch (error) {

        alert(error.message);
    }
}


// ============================================================
// CREATE PAGE INITIALISATION
// ============================================================

async function initCreateBlogPage() {

    const form =
        document.getElementById(
            "blog-create-form"
        );

    if (!form) {
        return;
    }


    const draftKey =
        getDraftKey("create");


    restoreDraft(
        form,
        draftKey
    );


    bindDraftAutoSave(
        form,
        draftKey
    );


    setupLiveValidation(form);


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            await createBlog(form);
        }
    );


    form.addEventListener(
        "reset",
        () => {

            setTimeout(() => {

                clearDraft(
                    draftKey
                );

            }, 0);
        }
    );
}


// ============================================================
// EDIT PAGE INITIALISATION
// ============================================================

async function initEditBlogPage() {

    const form =
        document.getElementById(
            "blog-edit-form"
        );

    if (!form) {
        return;
    }


    const id =
        getQueryParam("id");


    if (!id) {

        alert(
            "Blog post ID is missing."
        );

        window.location.href =
            "blog-list.html";

        return;
    }


    try {

        const blog =
            await getBlogById(id);


        // ----------------------------------------------------
        // Fill form with current database data.
        // ----------------------------------------------------

        form.elements.title.value =
            blog.title || "";

        form.elements.date.value =
            blog.dateAdded || "";

        form.elements.category.value =
            blog.category || "";

        form.elements.tags.value =
            (blog.tags || []).join(", ");

        form.elements.image.value =
            blog.image || "";

        form.elements.summary.value =
            blog.summary || "";

        form.elements.content.value =
            blog.content || "";


        const draftKey =
            getDraftKey("edit", id);


        // If a draft exists, restore it over database data.
        restoreDraft(
            form,
            draftKey
        );


        bindDraftAutoSave(
            form,
            draftKey
        );


        setupLiveValidation(form);


        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                await updateBlog(
                    id,
                    form
                );
            }
        );


        const deleteButton =
            document.getElementById(
                "delete-blog-button"
            );


        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteBlog(id);
                }
            );
        }


    } catch (error) {

        alert(error.message);

        window.location.href =
            "blog-list.html";
    }
}


// ============================================================
// DETAIL PAGE INITIALISATION
// ============================================================

async function initBlogDetailPage() {

    const container =
        document.getElementById(
            "blog-detail"
        );


    if (!container) {
        return;
    }


    const id =
        getQueryParam("id");


    if (!id) {

        container.innerHTML = `
            <p class="field-error">
                Blog post ID is missing.
            </p>
        `;

        return;
    }


    try {

        const blog =
            await getBlogById(id);


        const tags =
            (blog.tags || [])
                .map(
                    (tag) => `
                        <span class="tag-static">
                            ${escapeHtml(tag)}
                        </span>
                    `
                )
                .join("");


        // Convert line breaks in the stored content
        // into paragraphs for display.

        const paragraphs =
            String(blog.content || "")
                .split(/\n+/)
                .filter(Boolean)
                .map(
                    (paragraph) =>
                        `<p>${escapeHtml(paragraph)}</p>`
                )
                .join("");


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
                    ${escapeHtml(
                        blog.authorName || "Unknown"
                    )}
                </strong>

                ·
                Published
                ${escapeHtml(blog.dateAdded)}

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


            <div class="post-content">

                ${paragraphs}

            </div>


            <div class="detail-actions">

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


                <a
                    href="blog-list.html"
                    class="btn btn-secondary"
                >
                    Back to list
                </a>

            </div>
        `;


        const deleteButton =
            document.getElementById(
                "delete-detail-button"
            );


        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteBlog(
                        blog.id
                    );
                }
            );
        }


    } catch (error) {

        container.innerHTML = `
            <p class="field-error">
                ${escapeHtml(error.message)}
            </p>
        `;
    }
}


// ============================================================
// PAGE BOOTSTRAP
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initBlogList();

        initCreateBlogPage();

        initEditBlogPage();

        initBlogDetailPage();
    }
);