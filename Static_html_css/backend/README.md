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

Open the frontend through `http://localhost:5000` (for example,
`http://localhost:5000/user_account/auth.html`) so browser session cookies
work correctly. Avoid opening the HTML files directly with `file://`.

The backend loads `backend/.env` automatically. Set `MONGODB_URI` to the
Atlas connection string and optionally change `MONGODB_DB_NAME` (default:
`rshop`). The first startup seeds an empty Atlas database from the existing
local JSON data; later startups use MongoDB as the source of truth.

## Implemented Endpoints

- `GET /api/health`
- `POST /api/auth/login` (sets an HttpOnly session cookie)
- `POST /api/auth/register` (sets an HttpOnly session cookie)
- `GET /api/auth/session`
- `POST /api/auth/logout` (revokes and clears the session cookie)
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
- `GET /api/marketplace`

### Discussion Forum (requires the authenticated session cookie)
- `GET /api/threads`
- `GET /api/threads/:id`
- `POST /api/threads`
- `PUT /api/threads/:id`
- `DELETE /api/threads/:id`
- `POST /api/threads/:id/replies`
- `PUT /api/replies/:replyId`
- `DELETE /api/replies/:replyId`

## Data Model Diagram

- Full schema and relationships: `DATABASE_SCHEMA.md`

## Notes

- Data is stored in MongoDB when `MONGODB_URI` is configured. Without it, the
	backend falls back to `src/data/db.json` for local development.
- Frontend shopping pages call these APIs through `shopping_cart/js/main.js`.
