/**
 * Discussion Forum Module JavaScript
 * Handles live form validation, draft persistence (Web Storage API),
 * client-side search, sort, and filter features.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. CREATE / EDIT THREAD FORM LOGIC
    // ==========================================
    const threadForm = document.getElementById('forum-form') || document.querySelector('form#forum-form');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const categorySelect = document.getElementById('category');
    const draftStatus = document.getElementById('draft-status');

    const DRAFT_KEY = 'forum_post_draft';

    if (threadForm) {
        // Disable default browser HTML5 validation to use custom live validation
        threadForm.setAttribute('novalidate', 'true');

        // --- A. LOCALSTORAGE DRAFT MANAGEMENT ---
        
        /**
         * Loads saved draft data from LocalStorage if available.
         */
        function loadDraft() {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (!savedDraft) return;

            try {
                const data = JSON.parse(savedDraft);
                if (titleInput && data.title) titleInput.value = data.title;
                if (contentInput && data.content) contentInput.value = data.content;
                if (categorySelect && data.category) categorySelect.value = data.category;
                
                if (draftStatus) draftStatus.textContent = 'Draft restored from previous session.';
            } catch (e) {
                console.error('Failed to parse saved draft:', e);
            }
        }

        /**
         * Saves current form input state into LocalStorage.
         */
        function saveDraft() {
            const draftData = {
                title: titleInput ? titleInput.value : '',
                content: contentInput ? contentInput.value : '',
                category: categorySelect ? categorySelect.value : '',
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
            if (draftStatus) draftStatus.textContent = 'Draft auto-saved.';
        }

        /**
         * Clears saved draft data from LocalStorage.
         */
        function clearDraft() {
            localStorage.removeItem(DRAFT_KEY);
            if (draftStatus) draftStatus.textContent = '';
        }

        // --- B. LIVE FORM VALIDATION ---

        /**
         * Displays error message under the specified input field.
         * @param {HTMLElement} inputEl - The target input element
         * @param {string} message - Error description
         */
        function showError(inputEl, message) {
            if (!inputEl) return;
            const errorEl = document.getElementById(`${inputEl.id}-error`);
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            }
            inputEl.style.borderColor = '#dc3545';
        }

        /**
         * Clears error message and resets input border style.
         * @param {HTMLElement} inputEl - The target input element
         */
        function clearError(inputEl) {
            if (!inputEl) return;
            const errorEl = document.getElementById(`${inputEl.id}-error`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
            inputEl.style.borderColor = '';
        }

        /**
         * Validates the title input field.
         * @returns {boolean} True if valid, false otherwise.
         */
        function validateTitle() {
            if (!titleInput) return true;
            const val = titleInput.value.trim();
            if (!val) {
                showError(titleInput, 'Title cannot be empty.');
                return false;
            }
            if (val.length < 5) {
                showError(titleInput, 'Title must be at least 5 characters long.');
                return false;
            }
            clearError(titleInput);
            return true;
        }

        /**
         * Validates the content textarea field.
         * @returns {boolean} True if valid, false otherwise.
         */
        function validateContent() {
            if (!contentInput) return true;
            const val = contentInput.value.trim();
            if (!val) {
                showError(contentInput, 'Content cannot be empty.');
                return false;
            }
            if (val.length < 10) {
                showError(contentInput, 'Content must be at least 10 characters long.');
                return false;
            }
            clearError(contentInput);
            return true;
        }

        /**
         * Validates the category select dropdown field.
         * @returns {boolean} True if valid, false otherwise.
         */
        function validateCategory() {
            if (!categorySelect) return true;
            if (!categorySelect.value) {
                showError(categorySelect, 'Please select a category.');
                return false;
            }
            clearError(categorySelect);
            return true;
        }

        // --- C. EVENT LISTENERS ---

        // Load draft when form initializes
        loadDraft();

        // Attach input and blur listeners for instant live feedback and dynamic auto-save
        const formInputs = [titleInput, contentInput, categorySelect].filter(Boolean);
        
        formInputs.forEach(inputEl => {
            inputEl.addEventListener('input', () => {
                saveDraft();
                if (inputEl === titleInput) validateTitle();
                if (inputEl === contentInput) validateContent();
                if (inputEl === categorySelect) validateCategory();
            });

            inputEl.addEventListener('blur', () => {
                if (inputEl === titleInput) validateTitle();
                if (inputEl === contentInput) validateContent();
                if (inputEl === categorySelect) validateCategory();
            });
        });

        // Form Submission Handler
        threadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isTitleValid = validateTitle();
            const isContentValid = validateContent();
            const isCategoryValid = validateCategory();

            // Prevent submit if validation fails
            if (!isTitleValid || !isContentValid || !isCategoryValid) {
                return;
            }

            const payload = {
                title: titleInput ? titleInput.value.trim() : '',
                content: contentInput ? contentInput.value.trim() : '',
                category: categorySelect ? categorySelect.value : ''
            };

            try {
                const response = await fetch('/api/threads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    alert('Thread published successfully!');
                    threadForm.reset();
                    clearDraft();
                    window.location.href = 'forum.html';
                } else {
                    const err = await response.json();
                    alert('Error: ' + (err.message || 'Failed to publish thread.'));
                }
            } catch (err) {
                console.error('Submission network error:', err);
                alert('Could not connect to the server.');
            }
        });
    }

    // ==========================================
    // 2. CLIENT-SIDE SEARCH, SORT & FILTER LOGIC
    // ==========================================
    const searchTitleInput = document.getElementById('search-title');
    const searchContentInput = document.getElementById('search-content');
    const sortBySelect = document.getElementById('sort-by');
    const threadContainer = document.getElementById('thread-list-container') || document.querySelector('.thread-list');
    const resetBtn = document.getElementById('reset-filter-btn');

    if (threadContainer) {
        // Cache original list of card elements for client-side filtering
        const originalCards = Array.from(threadContainer.querySelectorAll('.thread-card'));

        /**
         * Filters and sorts thread cards dynamically on the client side.
         */
        function filterAndSortThreads() {
            const titleQuery = searchTitleInput ? searchTitleInput.value.toLowerCase().trim() : '';
            const contentQuery = searchContentInput ? searchContentInput.value.toLowerCase().trim() : '';
            const sortValue = sortBySelect ? sortBySelect.value : 'newest';

            // 1. Filter phase
            let filtered = originalCards.filter(card => {
                const titleText = (card.getAttribute('data-title') || card.querySelector('.card-title')?.textContent || '').toLowerCase();
                const contentText = (card.getAttribute('data-content') || card.querySelector('p')?.textContent || '').toLowerCase();

                const matchesTitle = !titleQuery || titleText.includes(titleQuery);
                const matchesContent = !contentQuery || contentText.includes(contentQuery);

                return matchesTitle && matchesContent;
            });

            // 2. Sort phase
            filtered.sort((a, b) => {
                const titleA = (a.getAttribute('data-title') || a.querySelector('.card-title')?.textContent || '').toLowerCase();
                const titleB = (b.getAttribute('data-title') || b.querySelector('.card-title')?.textContent || '').toLowerCase();
                const dateA = new Date(a.getAttribute('data-date') || 0);
                const dateB = new Date(b.getAttribute('data-date') || 0);

                if (sortValue === 'newest') return dateB - dateA;
                if (sortValue === 'oldest') return dateA - dateB;
                if (sortValue === 'title_asc' || sortValue === 'title-asc') return titleA.localeCompare(titleB);
                if (sortValue === 'title_desc' || sortValue === 'title-desc') return titleB.localeCompare(titleA);
                return 0;
            });

            // 3. Render phase
            threadContainer.innerHTML = '';
            if (filtered.length === 0) {
                threadContainer.innerHTML = '<p class="no-results" style="padding: 1rem; color: #666;">No requests match your filter criteria.</p>';
            } else {
                filtered.forEach(card => threadContainer.appendChild(card));
            }
        }

        // Attach event listeners for real-time search, filter, and sort behavior
        [searchTitleInput, searchContentInput, sortBySelect].forEach(element => {
            if (element) {
                element.addEventListener('input', filterAndSortThreads);
                element.addEventListener('change', filterAndSortThreads);
            }
        });

        // Reset filter action
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchTitleInput) searchTitleInput.value = '';
                if (searchContentInput) searchContentInput.value = '';
                if (sortBySelect) sortBySelect.value = 'newest';
                filterAndSortThreads();
            });
        }
    }
});