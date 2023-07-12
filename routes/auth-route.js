import express from 'express'
import { body } from 'express-validator'
import { models } from '../models/init-models.js'
import {
  login,
  logout,
  getORCIDAuthUrl,
  authenticateORCID,
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
          }
        )
      }),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
    body('name').trim().not().isEmpty(),
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

export default authRouter
