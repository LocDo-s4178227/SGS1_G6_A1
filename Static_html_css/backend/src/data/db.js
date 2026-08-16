const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DB = {
  users: {
    user_001: {
      id: "user_001",
      firstName: "Demo",
      lastName: "User",
      username: "demouser",
      email: "demo@example.com",
      password: "demo123",
      phone: "+1 (555) 010-2244",
      location: "Seattle, WA",
      description: "I post custom furniture requests and compare proposals from local professionals.",
      profilePicture: "",
      preferences: {
        emailNotifications: true,
        messageNotifications: true,
        newRequestNotifications: true
      },
      active: true
    },
    admin_001: {
      id: "admin_001",
      firstName: "System",
      lastName: "Administrator",
      username: "admin",
      email: "admin@webreview.vn",
      password: "Admin#Pass1",
      phone: "",
      location: "",
      description: "Platform administrator",
      profilePicture: "",
      userType: ["admin"],
      preferences: {
        emailNotifications: true,
        messageNotifications: true,
        newRequestNotifications: true
      },
      active: true
    }
  },
  carts: {},
  orders: [],
  threads: [],
  replies: [],
  blogs: [
    {
      id: "blog_001",
      title: "Shopee Vietnam UX Review",
      authorId: "user_001",
      author: "Demo User",
      date: "2026-07-18",
      category: "design",
      tags: ["ux", "ecommerce"],
      image: "https://picsum.photos/seed/shopee-ux/900/420",
      summary: "A bilingual look at navigation patterns, checkout friction, and mobile-first design choices.",
      content: "Shopee delivers a polished mobile-first experience tuned for the Vietnamese market.",
      createdAt: "2026-07-18T10:45:00.000Z",
      updatedAt: "2026-07-18T10:45:00.000Z"
    }
  ],
  reviews: [],
  wishlists: {}
};

const DATA_FILE = path.join(__dirname, "db.json");

function loadDb() {
  if (!fs.existsSync(DATA_FILE)) {
    return structuredClone(DEFAULT_DB);
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_DB),
      ...parsed,
      users: { ...structuredClone(DEFAULT_DB).users, ...(parsed.users || {}) },
      carts: parsed.carts || {},
      orders: parsed.orders || [],
      threads: parsed.threads || [],
      replies: parsed.replies || [],
      blogs: parsed.blogs || structuredClone(DEFAULT_DB).blogs,
      reviews: parsed.reviews || [],
      wishlists: parsed.wishlists || {}
    };
  } catch (_error) {
    return structuredClone(DEFAULT_DB);
  }
}

function saveDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

const db = loadDb();

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${y}${m}${d}-${suffix}`;
}

module.exports = {
  db,
  generateId,
  generateOrderNumber,
  saveDb
};
