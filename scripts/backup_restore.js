const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function backupDatabase() {
  console.log('💾 CREATING DATABASE BACKUP...\n');

  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', timestamp);

    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });

    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`📋 Backing up collection: ${collectionName}`);

      const documents = await db.collection(collectionName).find({}).toArray();

      const backupFile = path.join(backupDir, `${collectionName}.json`);
      await fs.writeFile(backupFile, JSON.stringify(documents, null, 2));

      console.log(`   ✅ Saved ${documents.length} documents to ${backupFile}`);
    }

    console.log(`\n🎉 Backup completed!`);
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`📊 Collections backed up: ${collections.length}`);

    await client.close();

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
  }
}

async function restoreFromBackup(backupTimestamp) {
  console.log('🔄 RESTORING FROM BACKUP...\n');

  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    const backupDir = path.join(__dirname, '..', 'backups', backupTimestamp);

    // Check if backup exists
    try {
      await fs.access(backupDir);
    } catch {
      console.error(`❌ Backup not found: ${backupDir}`);
      return;
    }

    // List backup files
    const files = await fs.readdir(backupDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const collectionName = file.replace('.json', '');
      const filePath = path.join(backupDir, file);

      console.log(`🔄 Restoring collection: ${collectionName}`);

      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

      if (data.length > 0) {
        await db.collection(collectionName).insertMany(data);
        console.log(`   ✅ Restored ${data.length} documents`);
      }
    }

    console.log('\n🎉 Restore completed!');
    await client.close();

  } catch (error) {
    console.error('❌ Restore failed:', error.message);
  }
}

// Command line interface
const command = process.argv[2];
const param = process.argv[3];

if (command === 'backup') {
  backupDatabase();
} else if (command === 'restore' && param) {
  restoreFromBackup(param);
} else {
  console.log('Usage:');
  console.log('  node backup_restore.js backup          # Create backup');
  console.log('  node backup_restore.js restore <timestamp>  # Restore from backup');
  console.log('\nExample:');
  console.log('  node backup_restore.js backup');
  console.log('  node backup_restore.js restore 2025-11-09T12-00-00-000Z');
}
