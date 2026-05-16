const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/habitflow_pro');
    console.log('Connected to 127.0.0.1');

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(d => d.name));

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
