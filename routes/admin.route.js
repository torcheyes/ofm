const express = require('express')
const router = express.Router()
const db = require('../models')
const fs = require('fs')
const bcrypt = require('bcrypt')
const { AuthJwt } = require('../middleware/AuthJwt')
const { AdminAuth } = require('../middleware/AdminAuth')
const countryDb = require('../countryDb.json')

const User = db.user
const Job = db.job
const Comment = db.comment



router.get('/user/:userId', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params

        const user = await User.findOne({_id: userId})
            .select('name bio avatar email contact admin banned')

        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        res.status( 200 ).json({user: user})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})


router.get('/job/:jobId', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { jobId } = req.params

        const job = await Job.findOne({_id: jobId})
            .populate('owner', 'name bio avatar email contact admin banned')

        if( !job ) return res.status(400).json({mesasge: 'Job not found.'})

        res.status( 200 ).json({job: job})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/users', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { page = 1 } = req.query
        const limit = 10

        const users = await User.find({})
            .select('name avatar email contact admin banned')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })

        const count = await User.countDocuments({})

        res.status( 200 ).json({
            users: users,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        })
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})


router.get('/jobs', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { page = 1 } = req.query
        const limit = 10

        const jobs = await Job.find({})
            .populate('owner', 'name avatar email contact admin banned')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })

        const count = await Job.countDocuments({})

        res.status( 200 ).json({
            jobs: jobs,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        })
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})


router.patch( '/user/:userId/info', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params
        const bodyData = req.body

        if( !db.mongoose.Types.ObjectId.isValid(userId) ) return res.status( 400 ).json({ new_password: "Invalid parameters." })

        const user = await User.findOne({_id: userId})
        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        if(!bodyData?.email || !bodyData?.name) return res.status( 400 ).json({ email: "Incomplete parameters." })

        await User.findOneAndUpdate({_id: userId}, {
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

router.patch( '/user/:userId/contact', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params
        const bodyData = req.body

        if( !db.mongoose.Types.ObjectId.isValid(userId) ) return res.status( 400 ).json({ new_password: "Invalid parameters." })

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

        await User.findOneAndUpdate({_id: userId}, {
            contact: updateData
        })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.patch( '/user/:userId/password', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params
        const bodyData = req.body

        if( !db.mongoose.Types.ObjectId.isValid(userId) ) return res.status( 400 ).json({ new_password: "Invalid parameters." })

        const user = await User.findOne({_id: userId})
        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        if( !bodyData?.update_password_password ) return res.status( 400 ).json({ new_password: "Incomplete parameters." })

        if( bodyData.update_password_password.length < 8 ) return res.status( 400 ).json({ new_password: "The password field must be at least 8 characters." })

        const hashedPassword = await bcrypt.hash(bodyData.update_password_password, 10)
        await User.findOneAndUpdate({_id: userId}, {
            password: hashedPassword
        })

        res.status(200).end()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Internal server error' })
    }
} )

router.delete('/user/:userId', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params

        const user = await User.findOne({_id: userId})
        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        await User.deleteOne({_id: userId})

        await Job.deleteMany({owner: userId})
        await Comment.deleteMany({owner: userId})

        if( user.avatar ) {
            const imageExists = fs.existsSync(`./media/avatar/${user.avatar}`)
            if( imageExists ) {
                fs.unlinkSync(`./media/avatar/${user.avatar}`)
            }
        }

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/user/:userId/ban', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params
        const user = await User.findOne({_id: userId})
        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        await User.updateOne({_id: userId}, {banned: true})

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/user/:userId/unban', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const { userId } = req.params

        const user = await User.findOne({_id: userId})
        if( !user ) return res.status(400).json({mesasge: 'User not found.'})

        await User.updateOne({_id: userId}, { banned: false})

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.patch('/job/:jobId', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const jobId = req.params.jobId
        const bodyData = req.body

        if(!bodyData?.title || !bodyData?.type || !bodyData?.category || !bodyData?.content || !Array.isArray(bodyData?.tags)) return res.status( 400 ).json({ content: "Incomplete parameters." })
        
        if( !['full', 'part'].includes(bodyData.type) ) return res.status( 400 ).json({ content: "Invalid parameters." })

        if( bodyData.title.length < 30 ) return res.status( 400 ).json({ title: "The title field must be at least 30 characters." }) 
        if( bodyData.content.length < 100 ) return res.status( 400 ).json({ content: "The description field must be at least 100 characters." }) 

        const jobExists = await Job.exists({_id: jobId})
        if(!jobExists) return res.status( 400 ).json({ content: "Job not found." })

        await Job.findOneAndUpdate(
            {_id: jobId },
            {
                title: bodyData.title,
                content: bodyData.content,
                category: bodyData.category,
                tags: bodyData.tags,
                editedTimestamp: Date.now(),
                type: bodyData.type
            }
        )

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.delete('/job/:jobId', AuthJwt, AdminAuth, async (req, res) => {
    try {
        const jobId = req.params.jobId

        const jobExists = await Job.exists({_id: jobId})
        if(!jobExists) return res.status( 400 ).json({ content: "Job not found." })

        await Job.findOneAndDelete({_id: jobId })
        await Comment.deleteMany({job: jobId })

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

module.exports = router