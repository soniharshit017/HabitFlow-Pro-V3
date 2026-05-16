'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function fix() {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected.');

    const username = 'isoniharshit';
    const newPassword = '@Harshit220709';

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.error(`❌ User "${username}" not found in database.`);
      process.exit(1);
    }

    console.log(`🔧 Updating password for ${username}...`);
    user.password = newPassword;
    await user.save();

    console.log('✅ Password updated successfully! The bug has been bypassed.');
    console.log('🚀 You can now login with your password.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();
