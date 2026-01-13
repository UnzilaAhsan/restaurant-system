const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const { protect, staff, admin } = require('../middleware/auth');

// @desc    Get all reservations
// @route   GET /api/reservations
// @access  Private (All authenticated users, with role-based filtering)
router.get('/', protect, async (req, res) => {
    try {
        console.log('📋 FETCH RESERVATIONS REQUEST:');
        console.log('User Role:', req.user.role);
        console.log('User Email:', req.user.email);
        console.log('Query Params:', req.query);

        const { date, status, email, tableNumber, customerName } = req.query;
        let filter = {};
        
        // ROLE-BASED FILTERING
        if (req.user.role === 'customer') {
            // Customers only see their own reservations
            filter.customerEmail = req.user.email;
            console.log('🔒 Customer filter: Only showing reservations for', req.user.email);
        } else if (req.user.role === 'staff') {
            // Staff can see all reservations, but can filter by email if needed
            if (email) {
                filter.customerEmail = email;
                console.log('👨‍🍳 Staff filtering by customer email:', email);
            }
            // If no email filter, show all reservations (no filter)
        } else if (req.user.role === 'admin') {
            // Admin can see all reservations
            if (email) {
                filter.customerEmail = email;
                console.log('👑 Admin filtering by email:', email);
            }
            // If no filters, admin sees ALL reservations
        }
        
        // DATE FILTER
        if (date && date !== 'all') {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            filter.reservationDate = { 
                $gte: startDate,
                $lt: endDate 
            };
            console.log('📅 Date filter:', startDate, 'to', endDate);
        }
        
        // STATUS FILTER
        if (status && status !== 'all') {
            filter.status = status;
            console.log('📊 Status filter:', status);
        }
        
        // TABLE NUMBER FILTER
        if (tableNumber && tableNumber !== 'all') {
            filter.tableNumber = tableNumber;
            console.log('🪑 Table filter:', tableNumber);
        }
        
        // CUSTOMER NAME FILTER
        if (customerName) {
            filter.customerName = { $regex: customerName, $options: 'i' };
            console.log('👤 Name filter:', customerName);
        }
        
        console.log('🔍 Final MongoDB filter:', JSON.stringify(filter, null, 2));
        
        // FETCH RESERVATIONS
        const reservations = await Reservation.find(filter)
            .populate('tableId', 'tableNumber capacity location')
            .populate('createdBy', 'username email role')
            .sort({ reservationDate: -1, reservationTime: -1 });
        
        console.log('✅ Found', reservations.length, 'reservations');
        
        // Log each reservation for debugging
        reservations.forEach((res, index) => {
            console.log(`${index + 1}. ${res.customerName} - ${res.reservationDate} ${res.reservationTime} - ${res.tableNumber} - ${res.status} - Created by: ${res.createdBy?.email || 'Unknown'}`);
        });
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
        
    } catch (error) {
        console.error('❌ Error fetching reservations:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Get user's reservations (for customer profile)
// @route   GET /api/reservations/my-reservations
// @access  Private (Customer only)
router.get('/my-reservations', protect, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only customers can access this endpoint' 
            });
        }
        
        const reservations = await Reservation.find({ 
            customerEmail: req.user.email 
        })
        .populate('tableId', 'tableNumber capacity location')
        .sort({ reservationDate: -1, reservationTime: -1 });
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
        
    } catch (error) {
        console.error('Error fetching user reservations:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Create reservation
// @route   POST /api/reservations
// @access  Private (All authenticated users)
router.post('/', protect, async (req, res) => {
    try {
        console.log('➕ CREATE RESERVATION REQUEST:');
        console.log('Request Body:', req.body);
        console.log('Created by user:', req.user.email, 'Role:', req.user.role);
        
        const {
            customerName,
            customerEmail,
            customerPhone,
            tableId,
            tableNumber,
            reservationDate,
            reservationTime,
            partySize,
            specialRequests
        } = req.body;
        
        // VALIDATION
        if (!customerName || !customerEmail || !customerPhone || !reservationDate || !reservationTime || !partySize) {
            return res.status(400).json({ 
                success: false,
                message: 'Please provide all required fields' 
            });
        }
        
        // For customers, ensure they can only create reservations for themselves
        if (req.user.role === 'customer' && customerEmail !== req.user.email) {
            return res.status(403).json({ 
                success: false,
                message: 'Customers can only create reservations for themselves' 
            });
        }
        
        // CHECK TABLE AVAILABILITY
        let table;
        if (tableId) {
            table = await Table.findById(tableId);
        } else if (tableNumber) {
            table = await Table.findOne({ tableNumber: tableNumber });
        }
        
        if (!table) {
            return res.status(404).json({ 
                success: false,
                message: 'Table not found' 
            });
        }
        
        if (table.capacity < partySize) {
            return res.status(400).json({ 
                success: false,
                message: `Table capacity (${table.capacity}) exceeded. Party size: ${partySize}` 
            });
        }
        
        // Check for existing reservation at same time
        const existingReservation = await Reservation.findOne({
            $or: [
                { tableId: table._id },
                { tableNumber: table.tableNumber }
            ],
            reservationDate: new Date(reservationDate),
            reservationTime: reservationTime,
            status: { $in: ['pending', 'confirmed', 'seated'] }
        });
        
        if (existingReservation) {
            return res.status(400).json({ 
                success: false,
                message: `Table ${table.tableNumber} is already reserved at ${reservationTime}` 
            });
        }
        
        // CREATE RESERVATION
        const reservation = await Reservation.create({
            customerName,
            customerEmail,
            customerPhone,
            tableId: table._id,
            tableNumber: table.tableNumber,
            reservationDate: new Date(reservationDate),
            reservationTime,
            partySize,
            specialRequests,
            createdBy: req.user._id,
            status: req.user.role === 'customer' ? 'pending' : 'confirmed'
        });
        
        console.log('✅ Reservation created successfully:', reservation._id);
        
        // UPDATE TABLE STATUS
        table.status = 'reserved';
        await table.save();
        console.log('🔄 Table status updated to "reserved"');
        
        // POPULATE AND RETURN
        const populatedReservation = await Reservation.findById(reservation._id)
            .populate('tableId', 'tableNumber capacity location')
            .populate('createdBy', 'username email role');
        
        res.status(201).json({
            success: true,
            data: populatedReservation
        });
        
    } catch (error) {
        console.error('❌ Error creating reservation:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ 
                success: false, 
                message: messages.join(', ') 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating reservation' 
        });
    }
});

// @desc    Update reservation status
// @route   PUT /api/reservations/:id/status
// @access  Private (Staff/Admin only)
router.put('/:id/status', protect, staff, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status || !['pending', 'confirmed', 'seated', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status' 
            });
        }
        
        const reservation = await Reservation.findById(req.params.id)
            .populate('tableId', 'tableNumber');
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // UPDATE RESERVATION
        reservation.status = status;
        reservation.updatedBy = req.user._id;
        await reservation.save();
        
        // UPDATE TABLE STATUS
        if (status === 'cancelled' || status === 'completed') {
            await Table.findByIdAndUpdate(reservation.tableId, { 
                status: 'available' 
            });
            console.log(`🔄 Table ${reservation.tableNumber} set to available`);
        } else if (status === 'seated') {
            await Table.findByIdAndUpdate(reservation.tableId, { 
                status: 'occupied' 
            });
            console.log(`🔄 Table ${reservation.tableNumber} set to occupied`);
        } else if (status === 'confirmed') {
            await Table.findByIdAndUpdate(reservation.tableId, { 
                status: 'reserved' 
            });
            console.log(`🔄 Table ${reservation.tableNumber} set to reserved`);
        }
        
        const updatedReservation = await Reservation.findById(req.params.id)
            .populate('tableId', 'tableNumber capacity location')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');
        
        res.json({
            success: true,
            data: updatedReservation
        });
        
    } catch (error) {
        console.error('Error updating reservation status:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Cancel reservation
// @route   PUT /api/reservations/:id/cancel
// @access  Private (Customer can cancel their own, Staff/Admin can cancel any)
router.put('/:id/cancel', protect, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // Check permissions
        if (req.user.role === 'customer' && reservation.customerEmail !== req.user.email) {
            return res.status(403).json({ 
                success: false,
                message: 'You can only cancel your own reservations' 
            });
        }
        
        // UPDATE RESERVATION
        reservation.status = 'cancelled';
        reservation.updatedBy = req.user._id;
        await reservation.save();
        
        // UPDATE TABLE
        await Table.findOneAndUpdate(
            { tableNumber: reservation.tableNumber }, 
            { status: 'available' }
        );
        
        res.json({
            success: true,
            message: 'Reservation cancelled successfully'
        });
        
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Get reservation by ID
// @route   GET /api/reservations/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate('tableId', 'tableNumber capacity location')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // Check permissions
        if (req.user.role === 'customer' && reservation.customerEmail !== req.user.email) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized to view this reservation' 
            });
        }
        
        res.json({
            success: true,
            data: reservation
        });
        
    } catch (error) {
        console.error('Error fetching reservation:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Update reservation
// @route   PUT /api/reservations/:id
// @access  Private (Staff/Admin only)
router.put('/:id', protect, staff, async (req, res) => {
    try {
        const reservation = await Reservation.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
        .populate('tableId', 'tableNumber capacity location')
        .populate('createdBy', 'username email');
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        res.json({
            success: true,
            data: reservation
        });
        
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Delete reservation
// @route   DELETE /api/reservations/:id
// @access  Private (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false,
                message: 'Reservation not found' 
            });
        }
        
        // Free the table
        await Table.findOneAndUpdate(
            { tableNumber: reservation.tableNumber },
            { status: 'available' }
        );
        
        await reservation.remove();
        
        res.json({
            success: true,
            message: 'Reservation deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Get today's reservations
// @route   GET /api/reservations/today
// @access  Private (Staff/Admin)
router.get('/today', protect, staff, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const reservations = await Reservation.find({
            reservationDate: { $gte: today, $lt: tomorrow }
        })
        .populate('tableId', 'tableNumber capacity location')
        .sort({ reservationTime: 1 });
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
        
    } catch (error) {
        console.error('Error fetching today\'s reservations:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// @desc    Get upcoming reservations
// @route   GET /api/reservations/upcoming
// @access  Private
router.get('/upcoming', protect, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let filter = {
            reservationDate: { $gte: today },
            status: { $in: ['pending', 'confirmed'] }
        };
        
        // Role-based filtering
        if (req.user.role === 'customer') {
            filter.customerEmail = req.user.email;
        }
        
        const reservations = await Reservation.find(filter)
            .populate('tableId', 'tableNumber capacity location')
            .sort({ reservationDate: 1, reservationTime: 1 })
            .limit(20);
        
        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
        
    } catch (error) {
        console.error('Error fetching upcoming reservations:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;