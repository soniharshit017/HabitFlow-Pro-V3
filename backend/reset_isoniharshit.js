const mongoose = require('mongoose');
async function reset() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/habitflow_pro');
    const db = mongoose.connection.db;

    const username = 'isoniharshit';
    const newEmail = 'soniharshit017@gmail.com';
    const newPass = 'admin1234'; // Temporary password

    // 1. Find user
    const user = await db.collection('users').findOne({ username: /isoniharshit/i });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    // 2. Update User (email and password)
    // We need to hash the password if possible, but let's see how the model does it.
    // Actually, I'll use the Mongoose model to ensure hashing works.
    const path = require('path');
    const User = require(path.join('d:/HabitFlow-Pro-V3', 'backend/models/User'));
    const GlobalData = require(path.join('d:/HabitFlow-Pro-V3', 'backend/models/GlobalData'));

    const userModel = await User.findOne({ appId: user.appId });
    userModel.email = newEmail;
    userModel.password = newPass;
    await userModel.save();

    // 3. Update Profile in GlobalData
    const global = await GlobalData.findOne({ singleton: 'main' });
    if (global.profiles[user.appId]) {
      global.profiles[user.appId].email = newEmail;
      global.markModified('profiles');
      await global.save();
    }

    console.log('--- RESET SUCCESS ---');
    console.log('Username:', username);
    console.log('New Email:', newEmail);
    console.log('Temporary Password:', newPass);
    console.log('--- PLEASE LOGIN NOW ---');

    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
reset();
