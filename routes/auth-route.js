import express from 'express';
import {body} from 'express-validator';
import * as authController from '../controllers/auth-controller.js';
import * as userController from '../controllers/user-controller.js';
import UserModel from '../models/user.js'

const authRouter = express.Router()

authRouter.post(
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

authRouter.post(
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

export default authRouter;