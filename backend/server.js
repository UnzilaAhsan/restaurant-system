const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const reservationRoutes = require('./routes/reservations');

const app = express();

// ========== FIXED CORS CONFIGURATION ==========
const allowedOrigins = [
    'http://localhost:3000',
    'https://restaurant-management-system.onrender.com',
    'https://restaurant-system-nce0.onrender.com',
    'https://restaurant-frontend-final.onrender.com',
    'https://restaurant-frontend-*.onrender.com',
    'https://*.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        for (let allowedOrigin of allowedOrigins) {
            if (allowedOrigin.includes('*')) {
                const pattern = allowedOrigin.replace('.', '\\.').replace('*', '.*');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(origin)) {
                    console.log('✅ CORS allowed for:', origin);
                    return callback(null, true);
                }
            } else if (origin === allowedOrigin) {
                console.log('✅ CORS allowed for:', origin);
                return callback(null, true);
            }
        }
        
        console.log('⚠️ Allowing all origins temporarily');
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// ========== CRITICAL MIDDLEWARE ==========
// Parse JSON bodies (MUST come before routes)
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Origin:', req.headers.origin);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Body:', req.body);
    }
    next();
});

// MongoDB Connection
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
    
    mongoose.connection.db.listCollections().toArray((err, collections) => {
        if (err) return;
        console.log('📁 Collections:');
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });
    });
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
});

// ========== IMPORT MODELS ==========
const User = require('./models/User');
const Table = require('./models/Table');
const Reservation = require('./models/Reservation');

// ========== MAIN ROOT ENDPOINT ==========
app.get('/', (req, res) => {
    res.json({ 
        message: 'Restaurant Management API is running!',
        version: '2.0.0',
        endpoints: {
            api_root: '/api',
            auth: '/api/auth',
            tables: '/api/tables',
            reservations: '/api/reservations',
            staff: '/api/staff',
            analytics: '/api/analytics',
            dashboard: '/api/dashboard',
            demo_data: '/api/create-demo-data',
            health_check: '/api/health'
        }
    });
});

// ========== API ROOT ENDPOINT ==========
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Restaurant Management API',
        version: '2.0.0',
        endpoints: {
            auth: {
                root: '/api/auth',
                login: '/api/auth/login',
                register: '/api/auth/register',
                current_user: '/api/auth/me'
            },
            tables: {
                root: '/api/tables',
                available: '/api/tables/available',
                update_by_number: '/api/tables/number/:tableNumber'
            },
            reservations: {
                root: '/api/reservations',
                update_status: '/api/reservations/:id/status'
            },
            staff: '/api/staff',
            analytics: '/api/analytics',
            dashboard: {
                root: '/api/dashboard',
                stats: '/api/dashboard/stats'
            },
            demo: '/api/create-demo-data',
            health: '/api/health',
            debug: {
                reservations: '/api/debug/reservations',
                status: '/api/debug/status',
                db_test: '/api/test/db'
            }
        }
    });
});

// ========== TEST ENDPOINTS ==========
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
app.get('/api/auth', (req, res) => {
    res.json({
        success: true,
        message: 'Authentication API',
        endpoints: {
            login: '/api/auth/login [POST]',
            register: '/api/auth/register [POST]',
            current_user: '/api/auth/me [GET]',
            logout: '/api/auth/logout [POST]'
        }
    });
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token || !token.startsWith('token-')) {
            return res.status(401).json({
                success: false,
                message: 'No valid token provided'
            });
        }
        
        res.json({
            success: true,
            user: {
                _id: 'demo-user-id',
                username: 'demo',
                email: 'demo@example.com',
                role: 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email, and password are required'
            });
        }
        
        const existingUser = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }
        
        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password,
            role: role || 'customer'
        });
        
        res.status(201).json({
            success: true,
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: 'token-' + Date.now()
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const user = await User.findOne({ 
            email: email.toLowerCase() 
        });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        res.json({
            success: true,
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: 'token-' + Date.now()
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message
        });
    }
});

// ========== TABLE ROUTES ==========
app.get('/api/tables', async (req, res) => {
    try {
        const tables = await Table.find().sort({ tableNumber: 1 });
        res.json({ success: true, data: tables });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        const table = await Table.create(req.body);
        res.status(201).json({ success: true, data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== RESERVATION ROUTES ==========
app.get('/api/reservations', async (req, res) => {
    try {
        const reservations = await Reservation.find({})
            .sort({ reservationDate: -1, reservationTime: -1 });
        
        res.json({ 
            success: true, 
            data: reservations,
            count: reservations.length 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const required = ['customerName', 'customerEmail', 'customerPhone', 'tableNumber', 'reservationDate', 'reservationTime', 'partySize'];
        const missing = required.filter(field => !req.body[field]);
        
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }
        
        const reservation = await Reservation.create(req.body);
        
        await Table.findOneAndUpdate(
            { tableNumber: req.body.tableNumber },
            { status: 'reserved' }
        );
        
        res.status(201).json({
            success: true,
            data: reservation,
            message: 'Reservation created successfully!'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

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

// ========== ANALYTICS ROUTES ==========
app.get('/api/analytics', async (req, res) => {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const reservations = await Reservation.find({
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        const dailyRevenue = {};
        reservations.forEach(res => {
            const date = new Date(res.createdAt).toISOString().split('T')[0];
            const revenue = res.partySize * 50;
            dailyRevenue[date] = (dailyRevenue[date] || 0) + revenue;
        });
        
        res.json({
            success: true,
            data: {
                dailyRevenue,
                summary: {
                    totalReservations: reservations.length,
                    totalRevenue: Object.values(dailyRevenue).reduce((a, b) => a + b, 0)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== DASHBOARD ROUTES - FIXED ==========
app.get('/api/dashboard', (req, res) => {
    res.json({
        success: true,
        message: 'Dashboard API',
        endpoints: {
            stats: '/api/dashboard/stats',
            analytics: '/api/analytics',
            recent_reservations: '/api/reservations?limit=10'
        }
    });
});

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Get counts
        const totalTables = await Table.countDocuments();
        const availableTables = await Table.countDocuments({ status: 'available' });
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        console.log('Today:', today);
        
        // Get today's reservations
        const todayReservations = await Reservation.countDocuments({ 
            reservationDate: today 
        });
        
        const todayConfirmedReservations = await Reservation.countDocuments({ 
            reservationDate: today,
            status: { $in: ['confirmed', 'seated'] }
        });
        
        // Get recent reservations
        const recentReservations = await Reservation.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Calculate occupancy rate
        const occupancyRate = totalTables > 0 
            ? Math.round(((totalTables - availableTables) / totalTables) * 100) 
            : 0;
        
        console.log('Dashboard stats calculated:', {
            totalTables,
            availableTables,
            todayReservations,
            todayConfirmedReservations,
            recentReservationsCount: recentReservations.length,
            occupancyRate
        });
        
        res.json({
            success: true,
            data: {
                totalTables,
                availableTables,
                todayReservations,
                todayConfirmedReservations,
                recentReservations,
                occupancyRate
            }
        });
    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch dashboard statistics',
            error: error.message
        });
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
                role: 'admin'
            },
            { 
                username: 'staff', 
                email: 'staff@example.com', 
                password: 'password123', 
                role: 'staff'
            },
            { 
                username: 'customer', 
                email: 'customer@example.com', 
                password: 'password123', 
                role: 'customer'
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
            { tableNumber: 'T05', capacity: 8, location: 'private', status: 'available' },
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
                reservationDate: today,
                reservationTime: '18:00',
                partySize: 2,
                status: 'confirmed'
            },
            {
                customerName: 'Jane Smith',
                customerEmail: 'jane@example.com',
                customerPhone: '987-654-3210',
                tableNumber: 'T02',
                reservationDate: today,
                reservationTime: '19:30',
                partySize: 4,
                status: 'pending'
            }
        ];
        
        const createdReservations = await Reservation.insertMany(reservations);
        console.log(`✅ Created ${createdReservations.length} reservations`);
        
        res.json({ 
            success: true, 
            message: 'Demo data created successfully!'
        });
    } catch (error) {
        console.error('Demo data creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message
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
            name: mongoose.connection.name
        }
    });
});

// ========== DEBUG ENDPOINTS ==========
app.get('/api/debug/reservations/all', async (req, res) => {
    try {
        const reservations = await Reservation.find({})
            .sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/debug/status', async (req, res) => {
    try {
        const usersCount = await User.countDocuments();
        const tablesCount = await Table.countDocuments();
        const reservationsCount = await Reservation.countDocuments();
        
        res.json({
            success: true,
            database: {
                users: usersCount,
                tables: tablesCount,
                reservations: reservationsCount
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Database error: ' + error.message 
        });
    }
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
        error: err.message
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
});
