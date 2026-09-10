# Shopping Cart Backend API

This backend powers the shopping_cart module and listens on `http://localhost:5000` by default.

## Setup

Run these steps on the server machine or hosting platform:

1. Install Node.js 18 or later and copy/clone the project source code.
2. Open a terminal in `Static_html_css/backend`.
3. Install the exact package versions recorded in `package-lock.json`:

```bash
npm ci
```

4. Create a `.env` file from `.env.example` and set the MongoDB connection
	values. Set the optional Cloudinary values if uploaded images should be
	stored remotely. Keep `.env` private and do not commit it.
5. Start the application:

```bash
npm start
```

The server listens on the `PORT` environment variable, or port `5000` when it
is not set. Configure the hosting platform or reverse proxy to forward the
domain to this port. Open the frontend through the same domain (for example,
`https://your-domain.example/user_account/auth.html`) so browser session
cookies work correctly. Do not open the HTML files directly with `file://`.

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
