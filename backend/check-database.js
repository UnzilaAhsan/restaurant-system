const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
    try {
        console.log('🔍 Checking MongoDB Atlas Connection...\n');
        
        // Connect to MongoDB
        const uri = process.env.MONGODB_URI;
        console.log('Connection URI:', uri.replace(/\/\/[^@]+@/, '//***:***@'));
        
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000
        });
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log(`📍 Host: ${mongoose.connection.host}`);
        console.log(`📊 Database: ${mongoose.connection.name}`);
        
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📁 Collections in database:');
        if (collections.length === 0) {
            console.log('   No collections found (database is empty)');
        } else {
            collections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        }
        
        // Check specific collections
        const collectionsToCheck = ['users', 'tables', 'reservations'];
        console.log('\n🔎 Checking specific collections:');
        
        for (const collectionName of collectionsToCheck) {
            const collectionExists = collections.some(col => col.name === collectionName);
            if (collectionExists) {
                const count = await mongoose.connection.db.collection(collectionName).countDocuments();
                console.log(`   ✅ ${collectionName}: ${count} documents`);
                
                if (count > 0) {
                    const sample = await mongoose.connection.db.collection(collectionName).findOne({});
                    console.log(`      Sample: ${JSON.stringify(sample, null, 2).split('\n')[0]}...`);
                }
            } else {
                console.log(`   ❌ ${collectionName}: Collection does not exist`);
            }
        }
        
        // List all databases
        console.log('\n📚 All databases in cluster:');
        const adminDb = mongoose.connection.db.admin();
        const databases = await adminDb.listDatabases();
        databases.databases.forEach(db => {
            console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`);
        });
        
        await mongoose.connection.close();
        console.log('\n✅ Diagnostic completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n🔧 Possible fixes:');
        console.log('1. Check if MongoDB Atlas cluster is running (not paused)');
        console.log('2. Check Network Access: Add IP 0.0.0.0/0 for testing');
        console.log('3. Verify username/password in connection string');
        console.log('4. Check if you have internet connection');
        console.log('5. Try connecting via Compass with same credentials');
    }
}

checkDatabase();