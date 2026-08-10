require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { db, generateId, generateOrderNumber, saveDb } = require("./data/db");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
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
  const { email, password } = req.body || {};
  const user = Object.values(db.users).find((u) => u.email === email);

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  if (!user.active) {
    return res.status(403).json({ success: false, message: "Account is deactivated" });
  }

  return res.json({
    success: true,
    user: sanitizeUser(user),
    token: `token_${user.id}_${Date.now()}`
  });
});

app.post("/api/auth/register", (req, res) => {
  const { firstName, lastName, email, password, userType } = req.body || {};

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const existing = Object.values(db.users).find((u) => u.email === email);
  if (existing) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const id = generateId("user");
  const newUser = {
    id,
    firstName,
    lastName,
    username: `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    email,
    password,
    phone: "",
    location: "",
    description: "",
    profilePicture: "",
    userType: Array.isArray(userType) ? userType : [userType || "poster"],
    preferences: {
      emailNotifications: true,
      messageNotifications: true,
      newRequestNotifications: true
    },
    active: true
  };

  db.users[id] = newUser;
  saveDb(db);

  return res.status(201).json({
    success: true,
    user: sanitizeUser(newUser),
    token: `token_${id}_${Date.now()}`
  });
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

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      user[key] = req.body[key];
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

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
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

  if (!productId || !quantity || !unitPrice) {
    return res.status(400).json({ success: false, message: "Missing required item fields" });
  }

  const item = {
    id: generateId("cartitem"),
    productId,
    quantity: Number(quantity),
    textDetails: textDetails || {},
    unitPrice: Number(unitPrice)
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
    item.quantity = Number(quantity);
  }
  if (typeof textDetails !== "undefined") {
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
  const taxAmount = (subtotal + shippingCost) * taxRate;
  const total = subtotal + shippingCost + taxAmount;

  const order = {
    id: generateId("order"),
    orderNumber: generateOrderNumber(),
    sessionId,
    items: cart.items,
    payment: req.body?.payment || {},
    delivery: req.body?.delivery || {},
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

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
