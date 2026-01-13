const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://unzila:unzila123@cluster0.makf2r4.mongodb.net/restaurant_db?retryWrites=true&w=majority';

async function testConnection() {
    try {
        console.log('🔗 Testing MongoDB Atlas connection...');
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB Atlas!');
        
        // Get database stats
        const db = mongoose.connection.db;
        const stats = await db.stats();
        
        console.log(`📊 Database: ${stats.db}`);
        console.log(`📁 Collections: ${stats.collections}`);
        console.log(`📄 Objects: ${stats.objects}`);
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📋 Collections list:');
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
        await mongoose.connection.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();