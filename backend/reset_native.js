const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function reset() {
  const url = 'mongodb://127.0.0.1:27017';
  const dbName = 'habitflow_pro';
  const client = new MongoClient(url);

  try {
    await client.connect();
    console.log('Connected to MongoDB via Native Driver');
    const db = client.db(dbName);

    const username = 'isoniharshit';
    const newEmail = 'soniharshit017@gmail.com';
    const newPassRaw = 'admin1234';
    
    // Hash password manually using bcrypt
    const salt = await bcrypt.genSalt(10);
    const newPassHash = await bcrypt.hash(newPassRaw, salt);

    // 1. Update User
    const userResult = await db.collection('users').updateOne(
      { username: /isoniharshit/i },
      { $set: { email: newEmail, password: newPassHash, updatedAt: Date.now() } }
    );

    if (userResult.matchedCount === 0) {
      console.log('User not found');
      process.exit(1);
    }

    const user = await db.collection('users').findOne({ username: /isoniharshit/i });

    // 2. Update Profile in GlobalData
    await db.collection('globaldatas').updateOne(
      { singleton: 'main' },
      { $set: { [`profiles.${user.appId}.email`]: newEmail, [`profiles.${user.appId}.updatedAt`]: Date.now() } }
    );

    console.log('--- MANUAL RESET SUCCESS ---');
    console.log('Username:', username);
    console.log('New Email:', newEmail);
    console.log('Temporary Password:', newPassRaw);
    console.log('-----------------------------');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.close();
  }
}
reset();
