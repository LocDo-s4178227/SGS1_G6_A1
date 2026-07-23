const STORAGE_KEY = "rshopReviewsV2";

const seedReviews = [
  {
    id: 1,
    title: "A strong desk for study and work",
    product: "Ergonomic Wooden Desk",
    category: "Furniture",
    rating: 5,
    reviewer: "Minh Tran",
    date: "2026-07-18",
    image: "../images/ergonomic_wooden_desk.png",
    body:
      "The desk feels solid, has plenty of usable surface area and is comfortable for long study sessions. Assembly was straightforward and the wood finish looks more premium than expected."
  },
  {
    id: 2,
    title: "Premium case with excellent build quality",
    product: "Mechanical Keyboard Case",
    category: "Technology",
    rating: 4,
    reviewer: "Anh Le",
    date: "2026-07-15",
    image: "../images/mechanical_keyboard_case.png",
    body:
      "The case is sturdy and fits the keyboard securely. The finish is clean and professional, although it is slightly heavier than I expected for daily travel."
  },
  {
    id: 3,
    title: "Simple storage that looks great",
    product: "Wall Shelves",
    category: "Home",
    rating: 5,
    reviewer: "Linh Nguyen",
    date: "2026-07-10",
    image: "../images/shelves.png",
    body:
      "These shelves were easy to install and made the room feel much more organised. They hold books and small decorations well without taking up floor space."
  },
  {
    id: 4,
    title: "A useful service for older furniture",
    product: "Furniture Reupholstery",
    category: "Lifestyle",
    rating: 4,
    reviewer: "Bao Pham",
    date: "2026-07-05",
    image: "../images/reupholstery.png",
    body:
      "The service gave an old chair a second life and the fabric work was neat. Communication was good, but the completion time was a little longer than originally estimated."
  }
];

let reviews = loadReviews();

const elements = {
  container: document.getElementById("reviewContainer"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),

  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  ratingFilter: document.getElementById("ratingFilter"),
  sortFilter: document.getElementById("sortFilter"),

  form: document.getElementById("reviewForm"),
  reviewId: document.getElementById("reviewId"),
  reviewTitle: document.getElementById("reviewTitle"),
  productName: document.getElementById("productName"),
  reviewCategory: document.getElementById("reviewCategory"),
  reviewRating: document.getElementById("reviewRating"),
  reviewerName: document.getElementById("reviewerName"),
  reviewImage: document.getElementById("reviewImage"),
  reviewBody: document.getElementById("reviewBody"),

  characterCount: document.getElementById("characterCount"),
  formMessage: document.getElementById("formMessage"),
  submitButton: document.getElementById("submitButton"),
  cancelEdit: document.getElementById("cancelEdit"),

  reviewDialog: document.getElementById("reviewDialog"),
  dialogContent: document.getElementById("dialogContent"),
  closeDialog: document.getElementById("closeDialog"),

  averageRating: document.getElementById("averageRating"),
  reviewCount: document.getElementById("reviewCount"),
  ratingBars: document.getElementById("ratingBars")
};

/*
  Load saved reviews from localStorage.
  If no saved reviews exist, use the sample reviews.
*/
function loadReviews() {
  try {
    const savedReviews = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (Array.isArray(savedReviews) && savedReviews.length > 0) {
      return savedReviews;
    }

    return seedReviews;
  } catch (error) {
    console.error("Unable to load reviews:", error);
    return seedReviews;
  }
}

/*
  Save the current review list.
*/
function saveReviews() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(reviews)
    );
  } catch (error) {
    console.error("Unable to save reviews:", error);
  }
}

/*
  Create star text such as ★★★★☆.
*/
function createStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/*
  Escape user-created text before adding it to HTML.
*/
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
  Display dates in a readable format.
*/
function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/*
  Return reviews that match all search and filter settings.
*/
function getFilteredReviews() {
  const searchValue =
    elements.searchInput.value.trim().toLowerCase();

  const selectedCategory =
    elements.categoryFilter.value;

  const selectedRating =
    elements.ratingFilter.value;

  const filtered = reviews.filter(function (review) {
    const searchableText = `
      ${review.title}
      ${review.product}
      ${review.body}
      ${review.reviewer}
      ${review.category}
    `.toLowerCase();

    const matchesSearch =
      searchableText.includes(searchValue);

    const matchesCategory =
      selectedCategory === "all" ||
      review.category === selectedCategory;

    const matchesRating =
      selectedRating === "all" ||
      review.rating >= Number(selectedRating);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesRating
    );
  });

  return filtered.sort(function (firstReview, secondReview) {
    const selectedSort = elements.sortFilter.value;

    if (selectedSort === "highest") {
      return secondReview.rating - firstReview.rating;
    }

    if (selectedSort === "lowest") {
      return firstReview.rating - secondReview.rating;
    }

    return (
      new Date(secondReview.date) -
      new Date(firstReview.date)
    );
  });
}

/*
  Render all review cards.
*/
function renderReviews() {
  const visibleReviews = getFilteredReviews();

  elements.resultCount.textContent =
    `${visibleReviews.length} review${
      visibleReviews.length === 1 ? "" : "s"
    }`;

  elements.emptyState.hidden =
    visibleReviews.length !== 0;

  elements.container.innerHTML =
    visibleReviews
      .map(function (review) {
        const shortBody =
          review.body.length > 180
            ? `${review.body.slice(0, 180)}…`
            : review.body;

        const imagePath =
          review.image ||
          "../images/ergonomic_wooden_desk.png";

        return `
          <article class="review-card">

            <img
              class="review-image"
              src="${escapeHtml(imagePath)}"
              alt="${escapeHtml(review.product)}"
              onerror="this.src='../images/ergonomic_wooden_desk.png'"
            >

            <div class="review-content">

              <div class="review-topline">

                <span class="badge">
                  ${escapeHtml(review.category)}
                </span>

                <span
                  class="rating"
                  aria-label="${review.rating} out of 5 stars"
                >
                  ${createStars(review.rating)}
                </span>

              </div>

              <h3>
                ${escapeHtml(review.title)}
              </h3>

              <p class="product-name">
                ${escapeHtml(review.product)}
              </p>

              <p class="review-text">
                ${escapeHtml(shortBody)}
              </p>

              <div class="review-meta">

                <span>
                  By ${escapeHtml(review.reviewer)}
                </span>

                <span aria-hidden="true">•</span>

                <time datetime="${escapeHtml(review.date)}">
                  ${formatDate(review.date)}
                </time>

              </div>

              <div class="review-actions">

                <button
                  class="button button-primary"
                  type="button"
                  data-action="view"
                  data-id="${review.id}"
                >
                  Read full review
                </button>

                <button
                  class="button button-ghost"
                  type="button"
                  data-action="edit"
                  data-id="${review.id}"
                >
                  Edit
                </button>

                <button
                  class="button button-danger"
                  type="button"
                  data-action="delete"
                  data-id="${review.id}"
                >
                  Delete
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");

  renderReviewSummary();
}

/*
  Calculate and display review statistics.
*/
function renderReviewSummary() {
  const totalReviews = reviews.length;

  const average =
    totalReviews > 0
      ? reviews.reduce(function (total, review) {
          return total + review.rating;
        }, 0) / totalReviews
      : 0;

  elements.averageRating.textContent =
    average.toFixed(1);

  elements.reviewCount.textContent =
    `Based on ${totalReviews} review${
      totalReviews === 1 ? "" : "s"
    }`;

  elements.ratingBars.innerHTML =
    [5, 4, 3, 2, 1]
      .map(function (ratingValue) {
        const ratingCount =
          reviews.filter(function (review) {
            return review.rating === ratingValue;
          }).length;

        const percentage =
          totalReviews > 0
            ? (ratingCount / totalReviews) * 100
            : 0;

        return `
          <div class="rating-row">

            <span>
              ${ratingValue} star
            </span>

            <div
              class="rating-track"
              aria-hidden="true"
            >
              <div
                class="rating-fill"
                style="width: ${percentage}%"
              ></div>
            </div>

            <span>
              ${ratingCount}
            </span>

          </div>
        `;
      })
      .join("");
}

/*
  Open the full review dialog.
*/
function openReviewDialog(reviewId) {
  const review = reviews.find(function (item) {
    return item.id === reviewId;
  });

  if (!review) {
    return;
  }

  const imagePath =
    review.image ||
    "../images/ergonomic_wooden_desk.png";

  elements.dialogContent.innerHTML = `
    <img
      class="dialog-image"
      src="${escapeHtml(imagePath)}"
      alt="${escapeHtml(review.product)}"
      onerror="this.src='../images/ergonomic_wooden_desk.png'"
    >

    <div class="dialog-body">

      <span class="badge">
        ${escapeHtml(review.category)}
      </span>

      <h2>
        ${escapeHtml(review.title)}
      </h2>

      <p class="product-name">
        ${escapeHtml(review.product)}
      </p>

      <p
        class="rating"
        aria-label="${review.rating} out of 5 stars"
      >
        ${createStars(review.rating)}
      </p>

      <p>
        ${escapeHtml(review.body)}
      </p>

      <div class="review-meta">

        <span>
          By ${escapeHtml(review.reviewer)}
        </span>

        <span aria-hidden="true">•</span>

        <time datetime="${escapeHtml(review.date)}">
          ${formatDate(review.date)}
        </time>

      </div>

    </div>
  `;

  if (typeof elements.reviewDialog.showModal === "function") {
    elements.reviewDialog.showModal();
  } else {
    elements.reviewDialog.setAttribute("open", "");
  }
}

/*
  Fill the form with an existing review.
*/
function startEditingReview(reviewId) {
  const review = reviews.find(function (item) {
    return item.id === reviewId;
  });

  if (!review) {
    return;
  }

  elements.reviewId.value = review.id;
  elements.reviewTitle.value = review.title;
  elements.productName.value = review.product;
  elements.reviewCategory.value = review.category;
  elements.reviewRating.value = review.rating;
  elements.reviewerName.value = review.reviewer;
  elements.reviewImage.value = review.image;
  elements.reviewBody.value = review.body;

  elements.characterCount.textContent =
    review.body.length;

  elements.submitButton.textContent =
    "Save changes";

  elements.cancelEdit.hidden = false;

  elements.formMessage.textContent =
    "Editing review. Update the fields and save your changes.";

  elements.formMessage.className =
    "form-message";

  document
    .getElementById("write-review")
    .scrollIntoView({
      behavior: "smooth"
    });

  elements.reviewTitle.focus();
}

/*
  Reset the review form.
*/
function resetReviewForm() {
  elements.form.reset();

  elements.reviewId.value = "";

  elements.submitButton.textContent =
    "Publish review";

  elements.cancelEdit.hidden = true;

  elements.characterCount.textContent =
    "0";

  elements.formMessage.textContent = "";

  elements.formMessage.className =
    "form-message";
}

/*
  Delete a review.
*/
function deleteReview(reviewId) {
  const review = reviews.find(function (item) {
    return item.id === reviewId;
  });

  if (!review) {
    return;
  }

  const confirmed = confirm(
    `Delete the review for "${review.product}"?`
  );

  if (!confirmed) {
    return;
  }

  reviews = reviews.filter(function (item) {
    return item.id !== reviewId;
  });

  saveReviews();
  renderReviews();

  elements.formMessage.textContent =
    "Review deleted successfully.";

  elements.formMessage.className =
    "form-message success";
}

/*
  Handle form submission.
*/
elements.form.addEventListener(
  "submit",
  function (event) {
    event.preventDefault();

    const existingId =
      Number(elements.reviewId.value);

    const title =
      elements.reviewTitle.value.trim();

    const product =
      elements.productName.value.trim();

    const category =
      elements.reviewCategory.value;

    const rating =
      Number(elements.reviewRating.value);

    const reviewer =
      elements.reviewerName.value.trim();

    const image =
      elements.reviewImage.value.trim();

    const body =
      elements.reviewBody.value.trim();

    if (
      !title ||
      !product ||
      !category ||
      !rating ||
      !reviewer ||
      body.length < 20
    ) {
      elements.formMessage.textContent =
        "Please complete all required fields. The review must contain at least 20 characters.";

      elements.formMessage.className =
        "form-message error";

      return;
    }

    const oldReview =
      reviews.find(function (item) {
        return item.id === existingId;
      });

    const reviewData = {
      id: existingId || Date.now(),
      title: title,
      product: product,
      category: category,
      rating: rating,
      reviewer: reviewer,
      image:
        image ||
        "../images/ergonomic_wooden_desk.png",
      body: body,
      date:
        oldReview?.date ||
        new Date().toISOString().slice(0, 10)
    };

    if (existingId) {
      reviews = reviews.map(function (review) {
        return review.id === existingId
          ? reviewData
          : review;
      });
    } else {
      reviews.unshift(reviewData);
    }

    saveReviews();
    renderReviews();
    resetReviewForm();

    elements.formMessage.textContent =
      existingId
        ? "Review updated successfully."
        : "Review published successfully.";

    elements.formMessage.className =
      "form-message success";

    document
      .getElementById("review-list")
      .scrollIntoView({
        behavior: "smooth"
      });
  }
);

/*
  Handle buttons inside review cards.
*/
elements.container.addEventListener(
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
      Number(button.dataset.id);

    const action =
      button.dataset.action;

    if (action === "view") {
      openReviewDialog(reviewId);
    }

    if (action === "edit") {
      startEditingReview(reviewId);
    }

    if (action === "delete") {
      deleteReview(reviewId);
    }
  }
);

/*
  Search and filter event listeners.
*/
elements.searchInput.addEventListener(
  "input",
  renderReviews
);

elements.categoryFilter.addEventListener(
  "change",
  renderReviews
);

elements.ratingFilter.addEventListener(
  "change",
  renderReviews
);

elements.sortFilter.addEventListener(
  "change",
  renderReviews
);

/*
  Update character counter.
*/
elements.reviewBody.addEventListener(
  "input",
  function () {
    elements.characterCount.textContent =
      elements.reviewBody.value.length;
  }
);

/*
  Cancel editing.
*/
elements.cancelEdit.addEventListener(
  "click",
  function () {
    resetReviewForm();

    elements.formMessage.textContent =
      "Editing cancelled.";

    elements.formMessage.className =
      "form-message";
  }
);

/*
  Close modal using the close button.
*/
elements.closeDialog.addEventListener(
  "click",
  function () {
    elements.reviewDialog.close();
  }
);

/*
  Close modal when clicking outside its content.
*/
elements.reviewDialog.addEventListener(
  "click",
  function (event) {
    if (event.target === elements.reviewDialog) {
      elements.reviewDialog.close();
    }
  }
);

/*
  Close modal with Escape on browsers
  that need manual handling.
*/
document.addEventListener(
  "keydown",
  function (event) {
    if (
      event.key === "Escape" &&
      elements.reviewDialog.open
    ) {
      elements.reviewDialog.close();
    }
  }
);

/*
  Initial page render.
*/
renderReviews();
