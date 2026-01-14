const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const reservationRoutes = require('./routes/reservations');

const app = express();

// Update CORS to allow your frontend domain
const allowedOrigins = [
    'http://localhost:3000',
    'https://restaurant-management-system.onrender.com',
    'https://restaurant-frontend-final1.onrender.com', // Add your frontend URL here
    'https://restaurant-frontend-full.onrender.com' // Common Render frontend name
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            console.log('CORS blocked for origin:', origin);
            return callback(new Error('CORS policy violation'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
// Enhanced CORS for production
// app.use(cors({
//     origin: ['http://localhost:3000', 'https://restaurant-management-system.onrender.com'],
//     credentials: true
// }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this middleware for logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});


// MongoDB Connection - Use your actual connection string
const MONGODB_URI = 'mongodb+srv://unzila:unzila123@cluster0.makf2r4.mongodb.net/restaurant_db?retryWrites=true&w=majority';


mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`📍 Host: ${mongoose.connection.host}`);
    
    // List all collections
    mongoose.connection.db.listCollections().toArray((err, collections) => {
        if (err) {
            console.error('Error listing collections:', err);
            return;
        }
        console.log('📁 Collections in database:');
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });
    });
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('💡 Troubleshooting steps:');
    console.log('1. Check if MongoDB Atlas cluster is running');
    console.log('2. Verify your IP is whitelisted in Network Access');
    console.log('3. Check username/password in connection string');
    console.log('4. Ensure database user has correct permissions');
    process.exit(1);
});

// ========== IMPORT MODELS FROM SEPARATE FILES ==========
// Create these files as shown below
const User = require('./models/User');
const Table = require('./models/Table');
const Reservation = require('./models/Reservation');

// Test endpoint to check database connection
app.get('/api/test-db', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const tableCount = await Table.countDocuments();
        const reservationCount = await Reservation.countDocuments();
        
        res.json({
            success: true,
            message: 'Database connection test',
            counts: {
                users: userCount,
                tables: tableCount,
                reservations: reservationCount
            },
            connection: {
                database: mongoose.connection.name,
                host: mongoose.connection.host,
                readyState: mongoose.connection.readyState
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== AUTH ROUTES ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }
        
        // Create user
        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password, // In production, hash this password
            role: role || 'customer'
        });
        
        console.log('✅ User created:', user._id);
        
        res.status(201).json({
            success: true,
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: 'token-' + Date.now()
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Registration failed'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user (case-insensitive)
        const user = await User.findOne({ 
            email: email.toLowerCase() 
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        // Check password (in production, use bcrypt)
        if (user.password !== password) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        console.log('✅ Login successful:', user.email);
        
        res.json({
            success: true,
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            salary: user.salary,
            rank: user.rank,
            phone: user.phone,
            address: user.address,
            token: 'token-' + Date.now()
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Login failed'
        });
    }
});

// ========== TABLE ROUTES ==========
app.get('/api/tables', async (req, res) => {
    try {
        const tables = await Table.find().sort({ tableNumber: 1 });
        console.log(`📊 Found ${tables.length} tables`);
        res.json({ success: true, data: tables });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        console.log('Creating table:', req.body);
        const table = await Table.create(req.body);
        res.status(201).json({ success: true, data: table });
    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/tables/:id', async (req, res) => {
    try {
        const table = await Table.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!table) {
            return res.status(404).json({ 
                success: false,
                message: 'Table not found' 
            });
        }
        
        res.json({ success: true, data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/tables/:id', async (req, res) => {
    try {
        const table = await Table.findByIdAndDelete(req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false,
                message: 'Table not found' 
            });
        }
        
        res.json({ success: true, message: 'Table deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/tables/available', async (req, res) => {
    try {
        const { date, time, partySize } = req.query;
        
        if (!date || !time || !partySize) {
            return res.status(400).json({ 
                success: false, 
                message: 'Date, time, and party size are required' 
            });
        }
        
        // Get all tables with capacity >= partySize
        const allTables = await Table.find({
            capacity: { $gte: parseInt(partySize) },
            status: { $ne: 'maintenance' }
        });
        
        // Get reservations for the specified date and time
        const reservations = await Reservation.find({
            reservationDate: date,
            reservationTime: time,
            status: { $in: ['pending', 'confirmed', 'seated'] }
        });
        
        // Get table numbers that are already reserved
        const reservedTableNumbers = reservations.map(r => r.tableNumber);
        
        // Filter out reserved tables
        const availableTables = allTables.filter(table => 
            !reservedTableNumbers.includes(table.tableNumber)
        );
        
        console.log(`📅 Available tables for ${date} at ${time}: ${availableTables.length}`);
        
        res.json({ 
            success: true, 
            data: availableTables 
        });
    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/tables/number/:tableNumber', async (req, res) => {
    try {
        const table = await Table.findOneAndUpdate(
            { tableNumber: req.params.tableNumber },
            req.body,
            { new: true }
        );
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                message: 'Table not found' 
            });
        }
        
        res.json({ success: true, data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== RESERVATION ROUTES ==========
// GET ALL RESERVATIONS
app.get('/api/reservations', async (req, res) => {
    try {
        console.log('📋 GET /api/reservations - Fetching ALL reservations');
        
        // REMOVED ALL FILTERS - Just get everything
        const reservations = await Reservation.find({})
            .sort({ reservationDate: -1, reservationTime: -1 });
        
        console.log(`✅ Found ${reservations.length} total reservations`);
        
        // Log all reservations for debugging
        reservations.forEach(res => {
            console.log(`   - ${res.customerName} | ${res.reservationDate} ${res.reservationTime} | ${res.tableNumber} | ${res.status}`);
        });
        
        res.json({ 
            success: true, 
            data: reservations,
            count: reservations.length 
        });
    } catch (error) {
        console.error('❌ Error fetching reservations:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});
app.post('/api/reservations', async (req, res) => {
    try {
        console.log('➕ POST /api/reservations - Request received');
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        console.log('📦 Headers:', req.headers);
        
        // Check required fields
        const required = ['customerName', 'customerEmail', 'customerPhone', 'tableNumber', 'reservationDate', 'reservationTime', 'partySize'];
        const missing = required.filter(field => !req.body[field]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required fields:', missing);
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }
        
        console.log('✅ All required fields present');
        
        // Create reservation
        console.log('💾 Attempting to save to database...');
        const reservation = await Reservation.create(req.body);
        
        console.log('✅ Reservation saved to database:', {
            id: reservation._id,
            customer: reservation.customerName,
            email: reservation.customerEmail,
            date: reservation.reservationDate,
            time: reservation.reservationTime,
            table: reservation.tableNumber,
            status: reservation.status
        });
        
        // Update table status
        console.log(`🔄 Updating table ${req.body.tableNumber} to 'reserved'`);
        const tableUpdate = await Table.findOneAndUpdate(
            { tableNumber: req.body.tableNumber },
            { status: 'reserved' },
            { new: true }
        );
        
        console.log('✅ Table updated:', tableUpdate ? 'Success' : 'Failed');
        
        res.status(201).json({
            success: true,
            data: reservation,
            message: 'Reservation created successfully!'
        });
        
    } catch (error) {
        console.error('❌ Error creating reservation:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check for specific MongoDB errors
        if (error.name === 'ValidationError') {
            console.error('Validation errors:', error.errors);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }
        
        if (error.code === 11000) {
            console.error('Duplicate key error');
            return res.status(400).json({
                success: false,
                message: 'Duplicate reservation found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.put('/api/reservations/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const reservation = await Reservation.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // Update table status based on reservation status
        if (status === 'cancelled' || status === 'completed') {
            await Table.findOneAndUpdate(
                { tableNumber: reservation.tableNumber },
                { status: 'available' }
            );
        } else if (status === 'seated') {
            await Table.findOneAndUpdate(
                { tableNumber: reservation.tableNumber },
                { status: 'occupied' }
            );
        }
        
        res.json({ success: true, data: reservation });
    } catch (error) {
        console.error('Error updating reservation status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try {
        const reservation = await Reservation.findByIdAndDelete(req.params.id);
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // Make table available again
        await Table.findOneAndUpdate(
            { tableNumber: reservation.tableNumber },
            { status: 'available' }
        );
        
        res.json({ success: true, message: 'Reservation deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.use('/api/reservations', reservationRoutes);

// ========== STAFF ROUTES ==========
app.get('/api/staff', async (req, res) => {
    try {
        const staff = await User.find({ 
            role: { $in: ['staff', 'admin'] } 
        }).select('-password');
        
        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/staff', async (req, res) => {
    try {
        const { username, email, password, role, salary, rank, phone, address } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }
        
        // Create staff member
        const staff = await User.create({
            username,
            email: email.toLowerCase(),
            password,
            role: role || 'staff',
            salary: salary || 0,
            rank: rank || 'junior',
            phone,
            address,
            joinDate: new Date(),
            isActive: true
        });
        
        res.status(201).json({
            success: true,
            data: {
                _id: staff._id,
                username: staff.username,
                email: staff.email,
                role: staff.role,
                salary: staff.salary,
                rank: staff.rank,
                phone: staff.phone,
                address: staff.address,
                joinDate: staff.joinDate,
                isActive: staff.isActive
            }
        });
    } catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to create staff member'
        });
    }
});

app.put('/api/staff/:id', async (req, res) => {
    try {
        const { salary, rank, isActive, phone, address } = req.body;
        
        const staff = await User.findByIdAndUpdate(
            req.params.id,
            {
                salary,
                rank,
                isActive,
                phone,
                address
            },
            { new: true }
        ).select('-password');
        
        if (!staff) {
            return res.status(404).json({ 
                success: false,
                message: 'Staff member not found' 
            });
        }
        
        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/staff/:id', async (req, res) => {
    try {
        const staff = await User.findByIdAndDelete(req.params.id);
        
        if (!staff) {
            return res.status(404).json({ 
                success: false,
                message: 'Staff member not found' 
            });
        }
        
        res.json({ success: true, message: 'Staff member deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ANALYTICS ROUTES ==========
app.get('/api/analytics', async (req, res) => {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Get reservations from last 30 days
        const reservations = await Reservation.find({
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        // Get tables
        const tables = await Table.find();
        
        // Calculate basic analytics
        const dailyRevenue = {};
        reservations.forEach(res => {
            const date = new Date(res.createdAt).toISOString().split('T')[0];
            const revenue = res.partySize * 50; // $50 per person
            dailyRevenue[date] = (dailyRevenue[date] || 0) + revenue;
        });
        
        const tableStats = await Table.aggregate([
            {
                $lookup: {
                    from: 'reservations',
                    localField: 'tableNumber',
                    foreignField: 'tableNumber',
                    as: 'reservations'
                }
            },
            {
                $project: {
                    tableNumber: 1,
                    capacity: 1,
                    location: 1,
                    status: 1,
                    totalReservations: { $size: '$reservations' },
                    totalRevenue: { 
                        $multiply: [
                            { $sum: '$reservations.partySize' },
                            50
                        ]
                    }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                dailyRevenue,
                tableStats,
                summary: {
                    totalReservations: reservations.length,
                    totalRevenue: Object.values(dailyRevenue).reduce((a, b) => a + b, 0),
                    averagePartySize: reservations.length > 0 
                        ? reservations.reduce((sum, r) => sum + r.partySize, 0) / reservations.length 
                        : 0
                }
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== DASHBOARD ROUTES ==========
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const totalTables = await Table.countDocuments();
        const availableTables = await Table.countDocuments({ status: 'available' });
        const today = new Date().toISOString().split('T')[0];
        
        const todayReservations = await Reservation.countDocuments({ 
            reservationDate: today 
        });
        
        const todayConfirmedReservations = await Reservation.countDocuments({ 
            reservationDate: today,
            status: { $in: ['confirmed', 'seated'] }
        });
        
        const recentReservations = await Reservation.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({
            success: true,
            data: {
                totalTables,
                availableTables,
                todayReservations,
                todayConfirmedReservations,
                recentReservations,
                occupancyRate: totalTables > 0 
                    ? Math.round(((totalTables - availableTables) / totalTables) * 100) 
                    : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== CREATE DEMO DATA ==========
app.get('/api/create-demo-data', async (req, res) => {
    try {
        console.log('Creating demo data...');
        
        // Clear existing data
        await User.deleteMany({});
        await Table.deleteMany({});
        await Reservation.deleteMany({});
        
        // Create demo users
        const users = [
            { 
                username: 'admin', 
                email: 'admin@example.com', 
                password: 'password123', 
                role: 'admin',
                salary: 75000,
                rank: 'executive',
                phone: '+1 (555) 123-4567',
                address: '123 Admin Street, New York, NY'
            },
            { 
                username: 'staff', 
                email: 'staff@example.com', 
                password: 'password123', 
                role: 'staff',
                salary: 45000,
                rank: 'senior',
                phone: '+1 (555) 987-6543',
                address: '456 Staff Avenue, New York, NY'
            },
            { 
                username: 'customer', 
                email: 'customer@example.com', 
                password: 'password123', 
                role: 'customer',
                phone: '+1 (555) 555-5555',
                address: '789 Customer Road, New York, NY'
            }
        ];
        
        const createdUsers = await User.insertMany(users);
        console.log(`✅ Created ${createdUsers.length} users`);
        
        // Create demo tables
        const tables = [
            { tableNumber: 'T01', capacity: 2, location: 'indoors', status: 'available' },
            { tableNumber: 'T02', capacity: 4, location: 'indoors', status: 'available' },
            { tableNumber: 'T03', capacity: 6, location: 'outdoors', status: 'available' },
            { tableNumber: 'T04', capacity: 2, location: 'balcony', status: 'available' },
            { tableNumber: 'T05', capacity: 8, location: 'private', status: 'available', description: 'Private dining room' },
            { tableNumber: 'T06', capacity: 4, location: 'indoors', status: 'available' }
        ];
        
        const createdTables = await Table.insertMany(tables);
        console.log(`✅ Created ${createdTables.length} tables`);
        
        // Create demo reservations
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const reservations = [
            {
                customerName: 'John Doe',
                customerEmail: 'customer@example.com',
                customerPhone: '123-456-7890',
                tableNumber: 'T01',
                tableId: createdTables[0]._id,
                reservationDate: today,
                reservationTime: '18:00',
                partySize: 2,
                status: 'confirmed',
                specialRequests: 'Window seat preferred'
            },
            {
                customerName: 'Jane Smith',
                customerEmail: 'jane@example.com',
                customerPhone: '987-654-3210',
                tableNumber: 'T02',
                tableId: createdTables[1]._id,
                reservationDate: today,
                reservationTime: '19:30',
                partySize: 4,
                status: 'pending',
                specialRequests: 'Birthday celebration'
            },
            {
                customerName: 'Bob Wilson',
                customerEmail: 'bob@example.com',
                customerPhone: '555-123-4567',
                tableNumber: 'T03',
                tableId: createdTables[2]._id,
                reservationDate: today,
                reservationTime: '20:00',
                partySize: 6,
                status: 'seated'
            }
        ];
        
        const createdReservations = await Reservation.insertMany(reservations);
        console.log(`✅ Created ${createdReservations.length} reservations`);
        
        // Update table statuses
        await Table.updateOne({ tableNumber: 'T01' }, { status: 'reserved' });
        await Table.updateOne({ tableNumber: 'T02' }, { status: 'reserved' });
        await Table.updateOne({ tableNumber: 'T03' }, { status: 'occupied' });
        
        res.json({ 
            success: true, 
            message: 'Demo data created successfully!',
            counts: {
                users: createdUsers.length,
                tables: createdTables.length,
                reservations: createdReservations.length
            }
        });
    } catch (error) {
        console.error('Demo data creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to create demo data'
        });
    }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Restaurant API is running',
        timestamp: new Date().toISOString(),
        database: {
            connected: mongoose.connection.readyState === 1,
            name: mongoose.connection.name,
            host: mongoose.connection.host
        }
    });
});

// ========== DEBUG =========
// DEBUG: Get all reservations (no filters)
// Add this test route to backend/server.js
app.get('/api/debug/reservations', async (req, res) => {
    try {
        const allReservations = await Reservation.find({});
        console.log('📊 All reservations in DB:');
        allReservations.forEach(res => {
            console.log(`- ${res.customerName} | ${res.reservationDate} | ${res.status} | Table: ${res.tableNumber}`);
        });
        
        res.json({
            success: true,
            count: allReservations.length,
            data: allReservations
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
app.get('/api/debug/reservations/all', async (req, res) => {
    try {
        const reservations = await Reservation.find({})
            .sort({ createdAt: -1 });
        
        console.log('📊 Total reservations in DB:', reservations.length);
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DEBUG: Check database connection and counts
app.get('/api/debug/status', async (req, res) => {
    try {
        const usersCount = await User.countDocuments();
        const tablesCount = await Table.countDocuments();
        const reservationsCount = await Reservation.countDocuments();
        
        const recentReservations = await Reservation.find()
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.json({
            success: true,
            database: {
                users: usersCount,
                tables: tablesCount,
                reservations: reservationsCount
            },
            recentReservations: recentReservations,
            message: 'Database connected successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Database error: ' + error.message 
        });
    }
});

// ===========
// Test route to check database connection
app.get('/api/test/db', async (req, res) => {
    try {
        // Test User model
        const userCount = await User.countDocuments();
        const tableCount = await Table.countDocuments();
        const reservationCount = await Reservation.countDocuments();
        
        // Try to create a test reservation
        const testReservation = await Reservation.create({
            customerName: 'Test User',
            customerEmail: 'test@example.com',
            customerPhone: '1234567890',
            tableNumber: 'T01',
            reservationDate: new Date().toISOString().split('T')[0],
            reservationTime: '18:00',
            partySize: 2,
            status: 'pending'
        });
        
        res.json({
            success: true,
            counts: {
                users: userCount,
                tables: tableCount,
                reservations: reservationCount
            },
            testReservation: testReservation,
            message: 'Database test successful'
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});
// ========== SERVE FRONTEND IN PRODUCTION ==========
// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static(path.join(__dirname, '../frontend/build')));
    
//     app.get('*', (req, res) => {
//         res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
//     });
// }
app.get('/', (req, res) => {
    res.json({ 
        message: 'Restaurant Management API is running!',
        version: '2.0.0',
        endpoints: {
            auth: '/api/auth',
            tables: '/api/tables',
            reservations: '/api/reservations',
            staff: '/api/staff',
            analytics: '/api/analytics',
            dashboard: '/api/dashboard',
            demo_data: '/api/create-demo-data'
        }
    });
});
// ========== ERROR HANDLING ==========
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`🔑 Test login: admin@example.com / password123`);
    console.log(`🔄 Create demo data: http://localhost:${PORT}/api/create-demo-data`);
});
