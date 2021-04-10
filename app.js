const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const MongodbStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const compression = require('compression');
const morgan = require('morgan');

dotenv.config();

const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGODB_URI = 'mongodb+srv://'+process.env.user+':'+process.env.password+'@cluster0-fzxis.mongodb.net/shop';

const app = express();
const store = new MongodbStore({
    uri: MONGODB_URI,
    collection: 'sessions'
});
const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data/images');
    },
    filename: (req, file, cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
});
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    }
    else {
        cb(null, false);
    }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flag: 'a' }
)

app.use(compression());
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'data/images')));
app.use(
    session({
        secret: 'mysecret',
        resave: false,
        saveUninitialized: false,
        store: store
    })
);
app.use(csrfProtection);
app.use(flash());

app.use((req,res,next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use((req,res,next) => {
    if(!req.session.user) {
        return next();
    }
    User.findById(req.session.user._id)
        .then(user => {
            if (!user) {
                return next();
            }
            req.user = user;
            next();
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use(errorController.get404);

app.use((error, req, res, next) => {
    console.log(error);
    res.status(500).render('500', { 
        pageTitle: 'Error!', 
        path: '/500',
        searchString: ''
    });
});

mongoose
    .connect(MONGODB_URI)
    .then(result => {
        console.log("Connected to the Database!")
        app.listen(process.env.PORT || 3000);
        console.log('Connected to port 3000!');
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });