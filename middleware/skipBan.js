

const skipBan = async (req, res, next) => {
    req.skipBan = true

    next()
}

module.exports = {
    skipBan
}