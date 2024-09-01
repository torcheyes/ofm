const express = require('express')
const multer = require('multer')
const router = express.Router()
const db = require('../models')
const fs = require('fs')
const bcrypt = require('bcrypt')
const { AuthJwt } = require('../middleware/AuthJwt')
const countryDb = require('../countryDb.json')

const User = db.user

const avatarFileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/svg' || file.mimetype === 'image/gif') {
        cb(null, true)
    } else {
        cb(new Error('Only PNG, SVG, JPEG, JPG, and GIF files are allowed.'))
    }
}

const avatarStorage = multer.diskStorage({
    destination: './media/avatar/',
    filename: (req, file, cb) => {
        let uniqueFilename = false
        let newFileName

        while (!uniqueFilename) {
            newFileName = `${generateUUID()}-${file.originalname}`

            const existingDocument = fs.existsSync(`./media/avatar/${newFileName}`)
            if (!existingDocument) uniqueFilename = true
        }

        cb(null, newFileName)
    }
})

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: avatarFileFilter })

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


router.patch( '/upload-avatar', AuthJwt, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if(!req.file) return res.status(400).send({ avatar: "File not found." })

        await User.findOneAndUpdate({_id: req.user._id}, {
            avatar: req.file.filename
        })

        if( req.user.avatar ) {
            const imageExists = fs.existsSync(`./media/avatar/${req.user.avatar}`)
            if( imageExists ) {
                fs.unlinkSync(`./media/avatar/${req.user.avatar}`)
            }
        }

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.get( '/avatar/:avatarId', async (req, res) => {
    try {
        const { avatarId } = req.params
        res.setHeader('Content-Type', 'image/jpeg')

        const imageExists = fs.existsSync(`./media/avatar/${avatarId}`)
        if( imageExists ) {
            fs.createReadStream(`./media/avatar/${avatarId}`).pipe(res)
            return
        }

        res.status(400).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.patch( '/info', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        if(!bodyData?.email || !bodyData?.name) return res.status( 400 ).json({ email: "Incomplete parameters." })

        await User.findOneAndUpdate({_id: req.user._id}, {
            email: bodyData.email,
            name: bodyData.name,
            bio: bodyData?.bio || ''
        })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.patch( '/contact', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        const updateData = {}

        if( bodyData.country ) {
            const foundCountry = countryDb.find( c => c.code === bodyData.country )
            if(foundCountry) {
                updateData.country = bodyData.country
                if( bodyData.phone ) updateData.phone = bodyData.phone
            }
        }
        
        if( bodyData.telegram ) updateData.telegram = bodyData.telegram
        if( bodyData.whatsapp ) updateData.whatsapp = bodyData.whatsapp

        await User.findOneAndUpdate({_id: req.user._id}, {
            contact: updateData
        })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.patch( '/password', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        if( !bodyData?.current_password || !bodyData?.update_password_password ) return res.status( 400 ).json({ password: "Incomplete parameters." })

        const isMatch = await bcrypt.compare(bodyData.current_password, req.user.password)
        if( !isMatch ) return res.status( 400 ).json({ password: "These credentials do not match our records." })

        if( bodyData.update_password_password.length < 8 ) return res.status( 400 ).json({ new_password: "The password field must be at least 8 characters." })

        const hashedPassword = await bcrypt.hash(bodyData.update_password_password, 10)
        await User.findOneAndUpdate({_id: req.user._id}, {
            password: hashedPassword
        })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

module.exports = router