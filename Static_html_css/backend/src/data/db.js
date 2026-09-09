const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

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
    }
  },
  carts: {},
  orders: [],
  blogs: [
    {
      id: "blog_001",
      authorId: "user_001",
      authorName: "demouser",
      title: "Designing Better Custom-Maker Requests",
      dateAdded: "2026-08-18",
      category: "UX",
      tags: ["UX", "Accessibility"],
      image: "../images/ergonomic_wooden_desk.png",
      summary: "Small details in a request can make collaboration much easier for makers.",
      content: "A clear brief gives makers the measurements, materials, constraints, and context they need to propose useful solutions.",
      deleted: false
    },
    {
      id: "blog_002",
      authorId: "user_001",
      authorName: "demouser",
      title: "A Practical Guide to Better Product Photos",
      dateAdded: "2026-08-12",
      category: "Performance",
      tags: ["Performance", "E-commerce"],
      image: "../images/mechanical_keyboard_case.png",
      summary: "Use focused, optimized images to help shoppers understand a handmade product quickly.",
      content: "Show the product clearly, keep the file size reasonable, and include descriptive alternative text so every visitor can understand the listing.",
      deleted: false
    }
  ],
  blogComments: [
     {
        id: "comment_001",
        blogId: "blog_001",
        authorId: "user_001",
        authorName: "demouser",
        content: "This is a useful article.",
        dateAdded: "2026-09-09T08:00:00.000Z",
        deleted: false
    }
  ],
  threads: [],
  replies: []
};

const DATA_FILE = path.join(__dirname, "db.json");
const COLLECTIONS = ["users", "carts", "orders", "blogs", "threads", "replies"];
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || "rshop";
let mongoClient;
let mongoDatabase;
let pendingSave = Promise.resolve();

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
      blogs: parsed.blogs || structuredClone(DEFAULT_DB).blogs,
      threads: parsed.threads || [],
      replies: parsed.replies || []
    };
  } catch (_error) {
    return structuredClone(DEFAULT_DB);
  }
}

function saveDb(db) {
  if (mongoDatabase) {
    persistDb();
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

const db = loadDb();

function getCollectionDocuments(collectionName) {
  if (collectionName === "users" || collectionName === "carts") {
    return Object.values(db[collectionName]);
  }
  return db[collectionName];
}

function applyCollectionDocuments(collectionName, documents) {
  if (collectionName === "users" || collectionName === "carts") {
    db[collectionName] = Object.fromEntries(documents.map((document) => {
      const { _id, ...value } = document;
      return [value.id || String(_id), value];
    }));
    return;
  }

  db[collectionName] = documents.map(({ _id, ...value }) => value);
}

async function initializeDb() {
  if (!mongoUri) {
    console.warn("MONGODB_URI is not set; using local JSON persistence");
    return;
  }

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDatabase = mongoClient.db(mongoDbName);

  const remoteDocuments = {};
  let hasRemoteData = false;
  for (const collectionName of COLLECTIONS) {
    remoteDocuments[collectionName] = await mongoDatabase
      .collection(collectionName)
      .find({})
      .toArray();
    hasRemoteData ||= remoteDocuments[collectionName].length > 0;
  }

  if (hasRemoteData) {
    for (const collectionName of COLLECTIONS) {
      applyCollectionDocuments(collectionName, remoteDocuments[collectionName]);
    }
    if (!db.blogs.length) {
      db.blogs = structuredClone(DEFAULT_DB).blogs;
      await persistDb();
    }
  } else {
    await persistDb();
  }

  console.log(`Connected to MongoDB database '${mongoDbName}'`);
}

function persistDb() {
  if (!mongoDatabase) return Promise.resolve();

  const write = async () => {
    for (const collectionName of COLLECTIONS) {
      const collection = mongoDatabase.collection(collectionName);
      const documents = getCollectionDocuments(collectionName).map((document) => ({
        ...document,
        _id: document.id || document.sessionId || undefined
      }));
      await collection.deleteMany({});
      if (documents.length > 0) {
        await collection.insertMany(documents);
      }
    }
  };

  pendingSave = pendingSave.then(write).catch((error) => {
    console.error("MongoDB persistence failed:", error.message);
  });
  return pendingSave;
}

/*
 * Serializes a single Mongo write behind the same `pendingSave` queue used by
 * persistDb(), so per-document writes never interleave with a full snapshot
 * write and don't race each other under concurrent requests.
 */
function serializeWrite(task) {
  pendingSave = pendingSave.then(task).catch((error) => {
    console.error("MongoDB persistence failed:", error.message);
    throw error;
  });
  return pendingSave;
}

function persistLocalSnapshot() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

/*
 * Insert exactly ONE new document into a collection using MongoDB's
 * insertOne(), instead of rewriting the whole collection.
 * Falls back to a local JSON snapshot write when MONGODB_URI isn't set
 * (local dev without Atlas configured).
 */
async function insertOneDocument(collectionName, document) {
  if (!mongoDatabase) {
    persistLocalSnapshot();
    return;
  }

  return serializeWrite(async () => {
    const collection = mongoDatabase.collection(collectionName);
    await collection.insertOne({
      ...document,
      _id: document.id || document.sessionId
    });
  });
}

/*
 * Update exactly ONE existing document using MongoDB's updateOne()/$set,
 * instead of rewriting the whole collection. Used for both "edit" actions
 * and soft-deletes (setting deleted/deleted_at/deleted_by via $set).
 * `upsert: true` is a safety net in case the document was created before
 * a Mongo connection existed (e.g. local-JSON fallback mode).
 */
async function updateOneDocument(collectionName, id, updateFields) {
  if (!mongoDatabase) {
    persistLocalSnapshot();
    return;
  }

  return serializeWrite(async () => {
    const collection = mongoDatabase.collection(collectionName);
    const { _id, ...fieldsToSet } = updateFields;
    await collection.updateOne(
      { _id: id },
      { $set: fieldsToSet },
      { upsert: true }
    );
  });
}

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
  initializeDb,
  generateId,
  generateOrderNumber,
  saveDb,
  insertOneDocument,
  updateOneDocument
};