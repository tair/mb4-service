const express = require('express')
const authController = require('../controllers/auth-controller.js')
const userController = require('../controllers/user-controller.js')
const { body } = require('express-validator')
const UserModel = require('../models/user.js')
const router = express.Router()

router.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        return UserModel.findOne({ where: { email: value } }).then(
          (userDoc) => {
            if (userDoc) {
              return Promise.reject('E-Mail address already exists!')
            }
          }
        )
      })
      .normalizeEmail(),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
    body('name').trim().not().isEmpty(),
  ],
  userController.signup
)

router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .normalizeEmail(),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
  ],
  authController.login
)

module.exports = router
