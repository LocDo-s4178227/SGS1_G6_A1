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
- `GET /api/marketplace`

### Discussion Forum (requires `Authorization: Bearer <token>`)
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

- Data is stored in `src/data/db.json` for lightweight persistence.
- Frontend shopping pages call these APIs through `shopping_cart/js/main.js`.
