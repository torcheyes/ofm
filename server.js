const config = require('./config')

const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const cookieParser = require( 'cookie-parser' )
const db = require('./models')
const { CheckIp } = require('./middleware/CheckIP')
const path = require('path')

const User = db.user

db.mongoose.set('strictQuery', false)

db.mongoose
    .connect(config.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(async () => {
        console.log(`Successfully connected to MongoDB.`)

        /*const hashedPassword = await bcrypt.hash('test', 10)
        const user = await User.create({
            username: 'LogicielX',
            password: hashedPassword,
            uuid: 'Logiciel uuid :)',
            superAdminAccess: true
        })*/

        //await User.updateOne({ name: 'LogicielX' }, { admin: true })

        initServer()
    })
    .catch((error) => {
        console.log(`Error connecting to MongoDB: ${error.message}`)
    })

const initServer = () => {
    console.log(`Initializing servers.`)

    const corsOptions = {
        "origin": [config.CLIENT_URL, "http://localhost:3000"],
        "methods": ['POST', 'PATCH', 'PUT', 'GET', 'OPTIONS', 'HEAD', 'DELETE'],
        "credentials": true,
        "preflightContinue": false,
        "optionsSuccessStatus": 204,
        "exposedHeaders": ["set-cookie"]
    }

    app.set( 'trust proxy', false )

    app.use( /*express.text(),*/ express.json() )
    app.use( '/_api', bodyParser.urlencoded({ extended: true }) )
    app.use( '/_api', cookieParser() )
    app.use( '/_api', cors(corsOptions) )
    app.use( '/_api', express.static( __dirname + '/public' ) )
    app.use( '/_api', CheckIp )

    const authRoute = require('./routes/auth.route')
    const jobRoute = require('./routes/job.route')
    const profileRoute = require('./routes/profile.route')
    const adminRoute = require('./routes/admin.route')


    app.use( '/_api/auth', authRoute )
    app.use( '/_api/job', jobRoute )
    app.use( '/_api/profile', profileRoute )
    app.use( '/_api/admin', adminRoute )


    app.use(express.static(path.join(__dirname, 'build')))
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'build', 'index.html'))
    })

    const httpServer = http.createServer(app)

    httpServer.listen( config.PORT, () => {
        console.log(`Listening on port ${config.PORT}.`)
    })

}