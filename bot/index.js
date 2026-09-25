require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const { registerCustomerHandlers } = require('./handlers/customer');
const { registerAdminHandlers } = require('./handlers/admin');
const notifyAdminService = require('../services/notifyAdmin');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('FATAL: BOT_TOKEN is missing in environment variables.');
}

const bot = new Telegraf(token || 'DUMMY_TOKEN');

// Wire up bot instance to admin alert service
notifyAdminService.setBotInstance(bot);

// Global Telegraf error boundary
bot.catch((err, ctx) => {
  console.error(`[Telegraf Error] for update ${ctx?.updateType}:`, err);
});

// Register bot modules
registerCustomerHandlers(bot);
registerAdminHandlers(bot);

async function launchBot() {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/telegram_proxy_store';
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ [MongoDB] Connected successfully (Bot)');
    } catch (err) {
      console.error('❌ [MongoDB] Connection error:', err.message);
      process.exit(1);
    }
  }

  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`🤖 [Telegram Bot] Authorized as @${botInfo.username} (${botInfo.id})`);

    // In local development, launch via Long Polling
    bot.launch({
      dropPendingUpdates: true,
    });
    console.log('🚀 [Telegram Bot] Polling started successfully!');
  } catch (err) {
    console.error('❌ [Telegram Bot] Failed to start bot:', err.message);
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// If invoked directly from terminal (e.g. npm run bot)
if (require.main === module) {
  launchBot();
}

module.exports = {
  bot,
  launchBot,
};
