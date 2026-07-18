/**
 * Shopping Cart Module - Main JavaScript
 * Handles form interactions, API communication, and user feedback
 */

// ========================================
// SESSION & API CONFIGURATION
// ========================================

// Initialize or retrieve session ID
const SESSION_ID = localStorage.getItem("sessionId") || crypto.randomUUID();
localStorage.setItem("sessionId", SESSION_ID);

// API Configuration
const API_CONFIG = {
  BASE_URL: "http://localhost:5000/api",
  TIMEOUT: 1200,
  HEADERS: {
    "Content-Type": "application/json"
  }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Make API request with error handling
 * Falls back to mock authentication if backend is unavailable
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response JSON
 */
async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: API_CONFIG.HEADERS,
      ...options,
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Backend unavailable, using mock API:", error.message);

    return mockEndpointResponse(endpoint, options);
  }
}

/**
 * Mock Authentication API for Development/Testing
 */
const mockAuthDatabase = {
  'demo@example.com': {
    id: 'user_001',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@example.com',
    password: 'demo123',
    userType: ['poster', 'professional']
  }
};

async function mockAuthAPI(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : null;

        if (endpoint === '/auth/login' && method === 'POST') {
          const { email, password } = body;
          const user = mockAuthDatabase[email];

          if (!user || user.password !== password) {
            reject(new Error('Invalid email or password'));
            return;
          }

          resolve({
            success: true,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              userType: user.userType
            },
            token: `token_${user.id}_${Date.now()}`
          });
        }
        else if (endpoint === '/auth/register' && method === 'POST') {
          const { firstName, lastName, email, password, userType } = body;

          if (mockAuthDatabase[email]) {
            reject(new Error('Email already registered'));
            return;
          }

          const newUser = {
            id: `user_${Date.now()}`,
            firstName,
            lastName,
            email,
            password,
            userType: Array.isArray(userType) ? userType : [userType]
          };

          mockAuthDatabase[email] = newUser;

          resolve({
            success: true,
            user: {
              id: newUser.id,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              email: newUser.email,
              userType: newUser.userType
            },
            token: `token_${newUser.id}_${Date.now()}`
          });
        }
        else {
          resolve({
            success: true,
            data: [],
            message: `Mock response for ${endpoint}`
          });
        }
      } catch (error) {
        reject(new Error(`API Error: ${error.message}`));
      }
    }, 500);
  });
}

// ========================================
// MOCK DATA FOR STATIC PAGE VISUALIZATION
// ========================================

const MOCK_USERS = {
  user_001: {
    _id: "user_001",
    id: "user_001",
    firstName: "Demo",
    lastName: "User",
    username: "demouser",
    email: "demo@example.com",
    phone: "+1 (555) 010-2244",
    location: "Seattle, WA",
    description: "I post custom furniture requests and compare proposals from local professionals.",
    profilePicture: "",
    rating: { avg: 4.8, count: 18 },
    preferences: {
      emailNotifications: true,
      messageNotifications: true,
      newRequestNotifications: true
    },
    contact: {
      allowDirectContact: true,
      email: "demo@example.com",
      phone: "+1 (555) 010-2244"
    }
  },
  pro_001: { _id: "pro_001", id: "pro_001", firstName: "Maya", lastName: "Stevens", email: "maya@craftmail.com", rating: { avg: 4.9, count: 124 }, contact: { allowDirectContact: true, email: "maya@craftmail.com" } },
  pro_002: { _id: "pro_002", id: "pro_002", firstName: "Ethan", lastName: "Cole", email: "ethan@craftmail.com", rating: { avg: 4.7, count: 91 }, contact: { allowDirectContact: true, email: "ethan@craftmail.com" } },
  pro_003: { _id: "pro_003", id: "pro_003", firstName: "Lina", lastName: "Park", email: "lina@craftmail.com", rating: { avg: 4.8, count: 73 }, contact: { allowDirectContact: true, email: "lina@craftmail.com" } }
};

const MOCK_REQUESTS = [
  { _id: "req_001", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Custom Walnut Dining Table", description: "Need a 6-seater walnut dining table with rounded edges and matte finish.", category: "furniture", status: "OPEN", budget: { min: 850, max: 1400 }, timeline: "4-6 weeks", responseCount: 3, createdAt: "2026-07-02T10:00:00.000Z", requirements: { material: "Walnut", style: "Modern", dimensions: "72in x 38in", color: "Natural walnut", quantity: 1 } },
  { _id: "req_002", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Sofa Reupholstery Project", description: "Looking to reupholster a 3-seat sofa in performance fabric.", category: "repair", status: "IN_NEGOTIATION", budget: { min: 350, max: 700 }, timeline: "2 weeks", responseCount: 2, createdAt: "2026-07-05T12:15:00.000Z", requirements: { material: "Performance fabric", style: "Contemporary", color: "Charcoal", quantity: 1 } },
  { _id: "req_003", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Built-in Entryway Bench", description: "Custom built-in bench with shoe storage for apartment entryway.", category: "customization", status: "ACCEPTED", budget: { min: 600, max: 950 }, timeline: "3 weeks", responseCount: 4, createdAt: "2026-06-28T08:20:00.000Z", requirements: { material: "Oak + MDF", style: "Scandinavian", dimensions: "58in x 18in", quantity: 1 } },
  { _id: "req_004", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Bookshelf Assembly + Wall Anchoring", description: "Need help assembling and safely anchoring two large bookshelves.", category: "installation", status: "COMPLETED", budget: { min: 120, max: 220 }, timeline: "1 day", responseCount: 1, createdAt: "2026-06-20T09:00:00.000Z", requirements: { quantity: 2 } },
  { _id: "req_005", posterId: { _id: "pro_003", firstName: "Lina", lastName: "Park" }, title: "Minimalist Coffee Table", description: "Need a light oak coffee table with hidden storage drawer.", category: "furniture", status: "OPEN", budget: { min: 280, max: 520 }, timeline: "2-3 weeks", responseCount: 5, createdAt: "2026-07-06T15:40:00.000Z", requirements: { style: "Minimal", dimensions: "40in x 20in", color: "Light Oak", quantity: 1 } },
  { _id: "req_006", posterId: { _id: "pro_002", firstName: "Ethan", lastName: "Cole" }, title: "Industrial Pipe Shelves", description: "Need custom industrial shelves for home office using black pipes and reclaimed wood.", category: "customization", status: "OPEN", budget: { min: 300, max: 650 }, timeline: "10-14 days", responseCount: 6, createdAt: "2026-07-10T09:45:00.000Z", requirements: { material: "Reclaimed wood + steel", style: "Industrial", dimensions: "3 shelves, 48in wide", quantity: 3 } },
  { _id: "req_007", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Nursery Dresser Conversion", description: "Convert old dresser into baby-safe changing station with rounded corners.", category: "repair", status: "OPEN", budget: { min: 200, max: 420 }, timeline: "1 week", responseCount: 2, createdAt: "2026-07-11T13:10:00.000Z", requirements: { material: "Existing oak dresser", style: "Soft modern", color: "White wash", quantity: 1 } },
  { _id: "req_008", posterId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, title: "Patio Bench With Storage", description: "Looking for weather-resistant bench with lift-top storage for patio tools.", category: "furniture", status: "OPEN", budget: { min: 450, max: 900 }, timeline: "3 weeks", responseCount: 4, createdAt: "2026-07-09T07:50:00.000Z", requirements: { material: "Cedar", style: "Outdoor modern", dimensions: "60in length", quantity: 1 } },
  { _id: "req_009", posterId: { _id: "pro_003", firstName: "Lina", lastName: "Park" }, title: "Kitchen Cabinet Door Repair", description: "Need hinge alignment and replacement for 6 cabinet doors.", category: "repair", status: "OPEN", budget: { min: 90, max: 180 }, timeline: "2-3 days", responseCount: 8, createdAt: "2026-07-08T17:30:00.000Z", requirements: { material: "Existing cabinets", style: "N/A", quantity: 6 } },
  { _id: "req_010", posterId: { _id: "pro_002", firstName: "Ethan", lastName: "Cole" }, title: "Compact Entryway Shoe Rack", description: "Custom slim shoe rack for narrow hallway, max depth 10 inches.", category: "design", status: "OPEN", budget: { min: 140, max: 320 }, timeline: "5-7 days", responseCount: 3, createdAt: "2026-07-10T19:20:00.000Z", requirements: { style: "Minimal", dimensions: "36in x 10in", quantity: 1 } },
  { _id: "req_011", posterId: { _id: "user_001", firstName: "Demo", lastName: "User" }, title: "Workshop Tool Wall Organizer", description: "Need a pegboard + French cleat organizer for drill, saw, and hand tools.", category: "installation", status: "OPEN", budget: { min: 180, max: 360 }, timeline: "1 week", responseCount: 7, createdAt: "2026-07-12T08:10:00.000Z", requirements: { material: "Plywood + steel", style: "Workshop", quantity: 1 } },
  { _id: "req_012", posterId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, title: "Dining Chair Leg Reinforcement", description: "Eight chairs are wobbly and need structural reinforcement.", category: "repair", status: "OPEN", budget: { min: 220, max: 430 }, timeline: "4 days", responseCount: 5, createdAt: "2026-07-12T15:00:00.000Z", requirements: { material: "Beech", quantity: 8 } }
];

const MOCK_PROPOSALS = [
  { _id: "prop_001", requestId: { _id: "req_001", title: "Custom Walnut Dining Table", budget: { min: 850, max: 1400 } }, professionalId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, professionalSnapshot: { firstName: "Maya", lastName: "Stevens" }, proposedPrice: 1180, timeline: "5 weeks", status: "NEGOTIATING", createdAt: "2026-07-03T11:00:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 1250, proposedBy: "professional", timestamp: "2026-07-03T11:00:00.000Z" }, { type: "COUNTER_OFFER", proposedPrice: 1150, proposedBy: "poster", timestamp: "2026-07-03T16:30:00.000Z" }, { type: "COUNTER_OFFER", proposedPrice: 1180, proposedBy: "professional", timestamp: "2026-07-04T09:20:00.000Z" }] },
  { _id: "prop_002", requestId: { _id: "req_002", title: "Sofa Reupholstery Project", budget: { min: 350, max: 700 } }, professionalId: { _id: "pro_003", firstName: "Lina", lastName: "Park" }, professionalSnapshot: { firstName: "Lina", lastName: "Park" }, proposedPrice: 540, timeline: "10 days", status: "INITIAL_OFFER", createdAt: "2026-07-05T13:00:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 540, proposedBy: "professional", timestamp: "2026-07-05T13:00:00.000Z" }] },
  { _id: "prop_003", requestId: { _id: "req_003", title: "Built-in Entryway Bench", budget: { min: 600, max: 950 } }, professionalId: { _id: "pro_002", firstName: "Ethan", lastName: "Cole" }, professionalSnapshot: { firstName: "Ethan", lastName: "Cole" }, proposedPrice: 890, timeline: "3 weeks", status: "ACCEPTED", createdAt: "2026-06-29T14:00:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 920, proposedBy: "professional", timestamp: "2026-06-29T14:00:00.000Z" }] },
  { _id: "prop_004", requestId: { _id: "req_005", title: "Minimalist Coffee Table", budget: { min: 280, max: 520 } }, professionalId: { _id: "user_001", firstName: "Demo", lastName: "User" }, professionalSnapshot: { firstName: "Demo", lastName: "User" }, proposedPrice: 430, timeline: "2 weeks", status: "INITIAL_OFFER", createdAt: "2026-07-07T09:00:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 430, proposedBy: "professional", timestamp: "2026-07-07T09:00:00.000Z" }] },
  { _id: "prop_005", requestId: { _id: "req_004", title: "Bookshelf Assembly + Wall Anchoring", budget: { min: 120, max: 220 } }, professionalId: { _id: "user_001", firstName: "Demo", lastName: "User" }, professionalSnapshot: { firstName: "Demo", lastName: "User" }, proposedPrice: 180, timeline: "1 day", status: "REJECTED", createdAt: "2026-06-20T11:00:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 180, proposedBy: "professional", timestamp: "2026-06-20T11:00:00.000Z" }] },
  { _id: "prop_006", requestId: { _id: "req_006", title: "Industrial Pipe Shelves", budget: { min: 300, max: 650 } }, professionalId: { _id: "user_001", firstName: "Demo", lastName: "User" }, professionalSnapshot: { firstName: "Demo", lastName: "User" }, proposedPrice: 590, timeline: "12 days", status: "NEGOTIATING", createdAt: "2026-07-10T10:20:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 610, proposedBy: "professional", timestamp: "2026-07-10T10:20:00.000Z" }, { type: "COUNTER_OFFER", proposedPrice: 590, proposedBy: "professional", timestamp: "2026-07-10T12:40:00.000Z" }] },
  { _id: "prop_007", requestId: { _id: "req_011", title: "Workshop Tool Wall Organizer", budget: { min: 180, max: 360 } }, professionalId: { _id: "user_001", firstName: "Demo", lastName: "User" }, professionalSnapshot: { firstName: "Demo", lastName: "User" }, proposedPrice: 340, timeline: "6 days", status: "INITIAL_OFFER", createdAt: "2026-07-12T09:20:00.000Z", negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: 340, proposedBy: "professional", timestamp: "2026-07-12T09:20:00.000Z" }] }
];

const MOCK_CONVERSATIONS = [
  { conversationId: "conv_req001_pro001", participants: ["user_001", "pro_001"], otherUser: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, unreadCount: 1, lastMessage: { content: "I can start fabrication next Monday.", timestamp: "2026-07-08T16:45:00.000Z" } },
  { conversationId: "conv_req002_pro003", participants: ["user_001", "pro_003"], otherUser: { _id: "pro_003", firstName: "Lina", lastName: "Park" }, unreadCount: 0, lastMessage: { content: "Could you confirm the fabric sample color?", timestamp: "2026-07-07T12:10:00.000Z" } },
  { conversationId: "conv_req005_user001", participants: ["user_001", "pro_002"], otherUser: { _id: "pro_002", firstName: "Ethan", lastName: "Cole" }, unreadCount: 2, lastMessage: { content: "Can do this for $430 with oak veneer.", timestamp: "2026-07-09T09:30:00.000Z" } },
  { conversationId: "conv_req011_tools", participants: ["user_001", "pro_001"], otherUser: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, unreadCount: 0, lastMessage: { content: "Can include slots for impact driver and jigsaw.", timestamp: "2026-07-12T14:05:00.000Z" } }
];

const MOCK_MESSAGES = {
  conv_req001_pro001: [
    { _id: "msg_001", senderId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, messageType: "TEXT", content: "Thanks for posting the table request. I can build it in walnut.", createdAt: "2026-07-08T15:30:00.000Z" },
    { _id: "msg_002", senderId: { _id: "user_001", firstName: "Demo", lastName: "User" }, messageType: "COUNTER_OFFER", proposedPrice: 1150, content: "Could we do 1150 if I handle pickup?", createdAt: "2026-07-08T16:10:00.000Z" },
    { _id: "msg_003", senderId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, messageType: "TEXT", content: "I can start fabrication next Monday.", createdAt: "2026-07-08T16:45:00.000Z" }
  ],
  conv_req002_pro003: [
    { _id: "msg_004", senderId: { _id: "pro_003", firstName: "Lina", lastName: "Park" }, messageType: "TEXT", content: "I recommend a high-durability performance linen.", createdAt: "2026-07-07T10:00:00.000Z" },
    { _id: "msg_005", senderId: { _id: "user_001", firstName: "Demo", lastName: "User" }, messageType: "TEXT", content: "Sounds good. Do you have charcoal options?", createdAt: "2026-07-07T10:20:00.000Z" }
  ],
  conv_req005_user001: [
    { _id: "msg_006", senderId: { _id: "pro_002", firstName: "Ethan", lastName: "Cole" }, messageType: "PRICE_OFFER", proposedPrice: 430, content: "Can do this for $430 with oak veneer.", createdAt: "2026-07-09T09:30:00.000Z" }
  ],
  conv_req011_tools: [
    { _id: "msg_007", senderId: { _id: "user_001", firstName: "Demo", lastName: "User" }, messageType: "TEXT", content: "I need dedicated hooks for drill and circular saw.", createdAt: "2026-07-12T13:50:00.000Z" },
    { _id: "msg_008", senderId: { _id: "pro_001", firstName: "Maya", lastName: "Stevens" }, messageType: "TEXT", content: "Can include slots for impact driver and jigsaw.", createdAt: "2026-07-12T14:05:00.000Z" }
  ]
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getCurrentUserId() {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  return localStorage.getItem("userId") || storedUser.id || "user_001";
}

function normalizePath(endpoint) {
  const pathOnly = endpoint.split("?")[0] || "/";
  const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return withSlash.startsWith("/api/") ? withSlash.slice(4) : withSlash;
}

function getQueryParams(endpoint) {
  const raw = endpoint.includes("?") ? endpoint.split("?")[1] : "";
  return new URLSearchParams(raw);
}

async function mockEndpointResponse(endpoint, options = {}) {
  const path = normalizePath(endpoint);
  const query = getQueryParams(endpoint);
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const currentUserId = getCurrentUserId();

  if (path === "/auth/login" || path === "/auth/register") {
    return mockAuthAPI(path, options);
  }

  if (path === "/auth/change-password") return { success: true };

  const authUserMatch = path.match(/^\/auth\/user\/([^/]+)(\/deactivate)?$/);
  if (authUserMatch && method === "GET") {
    return deepClone(MOCK_USERS[authUserMatch[1]] || MOCK_USERS.user_001);
  }
  if (authUserMatch && (method === "PUT" || method === "DELETE")) {
    return { success: true };
  }

  if (path.startsWith("/auth/professionals")) {
    return deepClone(Object.values(MOCK_USERS).filter((u) => String(u._id).startsWith("pro_")));
  }

  if (path === "/requests" && method === "GET") {
    const posterId = query.get("posterId");
    const status = query.get("status");
    let list = deepClone(MOCK_REQUESTS);
    if (posterId) list = list.filter((r) => (r.posterId._id || r.posterId) === posterId);
    if (status) list = list.filter((r) => r.status === status);
    return posterId ? list : { requests: list, data: list, total: list.length };
  }

  const requestByIdMatch = path.match(/^\/requests\/([^/]+)$/);
  if (requestByIdMatch && method === "GET") {
    const request = MOCK_REQUESTS.find((r) => r._id === requestByIdMatch[1]);
    if (!request) throw new Error("Request not found");
    const posterId = request.posterId?._id || request.posterId;
    const poster = MOCK_USERS[posterId];
    const enriched = poster
      ? {
          ...request,
          posterId: {
            _id: poster._id,
            firstName: poster.firstName,
            lastName: poster.lastName,
            email: poster.email,
            rating: poster.rating || { avg: 4.7, count: 12 },
            contact: poster.contact || { allowDirectContact: true, email: poster.email }
          }
        }
      : request;
    return deepClone(enriched);
  }

  if (path === "/requests" && method === "POST") {
    const newReq = {
      _id: `req_${Date.now()}`,
      posterId: { _id: body.posterId || currentUserId, firstName: MOCK_USERS[currentUserId]?.firstName || "Demo", lastName: MOCK_USERS[currentUserId]?.lastName || "User" },
      title: body.title,
      description: body.description,
      category: body.category,
      status: "OPEN",
      budget: body.budget,
      timeline: body.timeline,
      responseCount: 0,
      requirements: body.requirements || {},
      createdAt: new Date().toISOString()
    };
    MOCK_REQUESTS.unshift(newReq);
    return { success: true, request: deepClone(newReq) };
  }

  const proposalsByProfessional = path.match(/^\/proposals\/professional\/([^/]+)$/);
  if (proposalsByProfessional && method === "GET") {
    return deepClone(MOCK_PROPOSALS.filter((p) => (p.professionalId._id || p.professionalId) === proposalsByProfessional[1]));
  }

  const proposalsByRequest = path.match(/^\/proposals\/request\/([^/]+)$/);
  if (proposalsByRequest && method === "GET") {
    return deepClone(MOCK_PROPOSALS.filter((p) => (p.requestId._id || p.requestId) === proposalsByRequest[1]));
  }

  if (path === "/proposals" && method === "POST") {
    const request = MOCK_REQUESTS.find((r) => r._id === body.requestId);
    const newProposal = {
      _id: `prop_${Date.now()}`,
      requestId: { _id: request?._id || body.requestId, title: request?.title || "Request", budget: request?.budget || { min: 0, max: 0 } },
      professionalId: { _id: body.professionalId || currentUserId, firstName: MOCK_USERS[currentUserId]?.firstName || "Demo", lastName: MOCK_USERS[currentUserId]?.lastName || "User" },
      professionalSnapshot: { firstName: MOCK_USERS[currentUserId]?.firstName || "Demo", lastName: MOCK_USERS[currentUserId]?.lastName || "User" },
      proposedPrice: body.proposedPrice,
      timeline: body.timeline,
      status: "INITIAL_OFFER",
      createdAt: new Date().toISOString(),
      negotiationHistory: [{ type: "INITIAL_OFFER", proposedPrice: body.proposedPrice, proposedBy: "professional", timestamp: new Date().toISOString() }]
    };
    MOCK_PROPOSALS.unshift(newProposal);
    return { success: true, proposal: deepClone(newProposal) };
  }

  const proposalAccept = path.match(/^\/proposals\/([^/]+)\/accept$/);
  if (proposalAccept && method === "PUT") {
    const proposal = MOCK_PROPOSALS.find((p) => p._id === proposalAccept[1]);
    if (proposal) {
      proposal.status = "ACCEPTED";
      if (body.finalPrice) proposal.proposedPrice = body.finalPrice;
    }
    return { success: true };
  }

  const proposalCounter = path.match(/^\/proposals\/([^/]+)\/counter-offer$/);
  if (proposalCounter && method === "PUT") {
    const proposal = MOCK_PROPOSALS.find((p) => p._id === proposalCounter[1]);
    if (proposal) {
      proposal.status = "NEGOTIATING";
      proposal.proposedPrice = body.newPrice || proposal.proposedPrice;
      proposal.negotiationHistory.push({ type: "COUNTER_OFFER", proposedPrice: proposal.proposedPrice, proposedBy: body.offeredBy || "professional", timestamp: new Date().toISOString() });
    }
    return { success: true };
  }

  if (path.match(/^\/proposals\/([^/]+)\/convert-to-cart$/) && method === "POST") {
    return { success: true, cartItemId: `cart_${Date.now()}` };
  }

  const messagesByUser = path.match(/^\/messages\/user\/([^/]+)$/);
  if (messagesByUser && method === "GET") {
    return deepClone(MOCK_CONVERSATIONS.filter((c) => c.participants.includes(messagesByUser[1])));
  }

  const messagesByConversation = path.match(/^\/messages\/conversation\/([^/]+)$/);
  if (messagesByConversation && method === "GET") {
    return deepClone(MOCK_MESSAGES[messagesByConversation[1]] || []);
  }

  const unreadCountMatch = path.match(/^\/messages\/unread-count\/([^/]+)$/);
  if (unreadCountMatch && method === "GET") {
    const total = MOCK_CONVERSATIONS
      .filter((c) => c.participants.includes(unreadCountMatch[1]))
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    return { count: total, unreadCount: total };
  }

  if (path === "/messages" && method === "POST") {
    const conversationId = body.conversationId || `conv_${Date.now()}`;
    if (!MOCK_MESSAGES[conversationId]) MOCK_MESSAGES[conversationId] = [];
    const sender = MOCK_USERS[body.senderId || currentUserId] || MOCK_USERS.user_001;
    MOCK_MESSAGES[conversationId].push({
      _id: `msg_${Date.now()}`,
      senderId: { _id: sender._id, firstName: sender.firstName, lastName: sender.lastName },
      messageType: body.messageType || "TEXT",
      content: body.content || "",
      proposedPrice: body.proposedPrice,
      price: body.price,
      createdAt: new Date().toISOString()
    });
    return { success: true };
  }

  return { success: true, data: [], message: `Mock fallback for ${path}` };
}

/**
 * Display notification to user
 * @param {string} message - Message text
 * @param {string} type - Notification type (success, error, info, warning)
 * @param {number} duration - Display duration in ms (0 = persistent)
 */
function showNotification(message, type = "info", duration = 3000) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.setAttribute("role", "alert");
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getIcon(type)}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" aria-label="Close notification">×</button>
    </div>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Close button handler
  notification.querySelector(".notification-close").addEventListener("click", () => {
    notification.remove();
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => notification.remove(), duration);
  }

  return notification;
}

/**
 * Get icon emoji for notification type
 */
function getIcon(type) {
  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ"
  };
  return icons[type] || icons.info;
}

/**
 * Format price as currency
 * @param {number} price - Price in dollars
 * @returns {string} Formatted price
 */
function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate credit card number (Luhn algorithm)
 * @param {string} cardNumber - Card number
 * @returns {boolean} Whether card number is valid
 */
function isValidCardNumber(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ========================================
// FORM VALIDATION
// ========================================

/**
 * Validate checkout form
 * @returns {boolean} Whether form is valid
 */
function validateCheckoutForm() {
  const form = document.getElementById("checkoutForm");
  if (!form) return true;

  let isValid = true;
  const requiredFields = form.querySelectorAll("[required]");

  // Check required fields
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      showFieldError(field, "This field is required");
      isValid = false;
    } else {
      clearFieldError(field);
    }
  });

  // Validate email
  const emailField = document.getElementById("email");
  if (emailField && emailField.value && !isValidEmail(emailField.value)) {
    showFieldError(emailField, "Invalid email address");
    isValid = false;
  }

  // Validate card number
  const cardNumberField = document.getElementById("cardNumber");
  if (cardNumberField && cardNumberField.value && !isValidCardNumber(cardNumberField.value)) {
    showFieldError(cardNumberField, "Invalid card number");
    isValid = false;
  }

  // Validate CVV
  const cvvField = document.getElementById("cvv");
  if (cvvField && cvvField.value && !/^\d{3,4}$/.test(cvvField.value)) {
    showFieldError(cvvField, "CVV must be 3-4 digits");
    isValid = false;
  }

  // Validate expiry date
  const expiryField = document.getElementById("expiryDate");
  if (expiryField && expiryField.value && !/^\d{2}\/\d{2}$/.test(expiryField.value)) {
    showFieldError(expiryField, "Format: MM/YY");
    isValid = false;
  }

  return isValid;
}

/**
 * Show field error message
 */
function showFieldError(field, message) {
  field.classList.add("error");
  let errorEl = field.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains("error-message")) {
    errorEl = document.createElement("div");
    errorEl.className = "error-message";
    field.parentNode.insertBefore(errorEl, field.nextSibling);
  }
  errorEl.textContent = message;
}

/**
 * Clear field error
 */
function clearFieldError(field) {
  field.classList.remove("error");
  const errorEl = field.nextElementSibling;
  if (errorEl && errorEl.classList.contains("error-message")) {
    errorEl.remove();
  }
}

// ========================================
// FORM FORMATTING
// ========================================

/**
 * Format card number input (add spaces)
 */
document.addEventListener("DOMContentLoaded", () => {
  const cardNumberField = document.getElementById("cardNumber");
  if (cardNumberField) {
    cardNumberField.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\s/g, "");
      let formatted = value.replace(/(\d{4})/g, "$1 ").trim();
      e.target.value = formatted;
    });
  }

  // Format expiry date (MM/YY)
  const expiryField = document.getElementById("expiryDate");
  if (expiryField) {
    expiryField.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length >= 2) {
        value = value.substring(0, 2) + "/" + value.substring(2, 4);
      }
      e.target.value = value;
    });
  }
});

// ========================================
// CHECKOUT FORM SUBMISSION
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const checkoutForm = document.getElementById("checkoutForm");

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Validate form
      if (!validateCheckoutForm()) {
        showNotification("Please correct the errors above", "error");
        return;
      }

      // Show loading state
      const submitBtn = checkoutForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing...";

      try {
        // Prepare form data
        const formData = new FormData(checkoutForm);
        const paymentData = {
          payment: {
            cardholderName: formData.get("cardholderName"),
            cardLast4: formData.get("cardNumber").slice(-4),
            cardBrand: "VISA" // Would be detected from card number in real scenario
          },
          delivery: {
            fullName: formData.get("fullName"),
            phone: formData.get("phone"),
            addressLine1: formData.get("addressLine1"),
            addressLine2: formData.get("addressLine2") || "",
            city: formData.get("city"),
            state: formData.get("state"),
            postalCode: formData.get("postalCode"),
            country: formData.get("country") || "US",
            deliveryInstructions: formData.get("instructions") || ""
          },
          shippingCost: getShippingCost(),
          taxRate: 0.1
        };

        // Submit checkout
        const response = await apiCall(`/orders/checkout/${SESSION_ID}`, {
          method: "POST",
          body: JSON.stringify(paymentData)
        });

        // Show success
        showNotification("Order placed successfully!", "success");

        // Redirect to confirmation
        setTimeout(() => {
          window.location.href = `order-confirmation.html?orderNumber=${response.order.orderNumber}`;
        }, 1500);

      } catch (error) {
        showNotification("Failed to place order. Please try again.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});

/**
 * Get shipping cost based on selected method
 */
function getShippingCost() {
  const shippingMethod = document.querySelector('input[name="shippingMethod"]:checked');
  if (!shippingMethod) return 0;

  switch (shippingMethod.value) {
    case "express": return 99.00;
    case "white-glove": return 199.00;
    default: return 0; // Standard free shipping
  }
}

// ========================================
// CART OPERATIONS
// ========================================

/**
 * Add item to cart
 */
async function addToCart(productId, productName, price) {
  try {
    const quantity = document.getElementById("quantityInput")?.value || 1;
    const color = document.getElementById("colorSelect")?.value || "";
    const delivery = document.getElementById("deliverySelect")?.value || "standard";

    const response = await apiCall(`/cart/${SESSION_ID}/items`, {
      method: "POST",
      body: JSON.stringify({
        productId,
        quantity: parseInt(quantity),
        textDetails: { color },
        unitPrice: price
      })
    });

    updateCartBadge();
    showNotification(`Added ${productName} to cart`, "success");

  } catch (error) {
    showNotification("Failed to add to cart", "error");
  }
}

/**
 * Remove item from cart
 */
async function removeFromCart(itemId) {
  if (!confirm("Remove this item from cart?")) return;

  try {
    await apiCall(`/cart/${SESSION_ID}/items/${itemId}`, {
      method: "DELETE"
    });

    updateCartBadge();
    showNotification("Item removed from cart", "info");
    location.reload(); // Refresh cart display

  } catch (error) {
    showNotification("Failed to remove item", "error");
  }
}

/**
 * Update cart item
 */
async function updateCartItem(itemId, updates) {
  try {
    await apiCall(`/cart/${SESSION_ID}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });

    showNotification("Cart updated", "success");

  } catch (error) {
    showNotification("Failed to update cart", "error");
  }
}

/**
 * Update cart badge count
 */
async function updateCartBadge() {
  try {
    const response = await apiCall(`/cart/${SESSION_ID}`);
    const cartBadge = document.getElementById("cartBadge");
    if (cartBadge) {
      cartBadge.textContent = response.items?.length || 0;
    }
  } catch (error) {
    console.log("Could not update cart badge");
  }
}

// ========================================
// INITIALIZE ON PAGE LOAD
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  
  // Attach event listeners to quantity inputs
  document.querySelectorAll(".quantity-input").forEach(input => {
    input.addEventListener("change", function() {
      showNotification("Quantity updated", "info", 2000);
    });
  });

  // Attach event listeners to remove buttons
  document.querySelectorAll("button[onclick*='removeItem']").forEach(btn => {
    btn.addEventListener("click", function() {
      if (confirm("Remove this item from cart?")) {
        showNotification("Item removed", "info");
      }
    });
  });
});

// ========================================
// MARKETPLACE FUNCTIONS (REQUEST/PROPOSAL)
// ========================================

/**
 * Get all open requests
 */
async function getRequests(filters = {}) {
  const params = new URLSearchParams({
    status: "OPEN",
    limit: filters.limit || 20,
    skip: filters.skip || 0,
    ...filters
  });

  return await apiCall(`/requests?${params}`);
}

/**
 * Get single request with proposals
 */
async function getRequestDetails(requestId) {
  return await apiCall(`/requests/${requestId}`);
}

/**
 * Create new request
 */
async function createRequest(requestData) {
  return await apiCall("/requests", {
    method: "POST",
    body: JSON.stringify(requestData)
  });
}

/**
 * Get user's requests
 */
async function getMyRequests() {
  const posterId = localStorage.getItem("userId");
  return await apiCall(`/requests?posterId=${posterId}`);
}

/**
 * Send proposal to request
 */
async function sendProposal(requestId, proposalData) {
  return await apiCall("/proposals", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      professionalId: localStorage.getItem("userId"),
      ...proposalData
    })
  });
}

/**
 * Get proposals sent by user
 */
async function getMyProposals() {
  const professionalId = localStorage.getItem("userId");
  return await apiCall(`/proposals/professional/${professionalId}`);
}

/**
 * Get proposals for a request
 */
async function getRequestProposals(requestId) {
  return await apiCall(`/proposals/request/${requestId}`);
}

/**
 * Accept a proposal
 */
async function acceptProposal(proposalId, finalPrice) {
  return await apiCall(`/proposals/${proposalId}/accept`, {
    method: "PUT",
    body: JSON.stringify({ finalPrice })
  });
}

/**
 * Send counter offer
 */
async function sendCounterOffer(proposalId, newPrice, message, offeredBy) {
  return await apiCall(`/proposals/${proposalId}/counter-offer`, {
    method: "PUT",
    body: JSON.stringify({ newPrice, message, offeredBy })
  });
}

/**
 * Convert accepted proposal to cart item
 */
async function convertProposalToCart(proposalId) {
  return await apiCall(`/proposals/${proposalId}/convert-to-cart`, {
    method: "POST"
  });
}

// ========================================
// MESSAGING FUNCTIONS
// ========================================

/**
 * Send message
 */
async function sendMessage(messageData) {
  return await apiCall("/messages", {
    method: "POST",
    body: JSON.stringify({
      senderId: localStorage.getItem("userId"),
      ...messageData
    })
  });
}

/**
 * Get messages in conversation
 */
async function getConversationMessages(conversationId) {
  return await apiCall(`/messages/conversation/${conversationId}`);
}

/**
 * Get user's conversations
 */
async function getUserConversations() {
  const userId = localStorage.getItem("userId");
  return await apiCall(`/messages/user/${userId}`);
}

/**
 * Mark message as read
 */
async function markMessageRead(messageId) {
  return await apiCall(`/messages/${messageId}/read`, {
    method: "PUT"
  });
}

/**
 * Get unread count
 */
async function getUnreadCount() {
  const userId = localStorage.getItem("userId");
  return await apiCall(`/messages/unread-count/${userId}`);
}

// ========================================
// USER/AUTH FUNCTIONS
// ========================================

/**
 * Get user profile
 */
async function getUserProfile(userId) {
  return await apiCall(`/auth/user/${userId}`);
}

/**
 * Update user profile
 */
async function updateUserProfile(userId, profileData) {
  return await apiCall(`/auth/user/${userId}`, {
    method: "PUT",
    body: JSON.stringify(profileData)
  });
}

/**
 * Get list of professionals
 */
async function getProfessionals(filters = {}) {
  const params = new URLSearchParams(filters);
  return await apiCall(`/auth/professionals?${params}`);
}

// Export for module usage (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    apiCall,
    showNotification,
    formatPrice,
    isValidEmail,
    validateCheckoutForm,
    addToCart,
    removeFromCart,
    updateCartItem,
    // Marketplace functions
    getRequests,
    getRequestDetails,
    createRequest,
    getMyRequests,
    sendProposal,
    getMyProposals,
    getRequestProposals,
    acceptProposal,
    sendCounterOffer,
    convertProposalToCart,
    // Messaging functions
    sendMessage,
    getConversationMessages,
    getUserConversations,
    markMessageRead,
    getUnreadCount,
    // User functions
    getUserProfile,
    updateUserProfile,
    getProfessionals
  };
}
