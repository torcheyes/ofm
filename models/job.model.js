const mongoose = require('mongoose')

const JobSchema = new mongoose.Schema({
    category: {
        type: String,
        trim: true
    },
    title: {
        type: String,
        trim: true
    },
    content: {
        type: String
    },
    type: {
        type: String,
        default: 'part',
        trim: true
    },
    editedTimestamp: {
        type: Date
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    tags: [
        String
    ],
    /*contact: {
        name: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true
        },
        phone_country: {
            type: String,
            trim: true,
            default: null
        },
        phone: {
            type: String,
            trim: true
        },
        telegram: {
            type: String,
            trim: true
        }
    },*/
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

const Job = mongoose.model('Job', JobSchema)

module.exports = Job