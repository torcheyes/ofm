const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const db = require('../models')
const { AuthJwt } = require('../middleware/AuthJwt')
const { createLimiter } = require('../middleware/RateLimits')

const User = db.user
const Job = db.job
const Comment = db.comment


router.post('/create', AuthJwt, createLimiter(1, 1.5 * 60 * 60 * 1000, 'content'), async (req, res) => {
    try {
        const bodyData = req.body

        if(!bodyData?.title || !bodyData?.category || !bodyData?.content || !bodyData?.type) return res.status( 400 ).json({ content: "Incomplete parameters." })

        if( !['full', 'part'].includes(bodyData.type) ) return res.status( 400 ).json({ content: "Invalid parameters." })
        
        if( bodyData.title.length < 30 ) return res.status( 400 ).json({ title: "The title field must be at least 30 characters." }) 
        if( bodyData.content.length < 100 ) return res.status( 400 ).json({ content: "The description field must be at least 100 characters." }) 


        const newJob = await Job.create({
            title: bodyData.title,
            content: bodyData.content,
            category: bodyData.category,
            owner: req.user._id,
            type: bodyData.type
        })

        res.status( 200 ).json({job: newJob._id.toString()})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/edit/:jobId', AuthJwt, async (req, res) => {
    try {
        const jobId = req.params.jobId
        const bodyData = req.body

        if(!bodyData?.title || !bodyData?.type || !bodyData?.category || !bodyData?.content || !Array.isArray(bodyData?.tags)) return res.status( 400 ).json({ content: "Incomplete parameters." })
        
        if( !['full', 'part'].includes(bodyData.type) ) return res.status( 400 ).json({ content: "Invalid parameters." })

        if( bodyData.title.length < 30 ) return res.status( 400 ).json({ title: "The title field must be at least 30 characters." }) 
        if( bodyData.content.length < 100 ) return res.status( 400 ).json({ content: "The description field must be at least 100 characters." }) 

        const jobExists = await Job.exists({_id: jobId, owner: req.user._id})
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

router.delete('/:jobId', AuthJwt, async (req, res) => {
    try {
        const jobId = req.params.jobId

        const jobExists = await Job.exists({_id: jobId, owner: req.user._id})
        if(!jobExists) return res.status( 400 ).json({ content: "Job not found." })

        await Job.findOneAndDelete({_id: jobId })
        await Comment.deleteMany({job: jobId })

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/', AuthJwt, async (req, res) => {
    try {

        const jobs = await Job.find({
            owner: req.user._id
        })

        res.status( 200 ).json({jobs: jobs})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/jobList', AuthJwt, async (req, res) => {
    try {
        const { page = 1, filter_date, category, tag, jobtype } = req.query
        const limit = 5

        const jobs = await Job.find({
            ...(category ? {category} : {}),
            ...(tag ? {tags: tag} : {}),
            ...(jobtype ? {type: jobtype} : {})
        })
        .populate('owner', 'name avatar email contact')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: filter_date === 'oldest' ? 1 : -1 })

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

router.get('/:jobId', AuthJwt, async (req, res) => {
    try {
        const jobId = req.params.jobId
        const job = await Job.findOne({
            owner: req.user._id,
            _id: jobId
        })

        if( !job ) return res.status( 400 ).json({ message: "Job not found." })

        res.status( 200 ).json({job: job})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/view/:jobId', AuthJwt, async (req, res) => {
    try {
        const jobId = req.params.jobId
        const job = await Job.findOne({
            _id: jobId
        })
        .populate('owner', 'name avatar email contact')

        if( !job ) return res.status( 400 ).json({ message: "Job not found." })

        res.status( 200 ).json({job: job})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.get('/:jobId/comments', AuthJwt, async (req, res) => {
    try {
        const { page = 1 } = req.query
        const limit = 3

        const jobId = req.params.jobId
        const comments = await Comment.find({ job: jobId })
            .populate('owner', 'name avatar email contact')
            .populate('reactions.like', 'name')
            .populate('reactions.dislike', 'name')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })

        const count = await Comment.countDocuments({ job: jobId })

        res.status( 200 ).json({
            comments: comments,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        })
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/comment', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        if(!bodyData?.content || !bodyData?.job || !db.mongoose.Types.ObjectId.isValid(bodyData?.job)) return res.status( 400 ).json({ content: "Incomplete parameters." })

        const newComment = await Comment.create({
            content: bodyData.content,
            owner: req.user._id,
            job: bodyData.job
        })

        const populatedComment = await Comment.findById(newComment._id)
            .populate('owner', 'name avatar email contact')

        res.status( 200 ).json({comment: populatedComment})
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})

router.post('/reaction', AuthJwt, async (req, res) => {
    try {
        const bodyData = req.body

        if(
            !bodyData?.job ||
            !db.mongoose.Types.ObjectId.isValid(bodyData?.job) ||
            !bodyData?.comment ||
            !db.mongoose.Types.ObjectId.isValid(bodyData?.comment) ||
            !bodyData?.reaction
        ) return res.status( 400 ).json({ content: "Incomplete parameters." })

        const comment = await Comment.findOne({
            job: bodyData.job,
            _id: bodyData.comment
        })

        if( !comment ) return res.status( 400 ).json({ message: "Comment not found." })

        if( bodyData.reaction === 'like' ) {
            comment.reactions['dislike'] = comment.reactions[bodyData.reaction].filter( r => r.toString() !== req.user._id.toString() )
        } else if ( bodyData.reaction === 'dislike' ) {
            comment.reactions['like'] = comment.reactions[bodyData.reaction].filter( r => r.toString() !== req.user._id.toString() )
        }

        if( comment.reactions[bodyData.reaction].includes( req.user._id ) ) {
            comment.reactions[bodyData.reaction] = comment.reactions[bodyData.reaction].filter( r => r.toString() !== req.user._id.toString() )
        } else {
            comment.reactions[bodyData.reaction].push(req.user._id)
        }
        
        await comment.save()

        res.status( 200 ).end()
    } catch (err) {
        console.error(err.message)
        res.status(500).json({ message: err.message })
    }
})



module.exports = router