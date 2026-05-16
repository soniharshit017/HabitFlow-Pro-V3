const mongoose = require('mongoose');
async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/habitflow_pro');
    const user = await mongoose.connection.db.collection('users').findOne({ email: /soniharshit017@gmail.com/i });
    if (user) {
      console.log('User found by email:', user.username, user.email);
      const global = await mongoose.connection.db.collection('globaldatas').findOne({ singleton: 'main' });
      const profile = global?.profiles?.[user.appId];
      console.log('BirthDate in DB:', profile?.birthDate);
    } else {
      console.log('No user found with that email.');
    }
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
check();
