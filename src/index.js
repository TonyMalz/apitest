const port = 3030;

const express = require('express');
const session = require('express-session')
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const uuid = require('uuid/v4');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;


const app = express();
app.use(session({
    secret: 'rZljfHWcmb3palot7kdQJs7nmjqPM8P0',
    // force save session to store, even if session was never modified
    // set to true only if store does not implement touch method and sets expiration date on stored sessions
    resave: false,
    // do not force new (first time) sessions to be saved to store 
    // and stay compliant with laws that require user permission before setting cookies
    saveUninitialized: false,
    genid: (req) => {
        console.log('---- Inside the session middleware')
        console.log(req.sessionID)
        return uuid() // use UUIDs for session IDs
    },
    cookie: {
        maxAge: 10000 // 10 seconds
    },
}))

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
const cOptions = { origin: true, credentials: true };
app.use(cors(cOptions));

// adding morgan to log HTTP requests
app.use(morgan('combined'));

// add session authentication with passport
app.use(passport.initialize());
app.use(passport.session());

// DB
const { connectDB, getMongoUrl } = require("./db/mongo")
const { getUsers, insertUser, updateUser, deleteUser } = require("./db/users")
const User = require('./models/user');

connectDB().then(async () => {

    // add some sample data to user collection
    await insertUser({ username: 'Peter Pan 1', email: 'p1.pan@mail.de', timeStored: new Date() });
    await insertUser({ username: 'Peter Pan 2', email: 'p2.pan@mail.de', timeStored: new Date() });
    await insertUser({ username: 'Peter Pan 3', email: 'p3.pan@mail.de', timeStored: new Date() });

    // ROUTES without mongoose
    app.get('/users', async (req, res) => {
        const users = await getUsers();
        res.send(users.map(user => {
            return { ...user, ts: new Date() }
        }));
    });
    app.post('/users', async (req, res) => {
        const newUser = req.body;
        await insertUser(newUser);
        res.send({ message: 'New user inserted.' });
    });
    app.delete('/users/:id', async (req, res) => {
        await deleteUser(req.params.id);
        res.send({ message: 'User removed.' });
    });
    app.put('/users/:id', async (req, res) => {
        const updatedUser = req.body;
        await updateUser(req.params.id, updatedUser);
        res.send({ message: 'User updated.' });
    });


    // ROUTES with mongoose
    mongoose.set('useUnifiedTopology', true);
    mongoose.set('useNewUrlParser', true);
    mongoose.connect(getMongoUrl());
    mongoose.connection.on('connected', () => {
        console.log('[Mongoose] Connected to MongoDB');
    });

    const newUser = new User();
    newUser.username = "Peter Mann"
    newUser.email = "hans@hans.de"
    newUser.setPassword("abc123");
    newUser.save()

    app.post('/signup', (req, res) => {
        if (!req.body.username || req.body.username.length < 1
            || !req.body.email || req.body.email.length < 1
            || !req.body.password || req.body.password.length < 1
        ) {
            return res.status(400).send({ message: "username, password, and email must not be empty to signup" });
        }
        const newUser = new User();
        newUser.username = req.body.username;
        newUser.email = req.body.email;
        newUser.setPassword(req.body.password);
        newUser.save((err, User) => {
            if (err) {
                return res.status(500).send({
                    message: "Failed to add user."
                });
            }
            else {
                return res.status(201).send({
                    message: "User signed up succesfully."
                });
            }
        });
    });

    app.post('/login', (req, res) => {
        if (!req.body.username || req.body.username.length < 1 || !req.body.password || req.body.password.length < 1) {
            return res.status(400).send({ message: "username and password must not be empty to authenticate" });
        }

        User.findOne({ email: req.body.username }, (err, user) => {
            if (user === null) {
                return res.status(400).send({
                    message: "Username or password is invalid"
                });
            }
            else {
                if (user.isPasswordValid(req.body.password)) {
                    return res.status(201).send({
                        message: `User [${user.username}] was successfully authenticated`,
                    })
                }
                else {
                    return res.status(400).send({
                        message: "Username or password is invalid"
                    });
                }
            }
        });
    });

    // tell passport how to validate a user
    passport.use(new LocalStrategy(
        // { usernameField: 'email' },
        (email, password, done) => {
            console.log('---- Inside local strategy callback')
            User.findOne({ email }, (err, user) => {
                if (user && user.isPasswordValid(password)) {
                    console.log('---- Local strategy returned true')
                    return done(null, user.getFiltered())
                }
                return done(new Error("no user found"));
            });
        }
    ));
    // tell passport how to (de-)serialize the user
    passport.serializeUser((user, done) => {
        console.log('---- Inside serializeUser callback. User id is saved to the session here')
        done(null, user._id);
    });
    passport.deserializeUser((id, done) => {
        console.log('---- Inside deserializeUser callback')
        console.log(`The user id passport saved in the session file store is: ${id}`)
        User.findOne({ _id: id }, (err, user) => {
            if (user) {
                console.log('---- deserialize found valid user')
                return done(null, user.getFiltered())
            }
            return done(err);
        });
    });

    app.post('/login2', (req, res, next) => {
        console.log('-- login2', req.body);
        if (!req.body.username || req.body.username.length < 1 || !req.body.password || req.body.password.length < 1) {
            return res.status(400).send({ message: "username and password must not be empty to authenticate" });
        }
        passport.authenticate('local', (err, user, info) => {
            req.login(user, (err) => {
                if (!err) {
                    console.log('---- Inside req.login() callback')
                    console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`)
                    console.log(`req.user: ${JSON.stringify(req.user)}`)
                    return res.send({
                        message: `User [${user.username}] was successfully authenticated`,
                    });
                }
                return res.status(400).send({ message: "Username or password is invalid" });
            })
        })(req, res, next);
    })

    app.get('/registered', (req, res, next) => {
        // console.log(req.headers)
        if (!req.isAuthenticated()) {
            return res.status(401).send({ message: "authentication needed for this endpoint" });
        }
        User.find((err, users) => {
            if (err) {
                return next(err);
            }
            for (const user of users) {
                delete user._doc.hash;
                delete user._doc.salt;
                delete user._doc.__v;
            }
            return res.send(users)
        });
    });

    // catch all error handler 
    // do not write callstacks to response for security reasons
    app.use(function (err, req, res, next) {
        console.error(err.stack);
        res.status(500).send({ message: "Uups, something went wrong while processing your request" });
    })

    // start web server
    app.listen(port, () => {
        console.log('listening on port ' + port);
    });

});