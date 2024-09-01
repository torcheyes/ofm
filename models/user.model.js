const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true
    },
    password: {
        type: String,
    },
    uuid: {
        type: String,
    },
    role: {
        type: String,
        default: 'freelancer'
    },
    bio: {
        type: String,
        default: ''
    },
    ip: {
        type: String,
        default: null
    },
    banned: {
        type: Boolean,
        default: false  
    },
    admin: {
        type: Boolean,
        default: false
    },
    contact: {
        country: {
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
        },
        whatsapp: {
            type: String,
            trim: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

const User = mongoose.model('User', UserSchema)

module.exports = User