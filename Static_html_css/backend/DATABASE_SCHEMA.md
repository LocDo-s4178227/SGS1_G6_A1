# Backend Database Schema and Relationships

This document describes the current persisted data model in `backend/src/data/db.json`.

## Collection Schemas

The application uses a JSON file for lightweight persistence rather than a database
server. The top-level stores below are equivalent to collections in the application
model. `USER_PREFERENCES`, `CART_ITEMS`, `ORDER_ITEMS`, `PAYMENT_DETAILS`, and
`DELIVERY_DETAILS` are embedded objects or array items, not separate persisted stores.

### Users

Stores account and profile information. Each user is keyed by `id` and has a unique
`email` and `username`, along with `firstName`, `lastName`, `password`, `phone`,
`location`, `description`, `profilePicture`, `userType`, and `active` status.
Notification settings are embedded in the `preferences` object, which contains
`emailNotifications`, `messageNotifications`, and `newRequestNotifications`.

### Carts

Stores the current shopping cart for a browser or checkout session. Each cart is keyed
by `sessionId` and contains an `items` array. Every cart item stores an item `id`, the
referenced `productId`, `quantity`, `unitPrice`, and optional `textDetails`.

### Orders

Stores completed checkout records. Each order has an `id`, unique `orderNumber`, the
source cart `sessionId`, a snapshot of the purchased `items`, embedded `payment` and
`delivery` details, calculated `subtotal`, `shippingCost`, `taxAmount`, `total`, and
the ISO timestamp `createdAt`. Payment details include the cardholder name and last
four digits, while delivery details include the recipient and address information.

## Relationships

- One `USERS` record owns an embedded `preferences` object.
- One `CARTS` record contains zero or more embedded cart items.
- One `CARTS` record can produce zero or more `ORDERS` over time through checkout;
    the relationship is represented by `ORDERS.sessionId`.
- One `ORDERS` record contains one or more embedded order items and one each of the
    embedded payment and delivery detail objects.
- Checkout copies the cart items into the order, then empties the source cart. Cart
    items and order items reference products by `productId`, but product records are
    not persisted by this backend.
- `THREADS` and `REPLIES` are persisted top-level collections. A thread has many
    replies through `REPLIES.threadId`; deleting a thread cascades to its replies.
- `BLOGS` and `REVIEWS` are persisted top-level collections. Each record stores the
    creating user's `authorId` or `reviewerId` for ownership checks.
- `WISHLISTS` is a top-level object keyed by `userId`; each user owns an array of
    wishlist items.
- Administrator actions operate on `USERS` records and change `active` or `userType`.

## Schema Overview

```mermaid
erDiagram
    USERS {
        string id PK
        string firstName
        string lastName
        string username
        string email UNIQUE
        string password
        string phone
        string location
        string description
        string profilePicture
        boolean active
        object preferences
    }

    USER_PREFERENCES {
        boolean emailNotifications
        boolean messageNotifications
        boolean newRequestNotifications
    }

    CARTS {
        string sessionId PK
        array items
    }

    CART_ITEMS {
        string id PK
        string productId
        number quantity
        number unitPrice
        object textDetails
    }

    ORDERS {
        string id PK
        string orderNumber UNIQUE
        string sessionId FK
        array items
        object payment
        object delivery
        number subtotal
        number shippingCost
        number taxAmount
        number total
        string createdAt
    }

    ORDER_ITEMS {
        string id PK
        string productId
        number quantity
        number unitPrice
        object textDetails
    }

    PAYMENT_DETAILS {
        string cardholderName
        string cardLast4
        string cardBrand
    }

    DELIVERY_DETAILS {
        string fullName
        string phone
        string addressLine1
        string addressLine2
        string city
        string state
        string postalCode
        string country
        string deliveryInstructions
    }

    THREADS {
        string id PK
        string authorId FK
        string author
        string title
        string content
        string status
        string posted_at
        number replyCount
    }

    REPLIES {
        string id PK
        string threadId FK
        string author
        string title
        string content
        number price
        string posted_at
    }

    BLOGS {
        string id PK
        string authorId FK
        string title
        string category
        array tags
        string summary
        string content
        string createdAt
        string updatedAt
    }

    REVIEWS {
        string id PK
        string reviewerId FK
        string product
        string title
        string category
        number rating
        string summary
        string description
        string dateAdded
    }

    WISHLISTS {
        string userId PK
        array items
    }

    USERS ||--|| USER_PREFERENCES : has
    CARTS ||--o{ CART_ITEMS : contains
    ORDERS ||--o{ ORDER_ITEMS : captures
    ORDERS ||--|| PAYMENT_DETAILS : uses
    ORDERS ||--|| DELIVERY_DETAILS : uses
    CARTS ||--o{ ORDERS : checked_out_into
    USERS ||--o{ THREADS : authors
    THREADS ||--o{ REPLIES : contains
    USERS ||--o{ BLOGS : authors
    USERS ||--o{ REVIEWS : writes
    USERS ||--|| WISHLISTS : owns
```

## Relationship Notes

- Primary login identity is `USERS.id` and `USERS.email`.
- `CARTS` are currently session-based (`sessionId`) rather than directly user-owned.
- During checkout, cart items are copied into `ORDERS.items`, and the cart is cleared.
- `ORDERS.sessionId` links an order back to the session cart that produced it.
- Profile preferences are embedded under `USERS.preferences`.

## Data Source

- Runtime persistence file: `backend/src/data/db.json`
- Persistence helpers: `backend/src/data/db.js`
- Route usage: `backend/src/server.js`
