# Shopping Cart Backend API

This backend powers the shopping_cart module and listens on `http://localhost:5000` by default.

## Setup

1. Open terminal in `backend`.
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm start
```

## Implemented Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/user/:id`
- `PUT /api/auth/user/:id`
- `POST /api/auth/change-password`
- `PUT /api/auth/user/:id/deactivate`
- `DELETE /api/auth/user/:id`
- `GET /api/cart/:sessionId`
- `POST /api/cart/:sessionId/items`
- `PUT /api/cart/:sessionId/items/:itemId`
- `DELETE /api/cart/:sessionId/items/:itemId`
- `POST /api/orders/checkout/:sessionId`
- `GET|POST /api/blogs`
- `GET|PUT|DELETE /api/blogs/:id`
- `GET|POST /api/reviews`
- `GET|PUT|DELETE /api/reviews/:id`
- `GET /api/wishlist/:userId`
- `POST /api/wishlist/:userId/items`
- `DELETE /api/wishlist/:userId/items/:itemId`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id/status`
- `PUT /api/admin/users/:id/role`
- `DELETE /api/admin/users/:id`
- `GET|POST /api/threads`
- `GET|PUT|DELETE /api/threads/:id`
- `POST /api/threads/:id/replies`
- `PUT|DELETE /api/replies/:replyId`

## Data Model Diagram

- Full schema and relationships: `DATABASE_SCHEMA.md`

## Notes

- Data is stored in `src/data/db.json` for lightweight persistence.
- Frontend shopping pages call these APIs through `shopping_cart/js/main.js`.
- Frontend Blog, Review, Wishlist, Forum, and Admin pages call their API routes
	through the module scripts in their respective folders.
- Run `npm test` to execute the API validation and CRUD tests.
- Run `powershell -ExecutionPolicy Bypass -File test/run-validation.ps1` to run
	the backend tests and JavaScript syntax checks for the project modules.
