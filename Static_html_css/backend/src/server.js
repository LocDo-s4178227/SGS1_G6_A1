require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { db, generateId, generateOrderNumber, saveDb } = require("./data/db");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const passwordResetTokens = new Map();

app.use(cors());
app.use(express.json());

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStrongPassword(value) {
  if (!isNonEmptyString(value)) return false;
  const password = String(value);
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function normalizeUserTypes(value) {
  const input = Array.isArray(value) ? value : [value || "poster"];
  return input
    .map((entry) => {
      const normalized = String(entry || "").trim().toLowerCase();
      if (!normalized) return null;
      if (normalized === "user" || normalized === "customer") return "poster";
      if (normalized === "pro") return "professional";
      return normalized;
    })
    .filter(Boolean);
}

function buildLoginResponse(user) {
  const safeUser = sanitizeUser(user);
  return {
    success: true,
    user: {
      ...safeUser,
      _id: safeUser.id,
      role: safeUser.userType?.[0] || "poster"
    },
    token: `token_${user.id}_${Date.now()}`
  };
}

function getUserIdByResetToken(token) {
  const tokenData = passwordResetTokens.get(token);
  if (!tokenData) return null;
  if (Date.now() > tokenData.expiresAt) {
    passwordResetTokens.delete(token);
    return null;
  }
  return tokenData.userId;
}

function getCart(sessionId) {
  if (!db.carts[sessionId]) {
    db.carts[sessionId] = {
      sessionId,
      items: []
    };
  }
  return db.carts[sessionId];
}

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.post("/api/auth/login", (req, res) => {
  const { email, username, password } = req.body || {};
  const loginIdentifier = String(email || username || "").trim().toLowerCase();

  if (!isNonEmptyString(loginIdentifier) || !isNonEmptyString(password)) {
    return res.status(400).json({ success: false, message: "Email/username and password are required" });
  }

  const user = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === loginIdentifier || String(u.username || "").toLowerCase() === loginIdentifier
  );

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  if (!user.active) {
    return res.status(403).json({ success: false, message: "Account is deactivated" });
  }

  return res.json(buildLoginResponse(user));
});

app.post("/api/auth/register", (req, res) => {
  const {
    username,
    firstName,
    lastName,
    email,
    password,
    role,
    userType
  } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "A valid email is required" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 chars and include uppercase, lowercase, number, and special character"
    });
  }

  const submittedUsername = String(username || "").trim();
  if (!submittedUsername) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  if (submittedUsername.length < 3 || submittedUsername.length > 20) {
    return res.status(400).json({ success: false, message: "Username must be 3-20 characters" });
  }

  const existing = Object.values(db.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const usernameTaken = Object.values(db.users).some(
    (u) => String(u.username || "").toLowerCase() === submittedUsername.toLowerCase()
  );
  if (usernameTaken) {
    return res.status(409).json({ success: false, message: "Username already taken" });
  }

  const normalizedTypes = normalizeUserTypes(userType || role);
  if (!normalizedTypes.length) {
    return res.status(400).json({ success: false, message: "At least one user type is required" });
  }

  const id = generateId("user");
  const newUser = {
    id,
    firstName: String(firstName || submittedUsername).trim(),
    lastName: String(lastName || "User").trim(),
    username: submittedUsername,
    email: String(email).trim().toLowerCase(),
    password,
    phone: "",
    location: "",
    description: "",
    profilePicture: "",
    userType: normalizedTypes,
    preferences: {
      emailNotifications: true,
      messageNotifications: true,
      newRequestNotifications: true
    },
    active: true
  };

  db.users[id] = newUser;
  saveDb(db);

  return res.status(201).json(buildLoginResponse(newUser));
});

app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "A valid email is required" });
  }

  const user = Object.values(db.users).find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "No account found for that email" });
  }

  if (!user.active) {
    return res.status(403).json({ success: false, message: "Account is deactivated" });
  }

  const resetToken = `reset_${generateId("token")}`;
  passwordResetTokens.set(resetToken, {
    userId: user.id,
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  return res.json({ success: true, resetToken });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, newPassword } = req.body || {};
  const userId = getUserIdByResetToken(token);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 chars and include uppercase, lowercase, number, and special character"
    });
  }

  const user = db.users[userId];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.password = String(newPassword);
  passwordResetTokens.delete(token);
  saveDb(db);
  return res.json({ success: true });
});

app.get("/api/auth/user/:id", (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json(sanitizeUser(user));
});

app.put("/api/auth/user/:id", (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const allowed = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "location",
    "description",
    "profilePicture",
    "preferences"
  ];

  const updatedEmail = req.body?.email;
  if (typeof updatedEmail !== "undefined") {
    if (!isValidEmail(updatedEmail)) {
      return res.status(400).json({ success: false, message: "Email format is invalid" });
    }

    const emailTaken = Object.values(db.users).some(
      (candidate) => candidate.id !== user.id && candidate.email.toLowerCase() === String(updatedEmail).trim().toLowerCase()
    );
    if (emailTaken) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
  }

  if (typeof req.body?.firstName !== "undefined" && !isNonEmptyString(req.body.firstName)) {
    return res.status(400).json({ success: false, message: "First name cannot be empty" });
  }

  if (typeof req.body?.lastName !== "undefined" && !isNonEmptyString(req.body.lastName)) {
    return res.status(400).json({ success: false, message: "Last name cannot be empty" });
  }

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      if (key === "email") {
        user[key] = String(req.body[key]).trim().toLowerCase();
      } else {
        user[key] = req.body[key];
      }
    }
  }

  saveDb(db);

  return res.json({ success: true, user: sanitizeUser(user) });
});

app.post("/api/auth/change-password", (req, res) => {
  const { userId, currentPassword, newPassword } = req.body || {};
  const user = db.users[userId];

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.password !== currentPassword) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 chars and include uppercase, lowercase, number, and special character"
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({ success: false, message: "New password must be different from current password" });
  }

  user.password = newPassword;
  saveDb(db);
  return res.json({ success: true });
});

app.put("/api/auth/user/:id/deactivate", (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.active = false;
  saveDb(db);
  return res.json({ success: true });
});

app.delete("/api/auth/user/:id", (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { password } = req.body || {};
  if (user.password !== password) {
    return res.status(401).json({ success: false, message: "Password is incorrect" });
  }

  delete db.users[req.params.id];
  saveDb(db);
  return res.json({ success: true });
});

app.get("/api/cart/:sessionId", (req, res) => {
  const cart = getCart(req.params.sessionId);
  const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  res.json({
    sessionId: cart.sessionId,
    items: cart.items,
    subtotal
  });
});

app.post("/api/cart/:sessionId/items", (req, res) => {
  const cart = getCart(req.params.sessionId);
  const { productId, quantity, textDetails, unitPrice } = req.body || {};

  if (!isNonEmptyString(productId)) {
    return res.status(400).json({ success: false, message: "Product ID is required" });
  }

  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = Number(unitPrice);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
  }

  if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
    return res.status(400).json({ success: false, message: "Unit price must be a positive number" });
  }

  if (typeof textDetails !== "undefined" && (textDetails === null || typeof textDetails !== "object" || Array.isArray(textDetails))) {
    return res.status(400).json({ success: false, message: "Text details must be an object" });
  }

  const item = {
    id: generateId("cartitem"),
    productId,
    quantity: parsedQuantity,
    textDetails: textDetails || {},
    unitPrice: parsedUnitPrice
  };

  cart.items.push(item);
  saveDb(db);
  return res.status(201).json({ success: true, item, items: cart.items });
});

app.put("/api/cart/:sessionId/items/:itemId", (req, res) => {
  const cart = getCart(req.params.sessionId);
  const item = cart.items.find((i) => i.id === req.params.itemId);

  if (!item) {
    return res.status(404).json({ success: false, message: "Cart item not found" });
  }

  const { quantity, textDetails } = req.body || {};
  if (typeof quantity !== "undefined") {
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
    }
    item.quantity = parsedQuantity;
  }
  if (typeof textDetails !== "undefined") {
    if (textDetails === null || typeof textDetails !== "object" || Array.isArray(textDetails)) {
      return res.status(400).json({ success: false, message: "Text details must be an object" });
    }
    item.textDetails = textDetails;
  }

  saveDb(db);

  return res.json({ success: true, item, items: cart.items });
});

app.delete("/api/cart/:sessionId/items/:itemId", (req, res) => {
  const cart = getCart(req.params.sessionId);
  const initialLength = cart.items.length;
  cart.items = cart.items.filter((i) => i.id !== req.params.itemId);

  if (cart.items.length === initialLength) {
    return res.status(404).json({ success: false, message: "Cart item not found" });
  }

  saveDb(db);

  return res.json({ success: true, items: cart.items });
});

app.post("/api/orders/checkout/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const cart = getCart(sessionId);

  if (!cart.items.length) {
    return res.status(400).json({ success: false, message: "Cart is empty" });
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingCost = Number(req.body?.shippingCost || 0);
  const taxRate = Number(req.body?.taxRate || 0.1);

  if (!Number.isFinite(shippingCost) || shippingCost < 0) {
    return res.status(400).json({ success: false, message: "Shipping cost is invalid" });
  }

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 1" });
  }

  const payment = req.body?.payment || {};
  const delivery = req.body?.delivery || {};
  const requiredDeliveryFields = ["fullName", "phone", "addressLine1", "city", "postalCode"];
  for (const field of requiredDeliveryFields) {
    if (!isNonEmptyString(delivery[field])) {
      return res.status(400).json({ success: false, message: `Delivery field '${field}' is required` });
    }
  }

  if (!isNonEmptyString(payment.cardholderName) || !isNonEmptyString(payment.cardLast4)) {
    return res.status(400).json({ success: false, message: "Payment details are incomplete" });
  }

  const taxAmount = (subtotal + shippingCost) * taxRate;
  const total = subtotal + shippingCost + taxAmount;

  const order = {
    id: generateId("order"),
    orderNumber: generateOrderNumber(),
    sessionId,
    items: cart.items,
    payment,
    delivery,
    subtotal,
    shippingCost,
    taxAmount,
    total,
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);
  cart.items = [];
  saveDb(db);

  return res.status(201).json({ success: true, order });
});

app.get("/api/marketplace", (_req, res) => {
  const listings = (db.threads || []).map((thread) => {
    const replies = (db.replies || []).filter((reply) => reply.threadId === thread.id);
    const priceOffers = replies
      .filter((reply) => Number.isFinite(Number(reply.price)) && Number(reply.price) > 0)
      .sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
    const latestOffer = priceOffers[0];

    return {
      id: thread.id,
      title: thread.title,
      description: thread.content,
      author: thread.author,
      image: thread.image || "",
      status: thread.status || "Open",
      postedAt: thread.posted_at,
      offerCount: replies.length,
      price: latestOffer ? Number(latestOffer.price) : null
    };
  });

  res.json({ success: true, listings });
});

// ==========================================
// --- DISCUSSION FORUM API ROUTES ---
// ==========================================

// 1. GET /api/threads - Fetch all threads (Supports Search by title/content, Filter by status, & Sorting)
app.get("/api/threads", (req, res) => {
  let results = [...(db.threads || [])];
  const { title, content, status, sort } = req.query;

  // Search by Title
  if (isNonEmptyString(title)) {
    results = results.filter((t) =>
      t.title.toLowerCase().includes(title.trim().toLowerCase())
    );
  }

  // Search by Content
  if (isNonEmptyString(content)) {
    results = results.filter((t) =>
      t.content.toLowerCase().includes(content.trim().toLowerCase())
    );
  }

  // Filter by Status (Open, Negotiating, Resolved, Closed, etc.)
  if (isNonEmptyString(status)) {
    results = results.filter(
      (t) => t.status.toLowerCase() === status.trim().toLowerCase()
    );
  }

  // Sorting logic
  if (sort === "oldest") {
    results.sort((a, b) => new Date(a.posted_at) - new Date(b.posted_at));
  } else if (sort === "title_asc") {
    results.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "title_desc") {
    results.sort((a, b) => b.title.localeCompare(a.title));
  } else {
    // Default: Newest first
    results.sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
  }

  res.json({ success: true, count: results.length, threads: results });
});

// 2. GET /api/threads/:id - Fetch single thread details along with its replies
app.get("/api/threads/:id", (req, res) => {
  const thread = (db.threads || []).find((t) => t.id === req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  const threadReplies = (db.replies || []).filter(
    (r) => r.threadId === req.params.id
  );
  
  // Sort replies chronologically (oldest to newest for smooth reading)
  threadReplies.sort((a, b) => new Date(a.posted_at) - new Date(b.posted_at));

  res.json({
    success: true,
    thread: {
      ...thread,
      replies: threadReplies
    }
  });
});

// Temporary login middleware for the Discussion Forum.
// Later, replace this with the real User Account authentication.
function requireLogin(req, res, next) {
    req.user = {
        userId: "u001",
        username: "Alex_Student"
    };

    next();
}

app.use("/api/threads", requireLogin);

// 3. POST /api/threads - Create a new thread
app.post("/api/threads", (req, res) => {
  const { title, content, image, status } = req.body || {};
  
  // Lấy author từ req.body.author HOẶC req.body.authorName (mặc định "Anonymous" nếu trống)
  const author = String(req.body.author || req.body.authorName || "Anonymous").trim();

  if (!isNonEmptyString(title) || title.trim().length < 5) {
    return res.status(400).json({ success: false, message: "Title must be at least 5 characters" });
  }
  if (!isNonEmptyString(content) || content.trim().length < 10) {
    return res.status(400).json({ success: false, message: "Content must be at least 10 characters" });
  }

  const id = generateId("thread");
  const newThread = {
    id,
    author,
    title: title.trim(),
    content: content.trim(),
    posted_at: new Date().toISOString(),
    image: image || "",
    status: status || "Open",
    replyCount: 0
  };

  if (!db.threads) db.threads = [];
  db.threads.push(newThread);
  saveDb(db);

  return res.status(201).json({ success: true, thread: newThread });
});

// 4. PUT /api/threads/:id - Update an existing thread
app.put("/api/threads/:id", (req, res) => {
  const thread = (db.threads || []).find((t) => t.id === req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  const { title, content, image, status } = req.body || {};

  if (typeof title !== "undefined") {
    if (!isNonEmptyString(title) || title.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Title must be at least 5 characters" });
    }
    thread.title = title.trim();
  }

  if (typeof content !== "undefined") {
    if (!isNonEmptyString(content) || content.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Content must be at least 10 characters" });
    }
    thread.content = content.trim();
  }

  if (typeof image !== "undefined") thread.image = image;
  if (typeof status !== "undefined") thread.status = status;

  saveDb(db);
  return res.json({ success: true, thread });
});

// 5. DELETE /api/threads/:id - Delete a thread and cascade delete all its associated replies
app.delete("/api/threads/:id", (req, res) => {
  const initialLength = (db.threads || []).length;
  db.threads = (db.threads || []).filter((t) => t.id !== req.params.id);

  if (db.threads.length === initialLength) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  // Cascade delete related replies
  db.replies = (db.replies || []).filter((r) => r.threadId !== req.params.id);

  saveDb(db);
  return res.json({ success: true, message: "Thread and all associated replies deleted successfully" });
});

// 6. POST /api/threads/:id/replies - Post a reply / quote offer under a thread
app.post("/api/threads/:id/replies", (req, res) => {
  const thread = (db.threads || []).find((t) => t.id === req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  const { author, title, content, price, image } = req.body || {};

  if (!isNonEmptyString(author)) {
    return res.status(400).json({ success: false, message: "Author is required" });
  }
  if (!isNonEmptyString(title)) {
    return res.status(400).json({ success: false, message: "Reply title is required" });
  }
  if (!isNonEmptyString(content)) {
    return res.status(400).json({ success: false, message: "Reply content is required" });
  }

  const parsedPrice = price !== undefined ? Number(price) : 0;
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ success: false, message: "Price must be a valid non-negative number" });
  }

  const newReply = {
    id: generateId("reply"),
    threadId: req.params.id,
    author: author.trim(),
    title: title.trim(),
    content: content.trim(),
    price: parsedPrice,
    posted_at: new Date().toISOString(),
    image: image || ""
  };

  if (!db.replies) db.replies = [];
  db.replies.push(newReply);
  
  // Increment thread reply count
  thread.replyCount = (thread.replyCount || 0) + 1;

  saveDb(db);
  return res.status(201).json({ success: true, reply: newReply });
});

// 7. PUT /api/replies/:replyId - Update a reply / quote offer
app.put("/api/replies/:replyId", (req, res) => {
  const reply = (db.replies || []).find((r) => r.id === req.params.replyId);
  if (!reply) {
    return res.status(404).json({ success: false, message: "Reply not found" });
  }

  const { title, content, price, image } = req.body || {};

  if (typeof title !== "undefined") {
    if (!isNonEmptyString(title)) {
      return res.status(400).json({ success: false, message: "Reply title cannot be empty" });
    }
    reply.title = title.trim();
  }

  if (typeof content !== "undefined") {
    if (!isNonEmptyString(content)) {
      return res.status(400).json({ success: false, message: "Reply content cannot be empty" });
    }
    reply.content = content.trim();
  }

  if (typeof price !== "undefined") {
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: "Price must be a valid non-negative number" });
    }
    reply.price = parsedPrice;
  }

  if (typeof image !== "undefined") reply.image = image;

  saveDb(db);
  return res.json({ success: true, reply });
});

// 8. DELETE /api/replies/:replyId - Delete a single reply
app.delete("/api/replies/:replyId", (req, res) => {
  const reply = (db.replies || []).find((r) => r.id === req.params.replyId);
  if (!reply) {
    return res.status(404).json({ success: false, message: "Reply not found" });
  }

  // Decrement thread reply count
  const thread = (db.threads || []).find((t) => t.id === reply.threadId);
  if (thread && thread.replyCount > 0) {
    thread.replyCount -= 1;
  }

  db.replies = db.replies.filter((r) => r.id !== req.params.replyId);

  saveDb(db);
  return res.json({ success: true, message: "Reply deleted successfully" });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
