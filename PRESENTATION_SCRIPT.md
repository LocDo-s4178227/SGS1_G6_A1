# Rshop Marketplace Presentation Script

**Suggested duration:** 3-4 minutes  
**Presenter:** Nguyen Huu Khoi (s4162137)  
**Hosted website:** `<insert hosted website URL before presenting>`

## Presentation Script

**Say:**

"Hello everyone. Our product is **Rshop**, a custom makers marketplace that brings shopping, community discussion, reviews, blog content, and account management into one web application.

Rshop helps customers move from a custom request to a trusted purchase. Users can browse requests, inspect offers, save items, read reviews, and purchase through the cart and checkout.

The application has connected marketplace, forum, wishlist, review, blog, and account modules. Shared navigation, sessions, and request IDs connect them. The frontend communicates with a Node.js backend using MongoDB when configured, or `backend/src/data/db.json` locally.

The workflow starts at the homepage. A user registers or logs in, browses requests, checks an accepted price, and saves the item or adds it to the cart. The cart keeps the source thread. After reviewing the total, the user enters delivery and payment details and receives confirmation.

My responsibility is the **User Account and Shopping Cart modules**.

The User Account module manages identity and account lifecycle. A new user can register as a customer or professional, while an existing user can log in and retrieve an authenticated session. On the profile page, users can update personal information, change their password, manage notifications, deactivate their account, and log out. The user ID and role are shared with the other modules for authentication and ownership checks.

The Shopping Cart module turns an accepted marketplace offer into a purchase-ready order. It loads data using the browser session ID and cart API. Users can add an item only when it has a positive accepted price, while duplicate items are detected. The cart displays the item and source thread, then calculates the subtotal, service fee, tax, total, and item count dynamically. Users can remove items or proceed to checkout.

During checkout, the backend validates the cart and delivery and payment information. It calculates the final total, creates the order, and clears the cart after success. The main APIs support marketplace retrieval, cart management, authentication, profile updates, and `POST /api/orders/checkout/:sessionId` for order creation.

For the demonstration, I will first show the User Account module. I will sign in with a test account, show the shared navigation and the Profile, Security, and Account sections, then update a safe test value. After saving and refreshing, I will show that the change is persisted and briefly point out the password and notification controls.

Next, I will show the Shopping Cart module. I will select a request with a positive accepted price and add it to the cart. I will point out the item, source thread, agreed price, fees, tax, total, and item count. I will remove and re-add the item to demonstrate refresh, then complete checkout with test information and verify the order confirmation and empty cart.

To conclude, Rshop connects community discovery with purchasing. The User Account module provides the identity and session shared across the application, while the Shopping Cart module carries an accepted request through pricing, checkout validation, order creation, and confirmation. Thank you."

## Feature Reference: Shopping Cart and User Account

Use the following notes when explaining how each feature works in the final product.

### Shopping Cart Features

| Feature | What it does and who can use it | Page, route, or API | Data and database connection | Completion and testing status |
|---|---|---|---|---|
| Browse marketplace requests | Loads marketplace requests so customers and professional users can search, filter by status, and sort listings. | `shopping_cart/products.html`; `GET /api/marketplace` | Retrieves thread and offer data from the backend. The backend builds marketplace listings from persisted `threads` and `replies`. | Implemented in the final frontend. Verify by loading listings, searching, changing status, and changing sort order. |
| Add an accepted offer to cart | Adds a request only when it has a positive price. Customers and professional users with a browser session can use it. Duplicate items are rejected. | `products.html` **Add to Cart**; `wishlist.html` **Move to Cart**; `POST /api/cart/:sessionId/items` | Creates a cart item containing `productId`, quantity, unit price, and `textDetails` such as title, thread ID, author, and status. It is stored in `carts[sessionId].items` or the MongoDB `carts` collection. | Implemented. Test with a priced item, an unpriced item, and the same item twice; confirm success, validation, and duplicate handling. |
| Retrieve and display cart | Shows items selected for purchase, their source discussion thread, agreed price, status, and current order summary. | `shopping_cart/cart.html`; `GET /api/cart/:sessionId` | Reads the session cart and calculates/returns the subtotal. The browser session ID links the page to one cart. | Implemented. Test by opening the cart after adding an item and refreshing the page; confirm the item remains visible. |
| Update cart quantity/details | Allows a cart item quantity or display details to be updated through the backend contract. | `PUT /api/cart/:sessionId/items/:itemId` | Updates `quantity` and/or `textDetails` in the matching cart item and persists the cart. | Backend route is implemented and validation exists for positive integer quantities. The current cart page does not expose a visible quantity editor, so this route should be tested through an API client or added to the UI if required. |
| Remove cart item | Deletes a selected item and refreshes the badge, item list, and totals. Any user with access to that session cart can use it. | `shopping_cart/cart.html` **Remove**; `DELETE /api/cart/:sessionId/items/:itemId` | Deletes the matching item from `carts[sessionId].items` and persists the updated cart. | Implemented. Test by removing an item and confirming it disappears and the totals update. |
| Calculate order summary | Calculates item count, subtotal, service fee, 10% tax, and total for display before checkout. | `shopping_cart/cart.html`; frontend `updateOrderSummary(items)` | Reads `unitPrice` and `quantity` from cart items. The calculated values are displayed in the page; the final order values are recalculated by the checkout API. | Implemented. Test with one or more items and verify that changing/removing items changes the summary. |
| Checkout and create order | Validates delivery and payment information, creates the order, clears the cart, and returns an order number. Authenticated demo users should use test data only. | `shopping_cart/checkout.html`; `POST /api/orders/checkout/:sessionId` | Copies cart items into an order, stores subtotal, shipping cost, tax amount, total, delivery data, and limited payment data such as card brand/last four digits. It then empties the session cart in `orders` and `carts`. | Backend behavior is implemented. Test with a non-empty cart, valid data, empty-cart input, invalid delivery data, and invalid payment data. Confirm order creation and cart clearing. Verify that the hosted checkout page is actually wired to this endpoint. |

### User Account Features

| Feature | What it does and who can use it | Page, route, or API | Data and database connection | Completion and testing status |
|---|---|---|---|---|
| Register account | Creates a customer or professional account. New visitors can use it; duplicate emails/usernames are rejected. | `user_account/auth.html`; `POST /api/auth/register` | Creates a `users` record with ID, username, email, password, `userType`, profile defaults, preferences, and `active: true`. Stored in the JSON `users` object or MongoDB `users` collection. | Implemented. Test valid registration, weak password, invalid email, duplicate email, and duplicate username. |
| Login and session | Authenticates a registered active user using email or username and password. | `user_account/auth.html`; `POST /api/auth/login`; `GET /api/auth/session` | Retrieves the user from `users`, creates an in-memory session, and sends an HttpOnly `rshop_session` cookie. The password is removed from the response. | Implemented. Test valid login, invalid credentials, deactivated account, page refresh, and session retrieval. Sessions are not persisted across backend restarts. |
| Logout | Ends the current session and clears local user state. Any logged-in user can use it through shared navigation. | Shared navigation; `POST /api/auth/logout` | Deletes the in-memory session and clears the `rshop_session` cookie. Local storage values such as user ID and role are removed by the frontend. | Implemented. Test logout, then reload an authenticated page and confirm that authentication is required again. |
| View profile | Loads the signed-in user's name, email, contact details, description, and profile picture. The intended user is the account owner. | `user_account/profile.html`; `GET /api/auth/user/:id` | Retrieves the matching `users` record while omitting the password from the response. | Implemented for the normal frontend flow. Test by logging in, opening the profile page, and confirming that stored values are loaded. The backend should also enforce that `:id` matches the logged-in user. |
| Update profile | Updates first name, last name, email, phone, location, description, and profile picture. The intended user is the account owner. | Profile tab; `PUT /api/auth/user/:id` | Updates allowed fields in the `users` record. Email format and duplicate email validation are performed before persistence. | Implemented for the normal frontend flow. Test a safe profile change, refresh the page, and confirm persistence; also test invalid and duplicate email values. The backend currently checks login but should add an owner-ID check. |
| Change password | Allows an authenticated user to replace the current password after entering the current password and a strong new password. | Security tab; `POST /api/auth/change-password` | Reads the current user's password from `users`, validates the current password and strength rules, then updates the stored password. | Implemented and frontend validation is present. Test matching confirmation, weak password, wrong current password, same password, and successful change using a disposable account. |
| Forgot and reset password | Issues a short-lived reset token and accepts a strong replacement password. Visitors can request recovery for an existing active email; the reset operation uses the token. | Auth page; `POST /api/auth/forgot-password`; `POST /api/auth/reset-password` | Reads the user from `users` and stores the reset token only in backend memory for 15 minutes. The new password is persisted to the user record. | Implemented at API level. Test valid email, unknown email, expired/invalid token, weak new password, and successful reset. The token is not persisted across backend restarts. |
| Notification preferences | Lets authenticated users enable or disable email, message, and new-request notifications. | Account tab; `PUT /api/auth/user/:id` with `preferences` | Updates the embedded `users.preferences` object containing three boolean fields. | Implemented. Test toggling settings, saving, refreshing, and confirming the values remain changed. |
| Deactivate account | Marks an account inactive and logs the user out. The intended user is the account owner. | Account tab; `PUT /api/auth/user/:id/deactivate` | Updates `users.active` to `false`. Login and session access reject inactive users. | Implemented for the normal frontend flow. Test with a disposable account, then confirm login returns an account-deactivated error. The backend should add an owner-ID check. |
| Delete account | Permanently removes an account after email and password confirmation. The intended user is the account owner. | Account tab; `DELETE /api/auth/user/:id` | Deletes the matching user record from the JSON `users` object or MongoDB `users` collection. | Implemented for the normal frontend flow. Test only with a disposable account and confirm the user can no longer log in. The backend should add an owner-ID check. |

### Testing Statement for the Presentation

**Say:**

"The features are implemented in the final frontend and backend. I tested the main flows manually with a test account: registration or login, profile retrieval and update, cart add, cart retrieval, item removal, summary refresh, and checkout validation. The backend currently has no configured automated test command in `package.json`, so automated test coverage should not be claimed until a real test suite is added and run."

## Presenter Checklist

- Replace `<insert hosted website URL before presenting>`.
- Confirm the hosted frontend uses the hosted backend, not `http://localhost:5000/api`.
- Prepare a test account and one request with a positive accepted price.
- Test login, add-to-cart, remove-item, and checkout before presenting.
- Use only test delivery and payment information.
- If hosted checkout wiring differs, describe the visible behavior and explain that the backend checkout contract is implemented.
