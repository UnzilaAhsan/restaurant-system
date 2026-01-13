const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    tableNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    location: {
        type: String,
        enum: ['indoors', 'outdoors', 'balcony', 'private'],
        default: 'indoors'
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'reserved', 'maintenance'],
        default: 'available'
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    collection: 'tables' // Explicitly set collection name
});

// Indexes
TableSchema.index({ tableNumber: 1 }, { unique: true });
TableSchema.index({ status: 1 });
TableSchema.index({ location: 1 });
TableSchema.index({ capacity: 1 });

module.exports = mongoose.model('Table', TableSchema);