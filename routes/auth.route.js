const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const db = require('../models')
const fs = require('fs')
const { AuthJwt } = require('../middleware/AuthJwt')
const { skipBan } = require('../middleware/skipBan')
const multer = require('multer')
const path = require('path')

const User = db.user
const Job = db.job
const Comment = db.comment

function removeFilesByBaseName(dir, baseName) {
    const files = fs.readdirSync(dir)
    files.forEach(file => {
        if (path.basename(file, path.extname(file)) === baseName) {
            const filePath = path.join(dir, file)
            fs.unlinkSync(filePath)
        }
    })
}

function findFileByBaseName(dir, baseName) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
        if (path.basename(file, path.extname(file)) === baseName) {
            return path.join(dir, file)
        }
    }
    return null
}

function isLocalIp(ip) {
    return ip === "127.0.0.1" || ip === "::1"
}

function generateUUID() {
    var d = new Date().getTime()
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0
        d = Math.floor(d / 16)
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

const adFileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/svg' || file.mimetype === 'image/gif') {
        cb(null, true)
    } else {
        cb(new Error('Only PNG, SVG, JPEG, JPG, and GIF files are allowed.'))
    }
}

const adStorage = multer.diskStorage({
    destination: './media/ads/',
    filename: (req, file, cb) => {
        const fileExt = /[^.]+$/.exec(file.originalname)

        removeFilesByBaseName('./media/ads/', req.params.adId)

        cb(null, `${req.params.adId}.${fileExt}`)
    }
})

const uploadAd = multer({ storage: adStorage, fileFilter: adFileFilter })

router.patch( '/upload-ad/:adId', AuthJwt, uploadAd.single('ad'), async (req, res) => {
    try {
        if(!req.file) return res.status(400).send({ avatar: "File not found." })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.get( '/ad/:adId', async (req, res) => {
    try {
        const { adId } = req.params
        res.setHeader('Content-Type', 'image/jpeg')

        const adPath = findFileByBaseName('./media/ads', adId)
        if( adPath ) {
            fs.createReadStream(adPath).pipe(res)
            return
        }

        res.status(400).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )


router.post('/signup', async (req, res) => {
    try {
        const bodyData = req.body

        const requestIp = (req.header('x-forwarded-for') || req.socket.remoteAddress || '').toString()

        const isIpLocal = isLocalIp(requestIp)

        let ipAddress
        if( !isIpLocal ) {
            const ipMatch = requestIp.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
            if( ipMatch && ipMatch[0] ) {
                ipAddress = ipMatch[0]
            }
        }

        if(!bodyData?.email || !bodyData?.password || !bodyData?.name || !bodyData?.role) return res.status( 400 ).json({ email: "Incomplete parameters." })

        if(!['freelancer', 'client'].includes( bodyData.role )) return res.status( 400 ).json({ password_confirmation: "Invalid parameters." })

        const userExists = await User.exists({ email: bodyData.email.trim() })

        if( userExists ) return res.status( 400 ).json({ email: "The email has already been taken." })

        if( bodyData.password.length < 8 ) return res.status( 400 ).json({ password_confirmation: "The password field must be at least 8 characters." })

        let uuid
        let uuidExists = true
        while (uuidExists) {
            uuid = generateUUID()
            const existingUser = await User.exists({ uuid })
            uuidExists = !!existingUser
        }

        const hashedPassword = await bcrypt.hash(bodyData.password, 10)
        await User.create({
            name: bodyData.name,
            email: bodyData.email,
            password: hashedPassword,
            uuid,
            role: bodyData.role,
            ...( ipAddress ? {ip: ipAddress} : {} )
        })

        res.status( 200 ).cookie( 'sct', uuid, {
            expires: new Date( Date.now() + 24 * 3600000 ),
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        } ).end()
        
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/signin', async (req, res) => {
    try {
        const bodyData = req.body

        if(!bodyData?.email || !bodyData?.password) return res.status( 400 ).json({ email: "Incomplete parameters." })

        const userFound = await User.findOne({ email: bodyData.email.trim() })
        if( !userFound ) return res.status( 400 ).json({ email: "These credentials do not match our records." })

        const isMatch = await bcrypt.compare(bodyData.password, userFound.password)
        if( !isMatch ) return res.status( 400 ).json({ email: "These credentials do not match our records." })

        const exiresIn = bodyData.remember ? 240 * 3600000 : 24 * 3600000

        res.status( 200 ).cookie( 'sct', userFound.uuid, {
            expires: new Date( Date.now() + exiresIn ),
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        } ).end()
        
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/user', async (req, res) => {
    try {
        if( !req.cookies.sct ) return res.status( 400 ).end()
        const userFound = await User.findOne({ uuid: req.cookies.sct })
            .select('name bio email avatar admin banned contact')
            
        if( !userFound ) return res.status( 400 ).end()

        res.status( 200 ).json(userFound)
        
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.delete('/user', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        if(!bodyData?.password) return res.status( 400 ).json({ password: "Incomplete parameters." })

        const isMatch = await bcrypt.compare(bodyData.password, req.user.password)
        if( !isMatch ) return res.status( 400 ).json({ password: "These credentials do not match our records." })

        await User.deleteOne({_id: req.user._id})

        await Job.deleteMany({owner: req.user._id})
        await Comment.deleteMany({owner: req.user._id})

        if( req.user.avatar ) {
            const imageExists = fs.existsSync(`./media/avatar/${req.user.avatar}`)
            if( imageExists ) {
                fs.unlinkSync(`./media/avatar/${req.user.avatar}`)
            }
        }


        res.status( 200 ).clearCookie('sct').end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/logout', skipBan, AuthJwt, async (req, res) => {
    try {
        res.status( 200 ).clearCookie('sct').end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

module.exports = router