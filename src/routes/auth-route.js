import express from 'express'
import { body, validationResult } from 'express-validator'
import { models } from '../models/init-models.js'
import {
  login,
  logout,
  getORCIDAuthUrl,
  authenticateORCID,
  unlinkORCID,
  resetPassword,
  setNewPassword,
  validateResetKey,
} from '../controllers/auth-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'
import { signup } from '../controllers/user-controller.js'

const authRouter = express.Router()

// Validation middleware for signup
const validateSignup = [
  // Email validation
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email.')
    .custom(async (value) => {
      const existingUser = await models.User.findOne({
        where: { email: value },
      })
      if (existingUser) {
        throw new Error(
          'This email is already in our system. Please reset your password instead of creating a new account.'
        )
      }
      return true
    }),

  // Password validation
  body('password')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Password should be of length 5 characters.'),

  // First name validation
  body('fname').trim().not().isEmpty().withMessage('First name is required.'),

  // Last name validation
  body('lname').trim().not().isEmpty().withMessage('Last name is required.'),

  // ORCID validation
  body('orcid')
    .trim()
    .not()
    .isEmpty()
    .withMessage('ORCID is required for account creation.'),

  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      // Convert validation errors into a single message
      const errorMessages = errors
        .array()
        .map((error) => error.msg)
        .join('. ')
      return res.status(400).json({
        message: errorMessages,
      })
    }
    next()
  },
]

// Routes
authRouter.post('/signup', validateSignup, signup)

authRouter.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email.'),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
  ],
  login
)

authRouter.post('/logout', logout)

authRouter.get('/get-orcid-login-url', [], getORCIDAuthUrl)

authRouter.post(
  '/authenticate-orcid',
  maybeAuthenticateToken,
  authenticateORCID
)

authRouter.post('/unlink-orcid', authenticateToken, unlinkORCID)

authRouter.post('/reset-password', resetPassword)

authRouter.get('/validate-reset-key', validateResetKey)

authRouter.post('/set-new-password', setNewPassword)

export default authRouter
