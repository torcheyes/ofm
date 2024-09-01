const AdminAuth = async (req, res, next) => {
    if( !req.user.admin ) return res.status( 400 ).json({error: 'Unauthorised access'})

    next()
}

module.exports = {
    AdminAuth
}