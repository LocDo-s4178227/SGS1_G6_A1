# Change Summary

This update connects the static prototype modules to the Node.js backend and makes user-specific data persist through the existing JSON data store.

## Authentication and Shared User Session

- Login now stores the authenticated user ID, user object, role, and auth token in `localStorage`.
- Forum, Reviews, Blog, Wishlist, Shopping Cart, Admin, and Profile scripts read the shared `userId` session.
- Blog, Review, Wishlist, Forum, and Admin API calls send the current user through the `x-user-id` header.
- Profile and account flows support both `id` and `_id` user response formats.

## Shopping Cart

- Replaced hardcoded cart rendering with API-backed rendering in `shopping_cart/cart-page.js`.
- Cart items load from `GET /api/cart/:sessionId`.
- Quantity updates use `PUT /api/cart/:sessionId/items/:itemId`.
- Item removal uses `DELETE /api/cart/:sessionId/items/:itemId`.
- Subtotal, service fee, tax, total, item count, and empty-cart state are calculated dynamically.
- Checkout is disabled when there are no cart items.
- Legacy `forumCart` localStorage entries are migrated once and then cleared.
- The session cart cache is updated after successful changes so deleted items do not reappear.

## Discussion Forum

- Removed the hardcoded mock user from `discussion_forum.js`.
- Forum creation now uses the shared logged-in user and sends an author/user ID (for this assignment, the demo user).
- Added live forum list loading in `forum-page.js`.
- Search, content filtering, and sorting now call `GET /api/threads`.
- Thread detail pages now load the requested thread ID dynamically through `thread-detail.js`.
- Replies and thread metadata are rendered from backend data.
- Corrected form IDs so create/edit forum pages connect to the JavaScript handlers.

## Wishlist

- Marketplace Save actions now use `POST /api/wishlist/:userId/items`.
- Wishlist items load from the current user's backend wishlist.
- Removing a wishlist item uses the backend API.
- Existing `savedMarketThreads` localStorage records are migrated to the backend.
- Wishlist links now use each item's real `productId`/thread ID.
- Added the `kbd-002` 3D Printed Mechanical Keyboard Case request to the market data.
- The keyboard item now opens the keyboard thread instead of the desk thread.

## Reviews and Ratings

- Replaced the hardcoded review user with the shared account session.
- Reviews load from `GET /api/reviews`.
- Create, edit, and delete actions use the backend API.
- Review ownership is checked using the logged-in user ID.
- Legacy local-only sample reviews can be removed without reappearing.
- localStorage remains as an offline cache and draft/filter store.

## Blog

- Added `Blog/blog.js` for API-backed blog behavior.
- Blog list search and filters use the backend.
- Added create, edit, detail, and delete behavior.
- Blog ownership is checked by the backend using `authorId`.
- The author is taken from the logged-in user session instead of an editable client field.

## Admin Module

- Added `admin/admin.js`.
- Admin login now authenticates through the backend.
- Admin dashboard statistics load dynamically.
- User management supports search, role filtering, active/locked filtering, lock/unlock, role changes, and deletion.
- Admin profile updates and password changes use the existing account API.
- Admin routes require an administrator user.

## Backend API and Validation

- Added persisted `blogs`, `reviews`, and `wishlists` collections to the JSON data model.
- Added CRUD routes for blogs and reviews.
- Added wishlist retrieval, create, and delete routes.
- Added admin statistics, user filtering, status, role, and delete routes.
- Added ownership checks for blogs, reviews, and wishlists.
- Added server-side validation for blog fields, review fields, wishlist items, admin roles, and user status values.
- Existing forum, cart, account, and checkout routes remain covered by validation.
- The Express app is exportable for automated testing without automatically starting a listener when imported.

## Database Documentation

- Extended `backend/DATABASE_SCHEMA.md` with `THREADS`, `REPLIES`, `BLOGS`, `REVIEWS`, and `WISHLISTS`.
- Documented ownership and relationship behavior.
- Updated the Mermaid ER diagram to include the new persisted collections.

## Automated Tests

- Replaced the placeholder `npm test` command with Node's built-in test runner.
- Added `backend/test/api.test.js` covering:
  - Health endpoint
  - Blog validation and CRUD
  - Review validation and ownership
  - Wishlist validation and access control
  - Admin authorization and user filtering
  - Forum thread and reply CRUD

Run backend tests with:

```powershell
cd Static_html_css/backend
npm test
```

Run the broader validation script with:

```powershell
powershell -ExecutionPolicy Bypass -File Static_html_css/backend/test/run-validation.ps1
```

## Known Prototype Limitation

Authentication currently uses localStorage and the `x-user-id` header. This is suitable for the current coursework prototype but is not production-grade authentication. A deployed application should use signed sessions or JWT middleware and should hash passwords before storing them.
