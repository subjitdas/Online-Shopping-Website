const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');
const dotenv = require('dotenv').config();

const User = require('../models/user');

const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: process.env.SENDGRID_API_KEY
    }
}));

exports.getLogin = (req,res,next) => {
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: req.flash('error'),
        oldInput: {oldEmail: "", oldPassword: ""},
        validationErrors: [],
        searchString: ''
    });
};

exports.getSignup = (req, res, next) => {
    res.render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: req.flash('error'),
      oldInput: {oldEmail: "", oldPassword: "", oldConfirmPassword: ""},
      validationErrors: [],
      searchString: ''
    });
};

exports.postLogin = (req,res,next) => {
    const email = req.body.email;
    const password = req.body.password;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: errors.array()[0].msg,
            oldInput: { oldEmail: email, oldPassword: password },
            validationErrors: errors.array(),
            searchString: ''
        });
    }
    User.findOne({email: email})
        .then(user => {
            bcrypt
                .compare(password, user.password)
                .then(doMatch => {
                    if(doMatch) {
                        req.session.user = user;
                        req.session.isLoggedIn = true;
                        return req.session.save(err => {     //save() is not necessary to use but is used to ensure that the response is sent only after the user is logged in
                            if(err) {
                                console.log(err);
                            }
                            return res.redirect('/');
                        });
                    }
                    return res.render('auth/login', {
                        path: '/login',
                        pageTitle: 'Login',
                        errorMessage: 'Invalid password',
                        oldInput: { oldEmail: email, oldPassword: password },
                        validationErrors: [{param: 'password'}],
                        searchString: ''
                    });
                })
                .catch(err => {
                    const error = new Error(err);
                    error.httpStatusCode = 500;
                    return next(error);
                  });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          });
};

exports.postSignup = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {oldEmail: email, oldPassword: password, oldConfirmPassword: confirmPassword},
            validationErrors: errors.array(),
            searchString: ''
        });
    }
    return bcrypt
        .hash(password, 12)
        .then(hashedPassword => {
            const user = new User({
                email: email,
                password: hashedPassword,
                cart: { items: [] }
            });
            return user.save();
        })
        .then(() => {
            res.redirect('/login');
            return transporter.sendMail({
                to: email,
                from: process.env.email,
                subject: 'Welcome!',
                html: '<h1>You have successfully signed up to the shopping site!</h1>'
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          });
};

exports.postLogout = (req,res,next) => {
    req.session.destroy(err => {
        if(err) {
            console.log(err);
        }   
        else {
            res.redirect('/');
        }
    }); 
};

exports.getPasswordReset = (req, res ,next) => {
    res.render('auth/password-reset', {
        path: '/password-reset',
        pageTitle: 'Password Reset',
        errorMessage: req.flash('error'),
        searchString: ''
    });
};

exports.postPasswordReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            return res.redirect('/reset');
        }
        const token = buffer.toString('hex');
        User.findOne({email: req.body.email})
            .then(user => {
                if(!user) {
                    req.flash('error', 'Email is not registered!')
                    return res.redirect('/password-reset');
                }
                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000;
                return user.save();
            })
            .then(() => {
                res.redirect('/');
                return transporter.sendMail({
                    to: req.body.email,
                    from: process.env.email,
                    subject: 'Password Reset',
                    // html: `
                    //     <p>You requested a password reset</p>
                    //     <p>Click this <a href="http://localhost:3000/new-password/${token}">link</a> to reset your password</p>
                    // `
                    html: `
                        <p>You requested a password reset</p>
                        <p>Click this <a href="https://subjitdas-online-shopping-site.herokuapp.com/new-password/${token}">link</a> to reset your password</p>
                    `
                })
            })
            .catch(err => {
                const error = new Error(err);
                error.httpStatusCode = 500;
                return next(error);
              });
    });
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;
    User.findOne({resetToken: token, resetTokenExpiration: {$gt: Date.now()}})
        .then(user => {
            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'Update Password',
                errorMessage: req.flash('error'),
                userId: user._id.toString(),
                passwordToken: token,
                searchString: ''
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          });
};

exports.postNewPassword = (req, res, next) => {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    User.findOne({_id: userId, resetToken: passwordToken, resetTokenExpiration: {$gt: Date.now()}})
        .then(user => {
            return bcrypt
                .hash(newPassword, 12)
                .then(hashedPassword => {
                    user.password = hashedPassword;
                    user.resetToken = undefined;
                    user.resetTokenExpiration = undefined;
                    return user.save();
                })
                .then(() => {
                    res.redirect('/login');
                    return transporter.sendMail({
                        to: user.email,
                        from: process.env.email,
                        subject: 'Password changed',
                        html: '<p>You\'ve successfully changed the password.</p>'
                    });
                })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          });
};