require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { db, generateId, generateOrderNumber, initializeDb, saveDb, insertOneDocument, updateOneDocument } = require("./data/db");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const passwordResetTokens = new Map();
const activeSessions = new Map();
const SESSION_COOKIE_NAME = "rshop_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (!cloudinaryConfigured && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\.-]/g, "");
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: cloudinaryConfigured ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  }
});

function uploadImage(file) {
  if (!cloudinaryConfigured) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "rshop" },
      (error, result) => (error ? reject(error) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });
}

async function getUploadedImageUrl(req, file) {
  if (!file) return "";
  if (cloudinaryConfigured) return uploadImage(file);
  return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, "..", "..")));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.json());

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "homepage", "homepage.html"));
});

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

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    const name = separator >= 0 ? part.slice(0, separator).trim() : part.trim();
    const value = separator >= 0 ? part.slice(separator + 1).trim() : "";
    return [name, decodeURIComponent(value)];
  }));
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/"
  };
}

function serializeSessionCookie(value, options = {}) {
  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  activeSessions.set(sessionId, { userId, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  return sessionId;
}

function getSessionId(req) {
  return parseCookies(req)[SESSION_COOKIE_NAME] || "";
}

function buildLoginResponse(user) {
const safeUser = sanitizeUser(user);
const sessionId = createSession(user.id);
return {
success: true,
user: {
...safeUser,
_id: safeUser.id,
role: safeUser.userType?.[0] || "poster"
},
sessionId
};
}
function getUserBySessionId(sessionId) {
if (!isNonEmptyString(sessionId)) return null;
const session = activeSessions.get(sessionId.trim());
if (!session) return null;
if (Date.now() > session.expiresAt) {
  activeSessions.delete(sessionId.trim());
  return null;
}
return db.users[session.userId] || null;
}

// Temporary compatibility for clients that still send the old bearer token.
function getUserByToken(token) {
if (!isNonEmptyString(token)) return null;
return getUserBySessionId(token);
}

function getUserFromRequest(req) {
  const cookieUser = getUserBySessionId(getSessionId(req));
  if (cookieUser) return cookieUser;
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  return getUserByToken(token);
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

function validateBlogFields(body, partial = false) {
  const requiredFields = ["title", "dateAdded", "category", "summary", "content"];
  if (!partial) {
    for (const field of requiredFields) {
      if (!isNonEmptyString(body[field])) return `The ${field} field is required`;
    }
  }
  if (body.title !== undefined && (!isNonEmptyString(body.title) || body.title.trim().length < 5)) {
    return "Title must be at least 5 characters";
  }
  if (body.summary !== undefined && !isNonEmptyString(body.summary)) return "Summary is required";
  if (body.content !== undefined && !isNonEmptyString(body.content)) return "Content is required";
  if (body.tags !== undefined && !Array.isArray(body.tags)) return "Tags must be an array";
  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.get("/api/blogs", (_req, res) => {
  const blogs = (db.blogs || [])
    .filter((blog) => blog.deleted !== true)
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  return res.json({ success: true, count: blogs.length, blogs });
});

app.get("/api/blogs/:id", (req, res) => {
  const blog = (db.blogs || []).find((item) => item.id === req.params.id && item.deleted !== true);
  if (!blog) return res.status(404).json({ success: false, message: "Blog post not found" });
  return res.json({ success: true, blog });
});

app.post("/api/blogs", requireLogin, (req, res) => {
  const body = req.body || {};
  const validationError = validateBlogFields(body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  const blog = {
    id: generateId("blog"),
    // `authorId` is the real foreign key into USERS.id, matching the
    // DATABASE_SCHEMA.md diagram. `authorName` is kept as a denormalised
    // display name so the frontend doesn't need an extra user lookup.
    authorId: req.user.userId,
    authorName: req.user.username,
    title: body.title.trim(),
    dateAdded: body.dateAdded,
    category: body.category,
    tags: body.tags || [],
    image: body.image || "",
    summary: body.summary.trim(),
    content: body.content.trim(),
    deleted: false
  };
  db.blogs.push(blog);
  saveDb(db);
  return res.status(201).json({ success: true, blog });
});

app.put("/api/blogs/:id", requireLogin, (req, res) => {
  const blog = (db.blogs || []).find((item) => item.id === req.params.id && item.deleted !== true);
  if (!blog) return res.status(404).json({ success: false, message: "Blog post not found" });
  const isBlogOwner = blog.authorId
    ? String(blog.authorId) === String(req.user.userId)
    : blog.authorName === req.user.username; // legacy fallback for pre-migration records
  if (!isBlogOwner) {
    return res.status(403).json({ success: false, message: "You can only edit your own blog posts" });
  }
  const validationError = validateBlogFields(req.body || {}, true);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  const allowedFields = ["title", "dateAdded", "category", "tags", "image", "summary", "content"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) blog[field] = field === "title" || field === "summary" || field === "content"
      ? req.body[field].trim()
      : req.body[field];
  }
  saveDb(db);
  return res.json({ success: true, blog });
});

app.delete("/api/blogs/:id", requireLogin, (req, res) => {
  const blog = (db.blogs || []).find((item) => item.id === req.params.id && item.deleted !== true);
  if (!blog) return res.status(404).json({ success: false, message: "Blog post not found" });
  const isBlogOwner = blog.authorId
    ? String(blog.authorId) === String(req.user.userId)
    : blog.authorName === req.user.username; // legacy fallback for pre-migration records
  if (!isBlogOwner) {
    return res.status(403).json({ success: false, message: "You can only delete your own blog posts" });
  }
  blog.deleted = true;
  blog.deleted_at = new Date().toISOString();
  saveDb(db);
  return res.json({ success: true, message: "Blog post deleted successfully" });
});

app.post("/api/auth/logout", (req, res) => {
const sessionId = getSessionId(req);
if (sessionId) activeSessions.delete(sessionId);
const authHeader = req.headers["authorization"] || "";
const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
if (token) activeSessions.delete(token);
res.setHeader("Set-Cookie", serializeSessionCookie("", { ...sessionCookieOptions(), maxAge: 0 }));
return res.json({ success: true });
});

app.get("/api/auth/session", (req, res) => {
  const user = getUserFromRequest(req);
  if (!user || !user.active) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  return res.json({ success: true, user: { ...sanitizeUser(user), _id: user.id, role: user.userType?.[0] || "poster" } });
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

  const response = buildLoginResponse(user);
  res.setHeader("Set-Cookie", serializeSessionCookie(response.sessionId, sessionCookieOptions()));
  delete response.sessionId;
  return res.json(response);
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

  const response = buildLoginResponse(newUser);
  res.setHeader("Set-Cookie", serializeSessionCookie(response.sessionId, sessionCookieOptions()));
  delete response.sessionId;
  return res.status(201).json(response);
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

app.get("/api/auth/user/:id", requireLogin, (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json(sanitizeUser(user));
});

app.put("/api/auth/user/:id", requireLogin, (req, res) => {
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

app.post("/api/auth/change-password", requireLogin, (req, res) => {
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

app.put("/api/auth/user/:id/deactivate", requireLogin, (req, res) => {
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.active = false;
  saveDb(db);
  return res.json({ success: true });
});

app.delete("/api/auth/user/:id", requireLogin, (req, res) => {
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

// GET /api/marketplace - Build request/proposal listings from threads + their replies
app.get("/api/marketplace", (req, res) => {
  const listings = (db.threads || []).map((thread) => {
    const replies = (db.replies || []).filter((r) => r.threadId === thread.id);
    const offers = replies.filter((r) => typeof r.price === "number");
    const latestOffer = offers.length
      ? offers.reduce((latest, r) => (new Date(r.posted_at) > new Date(latest.posted_at) ? r : latest))
      : null;

    return {
      id: thread.id,
      title: thread.title,
      author: thread.author,
      description: thread.content,
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
  const { title, content, status, sort } = req.query;

  // Only return active / publicly visible threads.
  let results = (db.threads || []).filter((thread) => thread.deleted !== true);

  /*
   * Build a lookup of visible replies for:
   * - searching reply content
   * - calculating latest activity
   * - calculating oldest/latest post date
   */
  const visibleReplies = (db.replies || []).filter(
    (reply) => reply.deleted !== true
  );

  // Search by thread title.
  if (isNonEmptyString(title)) {
    const keyword = title.trim().toLowerCase();

    results = results.filter((thread) =>
      String(thread.title || "").toLowerCase().includes(keyword)
    );
  }

  // Search by text content in either:
  // 1. the thread itself
  // 2. any visible reply belonging to that thread
  if (isNonEmptyString(content)) {
    const keyword = content.trim().toLowerCase();

    results = results.filter((thread) => {
      const threadMatches = String(thread.content || "")
        .toLowerCase()
        .includes(keyword);

      if (threadMatches) return true;

      return visibleReplies.some(
        (reply) =>
          reply.threadId === thread.id &&
          (
            String(reply.title || "").toLowerCase().includes(keyword) ||
            String(reply.content || "").toLowerCase().includes(keyword)
          )
      );
    });
  }

  // Filter by thread status.
  if (isNonEmptyString(status)) {
    const normalizedStatus = status.trim().toLowerCase();

    results = results.filter(
      (thread) =>
        String(thread.status || "Open").trim().toLowerCase() ===
        normalizedStatus
    );
  }

  /*
   * Add latest / oldest activity timestamps without changing
   * the stored thread document permanently.
   *
   * Requirement:
   * sort by the date of the most recent post
   * and date of the oldest post.
   */
  results = results.map((thread) => {
    const threadDate = new Date(thread.posted_at);

    const replyDates = visibleReplies
      .filter((reply) => reply.threadId === thread.id)
      .map((reply) => new Date(reply.posted_at))
      .filter((date) => !Number.isNaN(date.getTime()));

    const allDates = [threadDate, ...replyDates].filter(
      (date) => !Number.isNaN(date.getTime())
    );

    const oldestPostAt = allDates.length
      ? new Date(Math.min(...allDates.map((date) => date.getTime()))).toISOString()
      : thread.posted_at;

    const latestPostAt = allDates.length
      ? new Date(Math.max(...allDates.map((date) => date.getTime()))).toISOString()
      : thread.posted_at;

    const visibleReplyCount = visibleReplies.filter(
      (reply) => reply.threadId === thread.id
    ).length;

    return {
      ...thread,
      replyCount: visibleReplyCount,
      oldestPostAt,
      latestPostAt
    };
  });

  // Sorting.
  if (sort === "oldest") {
    results.sort(
      (a, b) =>
        new Date(a.oldestPostAt) - new Date(b.oldestPostAt)
    );
  } else if (sort === "title_asc") {
    results.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""))
    );
  } else if (sort === "title_desc") {
    results.sort((a, b) =>
      String(b.title || "").localeCompare(String(a.title || ""))
    );
  } else {
    // Default: newest activity first.
    results.sort(
      (a, b) =>
        new Date(b.latestPostAt) - new Date(a.latestPostAt)
    );
  }

  return res.json({
    success: true,
    count: results.length,
    threads: results
  });
});

// 2. GET /api/threads/:id - Fetch single thread details along with its replies
app.get("/api/threads/:id", (req, res) => {
  const thread = (db.threads || []).find(
    (t) => t.id === req.params.id && t.deleted !== true
  );

  if (!thread) {
    return res.status(404).json({
      success: false,
      message: "Thread not found"
    });
  }

  const threadReplies = (db.replies || [])
    .filter(
      (reply) =>
        reply.threadId === req.params.id &&
        reply.deleted !== true
    )
    .sort(
      (a, b) =>
        new Date(a.posted_at) - new Date(b.posted_at)
    );

  return res.json({
    success: true,
    thread: {
      ...thread,
      replies: threadReplies,
      replyCount: threadReplies.length
    }
  });
});

// Temporary login middleware for the Discussion Forum.
// Later, replace this with the real User Account authentication (shared module).
// For now the client sends the currently logged-in user's username in the
// "x-username" header (see apiRequest() in Discussion_forum.js), so that
// ownership checks below can compare it against thread.author / reply.author.
// Real login middleware for the Discussion Forum, wired to the shared
// User Account module's login/register sessions (see activeSessions above).
function requireLogin(req, res, next) {
const user = getUserFromRequest(req);
if (!user) {
return res.status(401).json({ success: false, message: "You must be logged in to do this." });
}
if (!user.active) {
return res.status(403).json({ success: false, message: "Your account is deactivated." });
}
req.user = { userId: user.id, username: user.username };
next();
}

// Applied to both /api/threads and /api/replies so req.user (and therefore
// ownership checks) is available on every discussion-forum route.
app.use(["/api/threads", "/api/replies"], requireLogin);

// Helper: checks whether the currently logged-in user (req.user) owns the
// given resource (a thread or a reply).
//
// Ownership is now decided by the real foreign key `authorId` (which stores
// USERS.id), not by comparing display names. This makes THREADS/REPLIES a
// proper FK relationship to USERS instead of a "logical link" by username.
//
// The username fallback is kept only for backward compatibility with any
// records created before this change (which only had `author`, no
// `authorId`) so existing data doesn't suddenly become unowned.
function isOwner(req, resource) {
    if (!resource || !req.user) return false;

    if (resource.authorId) {
        return String(resource.authorId) === String(req.user.userId);
    }

    // Legacy fallback for pre-migration records.
    return String(resource.author || "").trim().toLowerCase() ===
        String(req.user.username || "").trim().toLowerCase();
}

// 3. POST /api/threads - Create a new thread
app.post("/api/threads", upload.single("image"), async (req, res) => {
  const { title, content, status } = req.body || {};

  // Author is always the currently authenticated user (from requireLogin),
  // never a value the client sends in the body - otherwise anyone could
  // post a thread pretending to be someone else.
  //
  // `authorId` is the real foreign key into USERS.id and is what ownership
  // checks (isOwner) rely on. `author` is kept as a denormalised display
  // name so the frontend doesn't have to look up the username separately.
  const authorId = req.user && req.user.userId;
  const author = req.user && req.user.username;

  if (!isNonEmptyString(title) || title.trim().length < 5) {
    return res.status(400).json({ success: false, message: "Title must be at least 5 characters" });
  }
  if (!isNonEmptyString(content) || content.trim().length < 10) {
    return res.status(400).json({ success: false, message: "Content must be at least 10 characters" });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "An image is required for every post"
    });
  }

  const imageUrl = await getUploadedImageUrl(req, req.file);

  const id = generateId("thread");
  const newThread = {
  id,
  authorId,
  author,
  title: title.trim(),
  content: content.trim(),
  posted_at: new Date().toISOString(),
  image: imageUrl || "",
  status: status || "Open",
  replyCount: 0,

  // Soft-delete / audit fields.
  deleted: false,
  deleted_at: null,
  deleted_by: null
};

  if (!db.threads) db.threads = [];
  db.threads.push(newThread);

  try {
    await insertOneDocument("threads", newThread);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save thread to database" });
  }

  return res.status(201).json({ success: true, thread: newThread });
});

// 4. PUT /api/threads/:id - Update an existing thread
app.put("/api/threads/:id", upload.single("image"), async (req, res) => {
  const thread = (db.threads || []).find(
  (t) => t.id === req.params.id && t.deleted !== true
);
  if (!thread) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  // Ownership check: only the original author may edit their own thread.
  if (!isOwner(req, thread)) {
    return res.status(403).json({ success: false, message: "You can only edit your own posts" });
  }

  const { title, content, status } = req.body || {};

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

  if (req.file) {
    thread.image = await getUploadedImageUrl(req, req.file);
  } else if (typeof req.body.image !== "undefined") {
    thread.image = req.body.image || "";
  }
  if (typeof status !== "undefined") thread.status = status;

  try {
    await updateOneDocument("threads", thread.id, thread);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update thread in database" });
  }

  return res.json({ success: true, thread });
});

// 5. DELETE /api/threads/:id - Delete a thread and cascade delete all its associated replies
app.delete("/api/threads/:id", async (req, res) => {
  const thread = (db.threads || []).find(
    (t) => t.id === req.params.id && t.deleted !== true
  );

  if (!thread) {
    return res.status(404).json({
      success: false,
      message: "Thread not found"
    });
  }

  // Only the original author may delete their own thread.
  if (!isOwner(req, thread)) {
    return res.status(403).json({
      success: false,
      message: "You can only delete your own posts"
    });
  }

  /*
   * SOFT DELETE
   * Keep the original document in the database for auditing.
   * The public GET APIs filter deleted=true.
   */
  thread.deleted = true;
  thread.deleted_at = new Date().toISOString();
  thread.deleted_by = req.user.username;

  /*
   * Soft-delete associated replies as well.
   * They remain in the database for audit purposes.
   */
  const repliesToSoftDelete = (db.replies || []).filter(
    (reply) => reply.threadId === req.params.id && reply.deleted !== true
  );
  repliesToSoftDelete.forEach((reply) => {
    reply.deleted = true;
    reply.deleted_at = new Date().toISOString();
    reply.deleted_by = req.user.username;
  });

  thread.replyCount = 0;

  try {
    // One updateOne() per affected document (the thread + each cascaded reply)
    // instead of rewriting the entire threads/replies collections.
    await updateOneDocument("threads", thread.id, thread);
    await Promise.all(
      repliesToSoftDelete.map((reply) => updateOneDocument("replies", reply.id, reply))
    );
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete thread in database" });
  }

  return res.json({
    success: true,
    message: "Thread deleted successfully"
  });
});

// 6. POST /api/threads/:id/replies - Post a reply / quote offer under a thread
app.post("/api/threads/:id/replies", upload.single("image"), async (req, res) => {
  const thread = (db.threads || []).find(
    (t) => t.id === req.params.id && t.deleted !== true
  );
  if (!thread) {
    return res.status(404).json({ success: false, message: "Thread not found" });
  }

  const { title, content, price } = req.body || {};
  // Author is always the currently authenticated user (from requireLogin),
  // never a value the client sends in the body.
  //
  // `authorId` is the real foreign key into USERS.id and is what ownership
  // checks (isOwner) rely on. `author` is kept as a denormalised display
  // name so the frontend doesn't have to look up the username separately.
  const authorId = req.user.userId;
  const author = req.user.username;
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

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "An image is required for every reply"
    });
  }

  const imageUrl = await getUploadedImageUrl(req, req.file);

  const newReply = {
  id: generateId("reply"),
  threadId: req.params.id,
  authorId,
  author: author.trim(),
  title: title.trim(),
  content: content.trim(),
  price: parsedPrice,
  posted_at: new Date().toISOString(),
  image: imageUrl || "",

  // Soft-delete / audit fields.
  deleted: false,
  deleted_at: null,
  deleted_by: null
};

  if (!db.replies) db.replies = [];
  db.replies.push(newReply);
  
  // Increment thread reply count
  thread.replyCount = (thread.replyCount || 0) + 1;
  if (parsedPrice > 0 && (thread.status || "Open").toLowerCase() === "open") {
  thread.status = "Negotiating";
}

  try {
    await insertOneDocument("replies", newReply);
    // Persist the thread separately since replyCount/status changed on it too.
    await updateOneDocument("threads", thread.id, thread);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save reply to database" });
  }

  return res.status(201).json({ success: true, reply: newReply });
});

// 7. PUT /api/replies/:replyId - Update a reply / quote offer
app.put("/api/replies/:replyId", upload.single("image"), async (req, res) => {
  const reply = (db.replies || []).find(
  (r) => r.id === req.params.replyId && r.deleted !== true
);
  if (!reply) {
    return res.status(404).json({ success: false, message: "Reply not found" });
  }

  // Ownership check: only the original author may edit their own reply.
  if (!isOwner(req, reply)) {
    return res.status(403).json({ success: false, message: "You can only edit your own replies" });
  }

  const { title, content, price } = req.body || {};

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

  if (req.file) {
    reply.image = await getUploadedImageUrl(req, req.file);
  } else if (typeof req.body.image !== "undefined") {
    reply.image = req.body.image || "";
  }

  try {
    await updateOneDocument("replies", reply.id, reply);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update reply in database" });
  }

  return res.json({ success: true, reply });
});

// 8. DELETE /api/replies/:replyId - Delete a single reply
app.delete("/api/replies/:replyId", async (req, res) => {
  const reply = (db.replies || []).find(
    (r) => r.id === req.params.replyId && r.deleted !== true
  );

  if (!reply) {
    return res.status(404).json({
      success: false,
      message: "Reply not found"
    });
  }

  // Only the original author may delete their own reply.
  if (!isOwner(req, reply)) {
    return res.status(403).json({
      success: false,
      message: "You can only delete your own replies"
    });
  }

  /*
   * SOFT DELETE
   * Keep the reply in the database for auditing,
   * but exclude it from all public forum responses.
   */
  reply.deleted = true;
  reply.deleted_at = new Date().toISOString();
  reply.deleted_by = req.user.username;

  const thread = (db.threads || []).find(
    (t) => t.id === reply.threadId && t.deleted !== true
  );

  if (thread) {
    const visibleReplyCount = (db.replies || []).filter(
      (r) =>
        r.threadId === reply.threadId &&
        r.deleted !== true
    ).length;

    thread.replyCount = visibleReplyCount;
  }

  try {
    // Soft-delete is just an updateOne with $set: { deleted: true, ... }.
    await updateOneDocument("replies", reply.id, reply);
    if (thread) {
      await updateOneDocument("threads", thread.id, thread);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete reply in database" });
  }

  return res.json({
    success: true,
    message: "Reply deleted successfully"
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

initializeDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  });