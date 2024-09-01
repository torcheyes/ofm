const db = require("../models")
const User = db.user

const AuthJwt = async (req, res, next) => {
    if( !req.cookies.sct ) return res.status( 400 ).json({error: 'Unauthorised access'})

    const user = await User.findOne({uuid: req.cookies.sct})
    if(!user) return res.status( 400 ).json({error: 'Unauthorised access'})
    
    if(!req.skipBan && user.banned) return res.status(405).json({banned: "This user is banned from this platform."})

    req.user = user
    
    next()
}

module.exports = {
    AuthJwt
}