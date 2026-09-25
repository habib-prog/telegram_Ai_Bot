const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/telegram_proxy_store';
  try {
    await mongoose.connect(mongoUri);
    console.log(`✅ [MongoDB] Connected successfully to ${mongoose.connection.name}`);
  } catch (err) {
    console.error('❌ [MongoDB] Failed to connect:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
