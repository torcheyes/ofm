const db = require("../models")
const User = db.user

function isLocalIp(ip) {
    return ip === "127.0.0.1" || ip === "::1"
}

const CheckIp = async (req, res, next) => {
    const requestIp = (req.header('x-forwarded-for') || req.socket.remoteAddress || '').toString()
    const isIpLocal = isLocalIp(requestIp)
    let ipAddress
    if( !isIpLocal ) {
        const ipMatch = requestIp.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
        if( ipMatch && ipMatch[0] ) {
            ipAddress = ipMatch[0]
        }
    }

    if( ipAddress ) {
        const isBanned = await User.exists({banned: true, ip: ipAddress})
        if(isBanned) return res.status(405).json({banned: "This user is banned from this platform."})
    }

    next()
}

module.exports = {
    CheckIp
}