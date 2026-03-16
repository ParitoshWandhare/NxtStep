// ============================================================
// NxtStep — MongoDB Initialization Script
// Runs once on first container start.
// ============================================================

db = db.getSiblingDB('nxtstep');

// Create collections with validation
db.createCollection('users');
db.createCollection('interviewsessions');
db.createCollection('evaluations');
db.createCollection('scorecards');
db.createCollection('newsarticles');
db.createCollection('newsevents');
db.createCollection('recommendedroles');
db.createCollection('rolefeedbacks');

// Indexes are created by Mongoose on app start, but we
// create a few critical ones here for immediate safety.
db.users.createIndex({ email: 1 }, { unique: true });
db.newsarticles.createIndex({ url: 1 }, { unique: true });
db.newsevents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

print('NxtStep MongoDB initialized.');
