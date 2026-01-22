/* eslint-disable @typescript-eslint/no-require-imports */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function manualImport() {
  console.log('🚀 STARTING MANUAL IMPORT OF 8 CSV FILES\n');

  try {
    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', process.env.DB_NAME);

    // Clear existing collection if needed
    const existingCount = await db.collection('interactions').countDocuments();
    console.log(`📋 Existing records: ${existingCount.toLocaleString()}`);

    // Define CSV files
    const csvDir = path.join(__dirname, '..', 'ddinterpy');
    const csvFiles = [
      'ddinter_downloads_code_A.csv',
      'ddinter_downloads_code_B.csv',
      'ddinter_downloads_code_D.csv',
      'ddinter_downloads_code_H.csv',
      'ddinter_downloads_code_L.csv',
      'ddinter_downloads_code_P.csv',
      'ddinter_downloads_code_R.csv',
      'ddinter_downloads_code_V.csv'
    ];

    let totalImported = 0;
    let batchSize = 1000;

    // Process each CSV file
    for (const csvFile of csvFiles) {
      const filePath = path.join(csvDir, csvFile);

      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${csvFile}`);
        continue;
      }

      console.log(`\n📄 Processing ${csvFile}...`);

      // Read and parse CSV
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        console.log(`❌ ${csvFile} appears to be empty or invalid`);
        continue;
      }

      // Parse header and data
      const header = lines[0].split(',');
      const dataLines = lines.slice(1);

      console.log(`   📊 Found ${dataLines.length} data rows`);

      // Convert to documents
      const documents = dataLines.map(line => {
        const values = line.split(',');
        return {
          Drug_A: values[0]?.trim() || '',
          Drug_B: values[1]?.trim() || '',
          Level: values[2]?.trim() || '',
          DDInterID_A: values[3]?.trim() || null,
          DDInterID_B: values[4]?.trim() || null
        };
      }).filter(doc => doc.Drug_A && doc.Drug_B); // Filter out invalid rows

      console.log(`   ✅ Valid documents: ${documents.length}`);

      // Insert in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await db.collection('interactions').insertMany(batch);
        console.log(`     📦 Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
      }

      totalImported += documents.length;
      console.log(`   🎉 ${csvFile} completed: ${documents.length} records`);
    }

    // Create indexes for performance
    console.log('\n⚡ Creating database indexes...');
    await db.collection('interactions').createIndex({ Drug_A: 1 });
    await db.collection('interactions').createIndex({ Drug_B: 1 });
    await db.collection('interactions').createIndex({ Level: 1 });
    console.log('✅ Indexes created');

    // Final count
    const finalCount = await db.collection('interactions').countDocuments();
    console.log(`\n🎊 IMPORT COMPLETE!`);
    console.log(`📊 Total records in database: ${finalCount.toLocaleString()}`);
    console.log(`📈 Expected records: 50,000+`);

    if (finalCount > 10000) {
      console.log('✅ SUCCESS: All 8 CSV files data is now in MongoDB!');
    } else {
      console.log('⚠️  WARNING: Import may be incomplete');
    }

    // Sample verification
    const sample = await db.collection('interactions').find({}).limit(3).toArray();
    console.log('\n📋 Verification samples:');
    sample.forEach((doc, i) => {
      console.log(`   ${i+1}. ${doc.Drug_A} + ${doc.Drug_B} (${doc.Level})`);
    });

    await client.close();

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check MongoDB connection string in .env.local');
    console.log('2. Ensure MongoDB Atlas cluster is running');
    console.log('3. Check network connectivity');
  }
}

manualImport();
