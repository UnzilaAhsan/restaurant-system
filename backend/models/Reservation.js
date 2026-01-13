const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    // REMOVE tableId or make it optional
    // tableId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Table',
    //     required: false // Change to false if you want to keep it
    // },
    tableNumber: {
        type: String,
        required: true
    },
    reservationDate: {
        type: Date,
        required: true
    },
    reservationTime: {
        type: String,
        required: true
    },
    partySize: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled'],
        default: 'pending'
    },
    specialRequests: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);