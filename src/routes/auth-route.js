import express from 'express'
import { body } from 'express-validator'
import { models } from '../models/init-models.js'
import {
  login,
  logout,
  getORCIDAuthUrl,
  authenticateORCID,
  resetPassword,
  setNewPassword,
  validateResetKey,
} from '../controllers/auth-controller.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'
import { signup } from '../controllers/user-controller.js'

const authRouter = express.Router()

authRouter.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value) => {
        return models.User.findOne({ where: { email: value } }).then(
          (userDoc) => {
            if (userDoc) {
              return Promise.reject('E-Mail address already exists!')
            }
            return true
          }
        )
      }),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
    body('fname').trim().not().isEmpty().withMessage('First name is required.'),
    body('lname').trim().not().isEmpty().withMessage('Last name is required.'),
  ],
  signup
)

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

authRouter.post('/reset-password', resetPassword)

authRouter.get('/validate-reset-key', validateResetKey)

authRouter.post('/set-new-password', setNewPassword)

export default authRouter
