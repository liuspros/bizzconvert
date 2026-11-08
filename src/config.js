// Central config. Secrets and contact details come from .env (VITE_* variables).
// Everything else (services, hours) is edited here.

const env = import.meta.env;

export const FIREBASE = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// No Firebase keys in .env => demo mode (data lives in this browser only). Handy for previews.
export const DEMO = !FIREBASE.apiKey || !FIREBASE.projectId;

export const SITE = {
  brand: "BizzConvert",
  whatsapp: (env.VITE_WHATSAPP_NUMBER || "").replace(/\D/g, ""),
  phone: env.VITE_CONTACT_PHONE || "",
  email: env.VITE_CONTACT_EMAIL || "",
  instagram: env.VITE_INSTAGRAM_URL || ""
};

export const BOOKING = {
  tzLabel: "WAT",
  daysAhead: 14,                 // how far ahead people can book
  workDays: [1, 2, 3, 4, 5, 6],  // 0 = Sunday ... 6 = Saturday
  slotTimes: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"], // 24h
  minNoticeHours: 3              // a slot can't be booked sooner than this
};

// ids must match the list in firestore.rules
export const SERVICES = [
  { id: "audit",    title: "Free Page Audit",        meta: "20 min call + written audit", price: "Free",    mins: 20 },
  { id: "strategy", title: "Sales Strategy Session", meta: "45 min live session",         price: "₦10,000", mins: 45 }, // placeholder price
  { id: "setup",    title: "Sales System Setup",     meta: "30 min call, quote after",    price: "Custom",  mins: 30 }
];

export const NICHES = [
  "Fashion and clothing", "Beauty and skincare", "Gadgets and electronics",
  "Food and drinks", "Services (makeup, tailoring, etc.)", "Other"
];

// ids must match the list in firestore.rules
export const STATUSES = {
  new:       "New",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show:   "No-show",
  cancelled: "Cancelled"
};
