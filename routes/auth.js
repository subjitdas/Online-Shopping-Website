const express = require("express");
const { check, body } = require("express-validator/check");

const authController = require("../controllers/auth");
const isNotAuth = require("../middleware/is-not-auth");
const User = require("../models/user");

const router = express.Router();

router.get("/login", isNotAuth, authController.getLogin);

router.get("/signup", isNotAuth, authController.getSignup);

router.post(
  "/login",
  isNotAuth,
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email!")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((user) => {
          if (!user) {
            return Promise.reject("Email is not registered!");
          }
        });
      })
      .normalizeEmail(),
    body("password", "Invalid password")
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  isNotAuth,
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom((value, { req }) => {
        if (value === "banned_user@gmail.com") {
          throw new Error("This email is forbidden");
        }
        return true;
      })
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email is already registered!");
          }
        });
      })
      .normalizeEmail(),
    body(
      "password",
      "Password should be of atleast length 5 and should only contain numbers and text"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

router.get("/password-reset", isNotAuth, authController.getPasswordReset);

router.post("/password-reset", isNotAuth, authController.postPasswordReset);

router.get("/new-password/:token", isNotAuth, authController.getNewPassword);

router.post("/new-password", isNotAuth, authController.postNewPassword);

module.exports = router;
