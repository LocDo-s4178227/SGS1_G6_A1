/* =====================================================
   RSHOP - REVIEW & RATING PAGE
   Front-end prototype with:
   - live validation
   - create / edit / delete
   - list + detail modal
   - search / filter / sort
   - localStorage persistence
   - review draft persistence
   - current-user ownership behaviour
===================================================== */


/* =====================================================
   STORAGE KEYS
===================================================== */

const REVIEW_STORAGE_KEY = "rshop.reviews.v3";
const DRAFT_STORAGE_KEY = "rshop.reviewDraft.v3";
const FILTER_STORAGE_KEY = "rshop.reviewFilters.v3";


/* =====================================================
   CURRENT USER
===================================================== */

function getSharedCurrentUser() {
    try {
        const stored = JSON.parse(localStorage.getItem("user") || "null");
        const id = localStorage.getItem("userId") || stored?.id || stored?._id;
        if (!id) return null;
        const name = stored?.firstName && stored?.lastName
            ? `${stored.firstName} ${stored.lastName}`
            : (stored?.username || stored?.email || "Signed-in user");
        return { id, name };
    } catch (_error) {
        return null;
    }
}

let currentUser = getSharedCurrentUser() || { id: null, name: "Guest" };


/* =====================================================
   DEFAULT IMAGE
===================================================== */

const DEFAULT_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop stop-color="#263434"/>
                    <stop offset="1" stop-color="#77b3f8"/>
                </linearGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#g)"/>

            <text
                x="50%"
                y="48%"
                dominant-baseline="middle"
                text-anchor="middle"
                fill="white"
                font-family="Arial"
                font-size="58"
                font-weight="700"
            >
                RShop
            </text>

            <text
                x="50%"
                y="60%"
                dominant-baseline="middle"
                text-anchor="middle"
                fill="#dce8f2"
                font-family="Arial"
                font-size="25"
            >
                Product Review
            </text>
        </svg>
    `);


/* =====================================================
   SAMPLE REVIEWS
===================================================== */

const sampleReviews = [
    {
        id: 1,
        title: "Excellent everyday keyboard",
        product: "Compact Mechanical Keyboard",
        category: "Technology",
        rating: 5,
        summary:
            "Responsive switches, solid build quality and a compact layout that works well for both study and gaming.",
        description:
            "I have used this keyboard every day for several weeks. The keys feel responsive, the frame feels sturdy and the compact layout saves a lot of desk space. It is particularly comfortable for long study sessions and gaming. The only small downside is that the keycaps can feel slightly smooth after long use, but overall the product offers excellent value.",
        reviewerId: 1,
        reviewerName: "Alex Nguyen",
        dateAdded: "2026-07-18T08:30:00.000Z",
        image:
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80"
    },

    {
        id: 2,
        title: "Comfortable chair for long sessions",
        product: "Ergonomic Study Chair",
        category: "Home",
        rating: 4,
        summary:
            "Supportive and comfortable with useful adjustments, although assembly takes a little time.",
        description:
            "The chair provides very good back support and the adjustable height makes it easy to set up for different desks. The seat remains comfortable during long study sessions. Assembly was not difficult, but the instructions could have been clearer. I would still recommend it to students or anyone who spends several hours at a desk.",
        reviewerId: 2,
        reviewerName: "Linh Tran",
        dateAdded: "2026-07-13T14:15:00.000Z",
        image:
            "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=80"
    },

    {
        id: 3,
        title: "Simple, fast and useful for class",
        product: "Digital Study Planner",
        category: "Education",
        rating: 5,
        summary:
            "A clean planner that makes weekly tasks easier to organise without unnecessary complexity.",
        description:
            "The study planner is very easy to understand and does not overload the user with too many features. I mainly use it to organise assignment deadlines and weekly study goals. The interface is clean and the product does exactly what I need. It would be even better with more colour options, but the core experience is excellent.",
        reviewerId: 3,
        reviewerName: "Minh Pham",
        dateAdded: "2026-07-09T10:20:00.000Z",
        image:
            "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=900&q=80"
    },

    {
        id: 4,
        title: "Good value for a small workspace",
        product: "Minimal Desk Lamp",
        category: "Lifestyle",
        rating: 4,
        summary:
            "Bright enough for late-night work, easy to position and takes up very little desk space.",
        description:
            "This lamp is a good option for a small desk because the base does not take up much room. The brightness is sufficient for reading and coding at night, and the adjustable arm makes it easy to direct the light. The materials are not premium, but they feel reasonable for the price.",
        reviewerId: 1,
        reviewerName: "Alex Nguyen",
        dateAdded: "2026-07-03T18:45:00.000Z",
        image:
            "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80"
    }
];


/* =====================================================
   STATE
===================================================== */

let reviews = loadReviews();

let selectedRating = 0;

let selectedReviewId = null;


/* =====================================================
   DOM
===================================================== */

const elements = {
    reviewContainer:
        document.getElementById("reviewContainer"),

    emptyState:
        document.getElementById("emptyState"),

    resultCount:
        document.getElementById("resultCount"),

    searchInput:
        document.getElementById("searchInput"),

    categoryFilter:
        document.getElementById("categoryFilter"),

    ratingFilter:
        document.getElementById("ratingFilter"),

    sortFilter:
        document.getElementById("sortFilter"),

    clearFiltersButton:
        document.getElementById("clearFiltersButton"),

    averageRating:
        document.getElementById("averageRating"),

    averageStars:
        document.getElementById("averageStars"),

    totalReviewText:
        document.getElementById("totalReviewText"),

    ratingBars:
        document.getElementById("ratingBars"),

    reviewForm:
        document.getElementById("reviewForm"),

    reviewId:
        document.getElementById("reviewId"),

    reviewTitle:
        document.getElementById("reviewTitle"),

    productName:
        document.getElementById("productName"),

    reviewCategory:
        document.getElementById("reviewCategory"),

    reviewRating:
        document.getElementById("reviewRating"),

    starInput:
        document.getElementById("starInput"),

    ratingText:
        document.getElementById("ratingText"),

    imageUrl:
        document.getElementById("imageUrl"),

    imagePreviewWrap:
        document.getElementById("imagePreviewWrap"),

    imagePreview:
        document.getElementById("imagePreview"),

    summary:
        document.getElementById("summary"),

    description:
        document.getElementById("description"),

    titleCount:
        document.getElementById("titleCount"),

    summaryCount:
        document.getElementById("summaryCount"),

    descriptionCount:
        document.getElementById("descriptionCount"),

    submitButton:
        document.getElementById("submitButton"),

    cancelEditButton:
        document.getElementById("cancelEditButton"),

    formMessage:
        document.getElementById("formMessage"),

    formHeading:
        document.getElementById("formHeading"),

    heroWriteButton:
        document.getElementById("heroWriteButton"),

    reviewModal:
        document.getElementById("reviewModal"),

    closeModalButton:
        document.getElementById("closeModalButton"),

    modalImage:
        document.getElementById("modalImage"),

    modalCategory:
        document.getElementById("modalCategory"),

    modalStars:
        document.getElementById("modalStars"),

    modalTitle:
        document.getElementById("modalTitle"),

    modalProduct:
        document.getElementById("modalProduct"),

    modalDescription:
        document.getElementById("modalDescription"),

    modalAvatar:
        document.getElementById("modalAvatar"),

    modalReviewer:
        document.getElementById("modalReviewer"),

    modalDate:
        document.getElementById("modalDate"),

    modalActions:
        document.getElementById("modalActions"),

    toast:
        document.getElementById("toast"),

    currentUserName:
        document.getElementById("currentUserName"),

    userAvatar:
        document.getElementById("userAvatar")
};


const errors = {
    title:
        document.getElementById("titleError"),

    product:
        document.getElementById("productError"),

    category:
        document.getElementById("categoryError"),

    rating:
        document.getElementById("ratingError"),

    image:
        document.getElementById("imageError"),

    summary:
        document.getElementById("summaryError"),

    description:
        document.getElementById("descriptionError")
};


/* =====================================================
   STORAGE
===================================================== */

function loadReviews() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    REVIEW_STORAGE_KEY
                )
            );


        if (
            Array.isArray(saved)
        ) {
            return saved;
        }

    } catch (error) {

        console.warn(
            "Could not read saved reviews.",
            error
        );
    }


    localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify(sampleReviews)
    );


    return structuredClone(sampleReviews);
}


function saveReviews() {

    localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify(reviews)
    );
}

async function loadReviewsFromApi() {
    try {
        const response = await fetch("http://localhost:5000/api/reviews");
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.reviews)) {
            reviews = payload.reviews;
            saveReviews();
            renderReviews();
        }
    } catch (_error) {
        // Keep the cached localStorage reviews available when the API is offline.
    }
}

function getCurrentUserHeaders() {
    return currentUser.id ? { "x-user-id": String(currentUser.id) } : {};
}


function saveDraft() {

    const draft = {
        title:
            elements.reviewTitle.value,

        product:
            elements.productName.value,

        category:
            elements.reviewCategory.value,

        rating:
            selectedRating,

        image:
            elements.imageUrl.value,

        summary:
            elements.summary.value,

        description:
            elements.description.value
    };


    localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify(draft)
    );
}


function restoreDraft() {

    const saved =
        localStorage.getItem(
            DRAFT_STORAGE_KEY
        );


    if (!saved) {
        return;
    }


    try {

        const draft =
            JSON.parse(saved);


        elements.reviewTitle.value =
            draft.title || "";

        elements.productName.value =
            draft.product || "";

        elements.reviewCategory.value =
            draft.category || "";

        elements.imageUrl.value =
            draft.image || "";

        elements.summary.value =
            draft.summary || "";

        elements.description.value =
            draft.description || "";


        setRating(
            Number(draft.rating) || 0
        );


        updateCounters();

        updateImagePreview();

    } catch (error) {

        localStorage.removeItem(
            DRAFT_STORAGE_KEY
        );
    }
}


function clearDraft() {

    localStorage.removeItem(
        DRAFT_STORAGE_KEY
    );
}


function saveFilterState() {

    const state = {
        search:
            elements.searchInput.value,

        category:
            elements.categoryFilter.value,

        rating:
            elements.ratingFilter.value,

        sort:
            elements.sortFilter.value
    };


    localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify(state)
    );
}


function restoreFilterState() {

    const saved =
        localStorage.getItem(
            FILTER_STORAGE_KEY
        );


    if (!saved) {
        return;
    }


    try {

        const state =
            JSON.parse(saved);


        elements.searchInput.value =
            state.search || "";

        elements.categoryFilter.value =
            state.category || "all";

        elements.ratingFilter.value =
            state.rating || "all";

        elements.sortFilter.value =
            state.sort || "newest";

    } catch (error) {

        localStorage.removeItem(
            FILTER_STORAGE_KEY
        );
    }
}


/* =====================================================
   HELPERS
===================================================== */

function createStars(rating) {

    return (
        "★".repeat(rating) +
        "☆".repeat(5 - rating)
    );
}


function getInitials(name) {

    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(
            (part) =>
                part[0].toUpperCase()
        )
        .join("");
}


function formatDate(value) {

    return new Date(value)
        .toLocaleDateString(
            "en-GB",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function safeImage(value) {

    return value || DEFAULT_IMAGE;
}


function showToast(message) {

    elements.toast.textContent =
        message;

    elements.toast.hidden =
        false;


    clearTimeout(
        showToast.timeoutId
    );


    showToast.timeoutId =
        setTimeout(
            function () {

                elements.toast.hidden =
                    true;

            },
            2800
        );
}


function setFormMessage(
    message = "",
    type = ""
) {

    elements.formMessage.textContent =
        message;


    elements.formMessage.className =
        `form-message full ${type}`.trim();
}


/* =====================================================
   REVIEW STATISTICS
===================================================== */

function renderStatistics() {

    const total =
        reviews.length;


    const average =
        total
            ? reviews.reduce(
                (sum, review) =>
                    sum + review.rating,
                0
            ) / total
            : 0;


    elements.averageRating.textContent =
        average.toFixed(1);


    elements.averageStars.textContent =
        createStars(
            Math.round(average)
        );


    elements.totalReviewText.textContent =
        `Based on ${total} review${
            total === 1
                ? ""
                : "s"
        }`;


    elements.ratingBars.innerHTML =
        [5, 4, 3, 2, 1]
            .map(
                function (rating) {

                    const count =
                        reviews.filter(
                            (review) =>
                                review.rating === rating
                        ).length;


                    const percentage =
                        total
                            ? (
                                count /
                                total
                            ) * 100
                            : 0;


                    return `
                        <div class="rating-bar-row">

                            <span>
                                ${rating}
                            </span>

                            <div class="rating-track">
                                <div
                                    class="rating-fill"
                                    style="width: ${percentage}%"
                                ></div>
                            </div>

                            <span>
                                ${count}
                            </span>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =====================================================
   SEARCH / FILTER / SORT
===================================================== */

function getVisibleReviews() {

    const search =
        elements.searchInput
            .value
            .trim()
            .toLowerCase();


    const category =
        elements.categoryFilter.value;


    const minimumRating =
        elements.ratingFilter.value;


    const sort =
        elements.sortFilter.value;


    const filtered =
        reviews.filter(
            function (review) {

                const searchable =
                    [
                        review.title,
                        review.product,
                        review.category,
                        review.summary,
                        review.description,
                        review.reviewerName
                    ]
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    searchable.includes(
                        search
                    );


                const matchesCategory =
                    category === "all" ||
                    review.category === category;


                const matchesRating =
                    minimumRating === "all" ||
                    review.rating >=
                        Number(minimumRating);


                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesRating
                );
            }
        );


    filtered.sort(
        function (a, b) {

            if (sort === "oldest") {
                return (
                    new Date(a.dateAdded) -
                    new Date(b.dateAdded)
                );
            }


            if (sort === "highest") {
                return (
                    b.rating -
                    a.rating
                );
            }


            if (sort === "lowest") {
                return (
                    a.rating -
                    b.rating
                );
            }


            if (sort === "az") {
                return a.product.localeCompare(
                    b.product
                );
            }


            return (
                new Date(b.dateAdded) -
                new Date(a.dateAdded)
            );
        }
    );


    return filtered;
}


/* =====================================================
   RENDER REVIEW CARDS
===================================================== */

function renderReviews() {

    const visible =
        getVisibleReviews();


    elements.resultCount.textContent =
        `${visible.length} review${
            visible.length === 1
                ? ""
                : "s"
        } found`;


    elements.emptyState.hidden =
        visible.length !== 0;


    elements.reviewContainer.innerHTML =
        visible
            .map(
                createReviewCard
            )
            .join("");


    renderStatistics();
}


function createReviewCard(review) {

    const isOwner =
        review.reviewerId ===
        currentUser.id;


    const image =
        safeImage(
            review.image
        );


    return `
        <article class="review-card">

            <div class="review-card-image">

                <img
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(review.product)}"
                    onerror="this.src='${escapeHtml(DEFAULT_IMAGE)}'"
                >

            </div>


            <div class="review-card-body">

                <div class="review-card-topline">

                    <span class="category-badge">
                        ${escapeHtml(review.category)}
                    </span>

                    <span
                        class="stars"
                        aria-label="${review.rating} out of 5 stars"
                    >
                        ${createStars(review.rating)}
                    </span>

                </div>


                <h3>
                    ${escapeHtml(review.title)}
                </h3>


                <p class="product-title">
                    ${escapeHtml(review.product)}
                </p>


                <p class="review-card-summary">
                    ${escapeHtml(review.summary)}
                </p>


                <div class="review-author">

                    <span class="avatar">
                        ${getInitials(review.reviewerName)}
                    </span>


                    <span>

                        <strong>
                            ${escapeHtml(review.reviewerName)}
                        </strong>

                        <small>
                            ${formatDate(review.dateAdded)}
                        </small>

                    </span>


                    ${
                        isOwner
                            ? `
                                <span class="owner-badge">
                                    Your review
                                </span>
                            `
                            : ""
                    }

                </div>


                <div class="review-card-actions">

                    <button
                        type="button"
                        class="card-action"
                        data-action="view"
                        data-id="${review.id}"
                    >
                        View Details
                    </button>


                    ${
                        isOwner
                            ? `
                                <button
                                    type="button"
                                    class="card-action"
                                    data-action="edit"
                                    data-id="${review.id}"
                                >
                                    Edit
                                </button>


                                <button
                                    type="button"
                                    class="card-action danger"
                                    data-action="delete"
                                    data-id="${review.id}"
                                >
                                    Delete
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>

        </article>
    `;
}


/* =====================================================
   DETAIL MODAL
===================================================== */

function openReviewModal(review) {

    selectedReviewId =
        review.id;


    elements.modalImage.src =
        safeImage(
            review.image
        );


    elements.modalImage.onerror =
        function () {

            this.src =
                DEFAULT_IMAGE;
        };


    elements.modalCategory.textContent =
        review.category;


    elements.modalStars.textContent =
        createStars(
            review.rating
        );


    elements.modalTitle.textContent =
        review.title;


    elements.modalProduct.textContent =
        review.product;


    elements.modalDescription.textContent =
        review.description;


    elements.modalAvatar.textContent =
        getInitials(
            review.reviewerName
        );


    elements.modalReviewer.textContent =
        review.reviewerName;


    elements.modalDate.textContent =
        formatDate(
            review.dateAdded
        );


    const isOwner =
        review.reviewerId ===
        currentUser.id;


    elements.modalActions.innerHTML =
        isOwner
            ? `
                <button
                    type="button"
                    class="btn btn-primary"
                    data-modal-action="edit"
                >
                    Edit Review
                </button>

                <button
                    type="button"
                    class="btn btn-secondary"
                    data-modal-action="delete"
                >
                    Delete Review
                </button>
            `
            : "";


    elements.reviewModal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    elements.closeModalButton.focus();
}


function closeReviewModal() {

    elements.reviewModal.hidden =
        true;


    document.body.style.overflow =
        "";


    selectedReviewId =
        null;
}


/* =====================================================
   RATING INPUT
===================================================== */

function setRating(value) {

    selectedRating =
        Number(value) || 0;


    elements.reviewRating.value =
        selectedRating || "";


    const buttons =
        elements.starInput
            .querySelectorAll("button");


    buttons.forEach(
        function (button) {

            const buttonValue =
                Number(
                    button.dataset.value
                );


            button.classList.toggle(
                "active",
                buttonValue <=
                    selectedRating
            );
        }
    );


    const ratingLabels = {
        1: "Poor",
        2: "Fair",
        3: "Good",
        4: "Very good",
        5: "Excellent"
    };


    elements.ratingText.textContent =
        selectedRating
            ? `${selectedRating}/5 · ${ratingLabels[selectedRating]}`
            : "Select a rating";


    validateRating();
}


/* =====================================================
   VALIDATION
===================================================== */

function validateTitle() {

    const value =
        elements.reviewTitle
            .value
            .trim();


    let message = "";


    if (!value) {
        message =
            "Review title is required.";
    } else if (
        value.length < 3
    ) {
        message =
            "Use at least 3 characters.";
    } else if (
        value.length > 80
    ) {
        message =
            "Use 80 characters or fewer.";
    }


    return applyValidation(
        elements.reviewTitle,
        errors.title,
        message
    );
}


function validateProduct() {

    const value =
        elements.productName
            .value
            .trim();


    let message = "";


    if (!value) {
        message =
            "Product name is required.";
    } else if (
        value.length < 2
    ) {
        message =
            "Use at least 2 characters.";
    }


    return applyValidation(
        elements.productName,
        errors.product,
        message
    );
}


function validateCategory() {

    const valid =
        [
            "Technology",
            "Education",
            "Shopping",
            "Home",
            "Lifestyle"
        ]
            .includes(
                elements.reviewCategory.value
            );


    return applyValidation(
        elements.reviewCategory,
        errors.category,
        valid
            ? ""
            : "Please choose a category."
    );
}


function validateRating() {

    const valid =
        selectedRating >= 1 &&
        selectedRating <= 5;


    errors.rating.textContent =
        valid
            ? ""
            : "Please choose a star rating.";


    elements.starInput.classList.toggle(
        "invalid",
        !valid
    );


    return valid;
}


function validateImage() {

    const value =
        elements.imageUrl
            .value
            .trim();


    let message = "";


    if (value) {

        try {

            const url =
                new URL(value);


            if (
                ![
                    "http:",
                    "https:"
                ].includes(
                    url.protocol
                )
            ) {
                message =
                    "Use an http:// or https:// URL.";
            }

        } catch (error) {

            message =
                "Please enter a valid image URL.";
        }
    }


    return applyValidation(
        elements.imageUrl,
        errors.image,
        message
    );
}


function validateSummary() {

    const value =
        elements.summary
            .value
            .trim();


    let message = "";


    if (!value) {
        message =
            "Short summary is required.";
    } else if (
        value.length < 10
    ) {
        message =
            "Use at least 10 characters.";
    } else if (
        value.length > 200
    ) {
        message =
            "Use 200 characters or fewer.";
    }


    return applyValidation(
        elements.summary,
        errors.summary,
        message
    );
}


function validateDescription() {

    const value =
        elements.description
            .value
            .trim();


    let message = "";


    if (!value) {
        message =
            "Full review is required.";
    } else if (
        value.length < 20
    ) {
        message =
            "Use at least 20 characters.";
    } else if (
        value.length > 2000
    ) {
        message =
            "Use 2000 characters or fewer.";
    }


    return applyValidation(
        elements.description,
        errors.description,
        message
    );
}


function applyValidation(
    input,
    errorElement,
    message
) {

    errorElement.textContent =
        message;


    input.classList.toggle(
        "invalid",
        Boolean(message)
    );


    input.classList.toggle(
        "valid",
        !message &&
        input.value.trim() !== ""
    );


    return !message;
}


function validateForm() {

    return [
        validateTitle(),
        validateProduct(),
        validateCategory(),
        validateRating(),
        validateImage(),
        validateSummary(),
        validateDescription()
    ]
        .every(Boolean);
}


/* =====================================================
   FORM / COUNTERS / IMAGE PREVIEW
===================================================== */

function updateCounters() {

    elements.titleCount.textContent =
        elements.reviewTitle
            .value
            .length;


    elements.summaryCount.textContent =
        elements.summary
            .value
            .length;


    elements.descriptionCount.textContent =
        elements.description
            .value
            .length;
}


function updateImagePreview() {

    const url =
        elements.imageUrl
            .value
            .trim();


    if (!url) {

        elements.imagePreviewWrap.hidden =
            true;

        return;
    }


    if (!validateImage()) {

        elements.imagePreviewWrap.hidden =
            true;

        return;
    }


    elements.imagePreviewWrap.hidden =
        false;


    elements.imagePreview.src =
        url;


    elements.imagePreview.onerror =
        function () {

            elements.imagePreview.src =
                DEFAULT_IMAGE;
        };
}


function getFormData() {

    return {
        title:
            elements.reviewTitle
                .value
                .trim(),

        product:
            elements.productName
                .value
                .trim(),

        category:
            elements.reviewCategory.value,

        rating:
            selectedRating,

        image:
            elements.imageUrl
                .value
                .trim(),

        summary:
            elements.summary
                .value
                .trim(),

        description:
            elements.description
                .value
                .trim()
    };
}


function resetForm() {

    elements.reviewForm.reset();


    elements.reviewId.value =
        "";


    setRating(0);


    elements.submitButton.textContent =
        "Publish Review";


    elements.cancelEditButton.hidden =
        true;


    elements.formHeading.textContent =
        "Write a Product Review";


    Object
        .values(errors)
        .forEach(
            (element) =>
                element.textContent = ""
        );


    elements.reviewForm
        .querySelectorAll(
            ".valid, .invalid"
        )
        .forEach(
            function (element) {

                element.classList.remove(
                    "valid",
                    "invalid"
                );
            }
        );


    elements.imagePreviewWrap.hidden =
        true;


    updateCounters();

    clearDraft();
}


/* =====================================================
   CREATE / EDIT
===================================================== */

function saveReview(event) {

    event.preventDefault();

    if (!currentUser.id) {
        setFormMessage("Please sign in before publishing a review.", "error");
        return;
    }


    if (!validateForm()) {

        setFormMessage(
            "Please correct the highlighted fields before publishing.",
            "error"
        );


        const firstInvalid =
            elements.reviewForm
                .querySelector(
                    ".invalid"
                );


        if (firstInvalid) {
            firstInvalid.focus();
        }


        return;
    }


    const formData =
        getFormData();


    const editId = elements.reviewId.value.trim();


    if (editId) {

        fetch(`http://localhost:5000/api/reviews/${encodeURIComponent(editId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getCurrentUserHeaders() },
            body: JSON.stringify(formData)
        }).then(async (response) => {
            if (!response.ok) throw new Error((await response.json()).message || "Unable to update review");
            const payload = await response.json();
            reviews = reviews.map((review) => String(review.id) === String(editId) ? payload.review : review);
            saveReviews();
            resetForm();
            renderReviews();
            showToast("Review updated successfully.");
        }).catch((error) => setFormMessage(error.message, "error"));
        return;

    } else {

        fetch("http://localhost:5000/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getCurrentUserHeaders() },
            body: JSON.stringify(formData)
        }).then(async (response) => {
            if (!response.ok) throw new Error((await response.json()).message || "Unable to publish review");
            const payload = await response.json();
            reviews.unshift(payload.review);
            saveReviews();
            resetForm();
            renderReviews();
            showToast("Your review has been published.");
        }).catch((error) => setFormMessage(error.message, "error"));
        return;
    }


    document
        .getElementById(
            "review-list"
        )
        .scrollIntoView({
            behavior: "smooth"
        });
}


function editReview(reviewId) {

    const review =
        reviews.find(
            (item) =>
                item.id === reviewId
        );


    if (
        !review ||
        review.reviewerId !==
            currentUser.id
    ) {
        return;
    }


    closeReviewModal();


    elements.reviewId.value =
        review.id;


    elements.reviewTitle.value =
        review.title;


    elements.productName.value =
        review.product;


    elements.reviewCategory.value =
        review.category;


    elements.imageUrl.value =
        review.image || "";


    elements.summary.value =
        review.summary;


    elements.description.value =
        review.description;


    setRating(
        review.rating
    );


    elements.submitButton.textContent =
        "Save Changes";


    elements.cancelEditButton.hidden =
        false;


    elements.formHeading.textContent =
        "Edit Your Review";


    updateCounters();

    updateImagePreview();

    saveDraft();


    document
        .getElementById(
            "write-review"
        )
        .scrollIntoView({
            behavior: "smooth"
        });


    elements.reviewTitle.focus();
}


/* =====================================================
   DELETE
===================================================== */

function deleteReview(reviewId) {

    const review =
        reviews.find(
            (item) =>
                item.id === reviewId
        );


    const isLegacyLocalReview = review && typeof review.id === "number";

    if (
        !review ||
        (!isLegacyLocalReview && review.reviewerId !== currentUser.id)
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            `Delete your review "${review.title}"? This action cannot be undone.`
        );


    if (!confirmed) {
        return;
    }

    if (!currentUser.id) {
        showToast("Please sign in before deleting a review.");
        return;
    }

    fetch(`http://localhost:5000/api/reviews/${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
        headers: getCurrentUserHeaders()
    }).then(async (response) => {
        if (!response.ok && response.status !== 404) {
            throw new Error((await response.json()).message || "Unable to delete review");
        }
        reviews = reviews.filter((item) => String(item.id) !== String(reviewId));
        saveReviews();
        renderReviews();
        closeReviewModal();
        showToast("Review deleted.");
    }).catch((error) => {
        if (isLegacyLocalReview) {
            reviews = reviews.filter((item) => String(item.id) !== String(reviewId));
            saveReviews();
            renderReviews();
            closeReviewModal();
            showToast("Review deleted from the offline cache.");
            return;
        }
        showToast(error.message);
    });
    return;


    if (
        Number(
            elements.reviewId.value
        ) === reviewId
    ) {
        resetForm();
    }
}


/* =====================================================
   FILTER RESET
===================================================== */

function clearFilters() {

    elements.searchInput.value =
        "";


    elements.categoryFilter.value =
        "all";


    elements.ratingFilter.value =
        "all";


    elements.sortFilter.value =
        "newest";


    saveFilterState();

    renderReviews();
}


/* =====================================================
   EVENT LISTENERS
===================================================== */

[
    elements.searchInput,
    elements.categoryFilter,
    elements.ratingFilter,
    elements.sortFilter
]
    .forEach(
        function (control) {

            control.addEventListener(
                "input",
                function () {

                    saveFilterState();

                    renderReviews();
                }
            );


            control.addEventListener(
                "change",
                function () {

                    saveFilterState();

                    renderReviews();
                }
            );
        }
    );


elements.clearFiltersButton
    .addEventListener(
        "click",
        clearFilters
    );


elements.starInput
    .addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "button[data-value]"
                );


            if (!button) {
                return;
            }


            setRating(
                Number(
                    button.dataset.value
                )
            );


            saveDraft();
        }
    );


elements.reviewContainer
    .addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "button[data-action]"
                );


            if (!button) {
                return;
            }


            const reviewId =
                Number(
                    button.dataset.id
                );


            const review =
                reviews.find(
                    (item) =>
                        item.id === reviewId
                );


            if (!review) {
                return;
            }


            if (
                button.dataset.action ===
                "view"
            ) {
                openReviewModal(
                    review
                );
            }


            if (
                button.dataset.action ===
                "edit"
            ) {
                editReview(
                    reviewId
                );
            }


            if (
                button.dataset.action ===
                "delete"
            ) {
                deleteReview(
                    reviewId
                );
            }
        }
    );


elements.reviewForm
    .addEventListener(
        "submit",
        saveReview
    );


elements.cancelEditButton
    .addEventListener(
        "click",
        function () {

            resetForm();

            setFormMessage(
                "Editing cancelled."
            );
        }
    );


elements.heroWriteButton
    .addEventListener(
        "click",
        function () {

            document
                .getElementById(
                    "write-review"
                )
                .scrollIntoView({
                    behavior:
                        "smooth"
                });


            elements.reviewTitle.focus();
        }
    );


elements.closeModalButton
    .addEventListener(
        "click",
        closeReviewModal
    );


elements.reviewModal
    .addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                elements.reviewModal
            ) {
                closeReviewModal();
            }
        }
    );


elements.modalActions
    .addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-modal-action]"
                );


            if (!button) {
                return;
            }


            const reviewId =
                selectedReviewId;


            if (!reviewId) {
                return;
            }


            if (
                button.dataset.modalAction ===
                "edit"
            ) {
                editReview(
                    reviewId
                );
            }


            if (
                button.dataset.modalAction ===
                "delete"
            ) {
                deleteReview(
                    reviewId
                );
            }
        }
    );


document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
                "Escape" &&
            !elements.reviewModal.hidden
        ) {
            closeReviewModal();
        }
    }
);


/* =====================================================
   LIVE VALIDATION + AUTO DRAFT
===================================================== */

const liveValidationMap = [
    [
        elements.reviewTitle,
        validateTitle
    ],

    [
        elements.productName,
        validateProduct
    ],

    [
        elements.reviewCategory,
        validateCategory
    ],

    [
        elements.imageUrl,
        function () {
            validateImage();
            updateImagePreview();
        }
    ],

    [
        elements.summary,
        validateSummary
    ],

    [
        elements.description,
        validateDescription
    ]
];


liveValidationMap
    .forEach(
        function (
            [
                input,
                validator
            ]
        ) {

            input.addEventListener(
                "input",
                function () {

                    validator();

                    updateCounters();

                    saveDraft();
                }
            );


            input.addEventListener(
                "change",
                function () {

                    validator();

                    saveDraft();
                }
            );


            input.addEventListener(
                "blur",
                validator
            );
        }
    );


/* =====================================================
   INITIALIZE
===================================================== */

function initializePage() {

    elements.currentUserName.textContent =
        currentUser.name;


    elements.userAvatar.textContent =
        getInitials(
            currentUser.name
        );


    restoreFilterState();

    restoreDraft();

    renderReviews();

    loadReviewsFromApi();
}


initializePage();
