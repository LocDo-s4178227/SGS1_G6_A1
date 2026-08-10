# Backend Database Schema and Relationships

This document describes the current persisted data model in `backend/src/data/db.json`.

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

    USERS ||--|| USER_PREFERENCES : has
    CARTS ||--o{ CART_ITEMS : contains
    ORDERS ||--o{ ORDER_ITEMS : captures
    ORDERS ||--|| PAYMENT_DETAILS : uses
    ORDERS ||--|| DELIVERY_DETAILS : uses
    CARTS ||--o{ ORDERS : checked_out_into
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
