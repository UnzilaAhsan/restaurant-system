const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ========== MIDDLEWARE SETUP (CORRECT ORDER) ==========
// 1. CORS First
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
                const pattern = allowedOrigin.replace(/\./g, '\\.').replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(origin)) return callback(null, true);
            } else if (origin === allowedOrigin) return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// 2. Body Parsing Middleware (CRITICAL)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Logging Middleware
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// ========== DATABASE CONNECTION ==========
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
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('💡 Troubleshooting:');
    console.log('1. Check if MongoDB Atlas cluster is running');
    console.log('2. Verify your IP is whitelisted in Network Access');
    console.log('3. Check username/password in connection string');
    process.exit(1);
});

// ========== MODELS ==========
const User = require('./models/User');
const Table = require('./models/Table');
const Reservation = require('./models/Reservation');

// ========== ROOT ENDPOINTS ==========
app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: '🍽️ Restaurant Management API',
        version: '2.0.0',
        documentation: 'Visit /api for all available endpoints',
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
        },
        quick_start: {
            create_demo_data: 'GET /api/create-demo-data',
            test_login: 'POST /api/auth/login with {email: "admin@example.com", password: "password123"}',
            view_tables: 'GET /api/tables',
            view_reservations: 'GET /api/reservations'
        }
    });
});

app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Restaurant Management API',
        version: '2.0.0',
        endpoints: {
            auth: {
                root: '/api/auth',
                login: '/api/auth/login [POST]',
                register: '/api/auth/register [POST]',
                me: '/api/auth/me [GET]',
                logout: '/api/auth/logout [POST]'
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
                reservations: '/api/debug/reservations/all',
                status: '/api/debug/status',
                db_test: '/api/test/db'
            }
        },
        database: {
            connected: mongoose.connection.readyState === 1,
            name: mongoose.connection.name,
            host: mongoose.connection.host
        }
    });
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '✅ API is healthy and running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
            connected: mongoose.connection.readyState === 1,
            name: mongoose.connection.name
        }
    });
});

// ========== TEST ENDPOINTS ==========
app.get('/api/test-db', async (req, res) => {
    try {
        const users = await User.countDocuments();
        const tables = await Table.countDocuments();
        const reservations = await Reservation.countDocuments();
        
        res.json({
            success: true,
            message: 'Database connection test successful',
            counts: { 
                users, 
                tables, 
                reservations 
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
            me: '/api/auth/me [GET]',
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
        
        const existing = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existing) {
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
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            },
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
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        // In production, use bcrypt.compare()
        if (user.password !== password) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        res.json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                salary: user.salary,
                rank: user.rank,
                phone: user.phone,
                address: user.address
            },
            token: 'token-' + Date.now()
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== TABLE ROUTES (FULLY WORKING) ==========
app.get('/api/tables', async (req, res) => {
    try {
        const tables = await Table.find().sort({ tableNumber: 1 });
        res.json({ 
            success: true, 
            data: tables,
            count: tables.length 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/tables', async (req, res) => {
    try {
        const existing = await Table.findOne({ 
            tableNumber: req.body.tableNumber 
        });
        
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Table ${req.body.tableNumber} already exists`
            });
        }
        
        const table = await Table.create(req.body);
        res.status(201).json({ 
            success: true, 
            data: table,
            message: 'Table created successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.put('/api/tables/:id', async (req, res) => {
    try {
        const table = await Table.findByIdAndUpdate(
            req.params.id,
            req.body,
            { 
                new: true, 
                runValidators: true 
            }
        );
        
        if (!table) {
            return res.status(404).json({ 
                success: false,
                message: 'Table not found' 
            });
        }
        
        res.json({ 
            success: true, 
            data: table,
            message: 'Table updated successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.put('/api/tables/number/:tableNumber', async (req, res) => {
    try {
        const table = await Table.findOneAndUpdate(
            { tableNumber: req.params.tableNumber },
            req.body,
            { 
                new: true, 
                runValidators: true 
            }
        );
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                message: 'Table not found' 
            });
        }
        
        res.json({ 
            success: true, 
            data: table,
            message: 'Table updated successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        
        res.json({ 
            success: true, 
            message: 'Table deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        
        const allTables = await Table.find({
            capacity: { $gte: parseInt(partySize) },
            status: { $ne: 'maintenance' }
        });
        
        const reservations = await Reservation.find({
            reservationDate: date,
            reservationTime: time,
            status: { $in: ['pending', 'confirmed', 'seated'] }
        });
        
        const reservedTableNumbers = reservations.map(r => r.tableNumber);
        const availableTables = allTables.filter(table => 
            !reservedTableNumbers.includes(table.tableNumber)
        );
        
        res.json({ 
            success: true, 
            data: availableTables,
            count: availableTables.length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        const required = ['customerName', 'customerEmail', 'customerPhone', 'tableNumber', 
                         'reservationDate', 'reservationTime', 'partySize'];
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
            message: error.message
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
        
        res.json({ 
            success: true, 
            data: reservation,
            message: `Reservation status updated to ${status}`
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        
        await Table.findOneAndUpdate(
            { tableNumber: reservation.tableNumber },
            { status: 'available' }
        );
        
        res.json({ 
            success: true, 
            message: 'Reservation deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== STAFF ROUTES (FULLY WORKING) ==========
app.get('/api/staff', async (req, res) => {
    try {
        const staff = await User.find({ 
            role: { $in: ['staff', 'admin'] } 
        }).select('-password');
        
        res.json({ 
            success: true, 
            data: staff,
            count: staff.length 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/staff', async (req, res) => {
    try {
        const { username, email, password, role, salary, rank, phone, address } = req.body;
        
        const existing = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existing) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }
        
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
                address: staff.address
            },
            message: 'Staff member created successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
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
        
        res.json({ 
            success: true, 
            data: staff,
            message: 'Staff member updated successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        
        res.json({ 
            success: true, 
            message: 'Staff member deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== DASHBOARD ROUTES (FULLY WORKING) ==========
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
            .limit(10)
            .select('-__v');
        
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
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== DEMO DATA ==========
app.get('/api/create-demo-data', async (req, res) => {
    try {
        await User.deleteMany({});
        await Table.deleteMany({});
        await Reservation.deleteMany({});
        
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
        
        const tables = [
            { tableNumber: 'T01', capacity: 2, location: 'indoors', status: 'available' },
            { tableNumber: 'T02', capacity: 4, location: 'indoors', status: 'available' },
            { tableNumber: 'T03', capacity: 6, location: 'outdoors', status: 'available' },
            { tableNumber: 'T04', capacity: 2, location: 'balcony', status: 'available' },
            { tableNumber: 'T05', capacity: 8, location: 'private', status: 'available' },
            { tableNumber: 'T06', capacity: 4, location: 'indoors', status: 'available' }
        ];
        
        const createdTables = await Table.insertMany(tables);
        
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
            },
            {
                customerName: 'Bob Wilson',
                customerEmail: 'bob@example.com',
                customerPhone: '555-123-4567',
                tableNumber: 'T03',
                reservationDate: tomorrowStr,
                reservationTime: '20:00',
                partySize: 6,
                status: 'confirmed'
            }
        ];
        
        const createdReservations = await Reservation.insertMany(reservations);
        
        res.json({ 
            success: true, 
            message: '✅ Demo data created successfully!',
            counts: {
                users: createdUsers.length,
                tables: createdTables.length,
                reservations: createdReservations.length
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
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
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

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
            recentReservations: recentReservations
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
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
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`🔑 Demo login: admin@example.com / password123`);
    console.log(`🔄 Create demo data: http://localhost:${PORT}/api/create-demo-data`);
});
