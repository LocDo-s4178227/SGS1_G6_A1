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

    THREADS {
        string id PK
        string author
        string title
        string content
        string posted_at
        string image
        string status
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
        string image
    }

    BLOGS {
        string id PK
        string authorId FK
        string title
        string dateAdded
        string category
        array tags
        string image
        string summary
        string content
    }

    REVIEWS {
        string id PK
        string reviewerId FK
        string productId
        string title
        string product
        string category
        number rating
        string summary
        string description
        string image
        string dateAdded
    }

    USERS ||--|| USER_PREFERENCES : has
    CARTS ||--o{ CART_ITEMS : contains
    ORDERS ||--o{ ORDER_ITEMS : captures
    ORDERS ||--|| PAYMENT_DETAILS : uses
    ORDERS ||--|| DELIVERY_DETAILS : uses
    CARTS ||--o{ ORDERS : checked_out_into
    USERS ||--o{ THREADS : authors
    THREADS ||--o{ REPLIES : contains
    USERS ||--o{ REPLIES : authors
    USERS ||--o{ BLOGS : authors
    USERS ||--o{ REVIEWS : writes
```

## Relationship Notes

- Primary login identity is `USERS.id` and `USERS.email`.
- `CARTS` are currently session-based (`sessionId`) rather than directly user-owned.
- During checkout, cart items are copied into `ORDERS.items`, and the cart is cleared.
- `ORDERS.sessionId` links an order back to the session cart that produced it.
- Profile preferences are embedded under `USERS.preferences`.
- `THREADS.author` and `REPLIES.author` currently store the author's username, so
    the user relationships are logical links rather than enforced foreign keys.
- `REPLIES.threadId` identifies the parent discussion thread. Deleting a thread
    also removes its associated replies.
- `BLOGS.authorId` and `REVIEWS.reviewerId` identify the user who created each
    record when the backend-backed module is enabled.
- `REVIEWS.productId` identifies the reviewed marketplace item. Product details
    are represented by fields in the review because there is no separate
    products collection in the current JSON database.

## Main Data Collections

- **Users:** Stores account information including the user ID, first name, last
    name, username, email address, password, contact information, profile
    description, profile picture, account status, and preferences.
- **User Preferences:** Stores notification settings for each user, including
    email notifications, message notifications, and new-request notifications.
    These settings are embedded within the user record under `preferences`.
- **Carts:** Stores temporary items selected before checkout. Carts are
    session-based through `sessionId`, and each cart can contain multiple cart
    items.
- **Cart Items:** Stores individual items within a cart. Each item contains a
    product or forum-thread reference, quantity, unit price, and extra display
    details such as the item title, maker, and accepted-offer status.
- **Orders:** Stores confirmed checkout records. An order includes the session
    cart that created it, purchased items, limited payment details, delivery
    details, subtotal, shipping cost, tax, final total, order number, and creation
    date.
- **Order Items:** Stores a snapshot of each cart item at checkout. This
    preserves the original product reference, quantity, unit price, and relevant
    item details after the cart is cleared.
- **Payment Details:** Stores limited prototype payment information: cardholder
    name, card brand, and the final four card digits. Full card details are not
    stored.
- **Delivery Details:** Stores order delivery information, including recipient
    name, phone number, address, city, state, postal code, country, and optional
    delivery instructions.
- **Discussion Threads:** Stores custom-maker requests posted by users. A
    thread includes its title, description (`content`), author, creation date,
    optional reference image, request status, and reply count.
- **Discussion Replies:** Stores replies and price offers posted under a
    discussion thread. Each reply is linked to one thread and includes its author,
    title, content, optional price, optional image, and posting date.
- **Blog Posts:** Stores articles published through the Blog module. A blog post
    includes its author, title, publication date, category, tags, image URL,
    summary, and full content. The author is associated with a user through
    `authorId` when backend persistence is used.
- **Reviews and Ratings:** Stores product feedback submitted by users. A review
    includes its reviewer, product reference, title, product name, category,
    numeric rating, summary, detailed description, image, and date added. The
    reviewer is associated with a user through `reviewerId`, while `productId`
    is a logical reference to the reviewed marketplace item.

## Data Source

- Runtime persistence file: `backend/src/data/db.json`
- Persistence helpers: `backend/src/data/db.js`
- Route usage: `backend/src/server.js`
