import express from 'express';
import {body} from 'express-validator';
import {models} from "../models/init-models.js";
import {login} from '../controllers/auth-controller.js';
import {signup} from '../controllers/user-controller.js';

const authRouter = express.Router()

authRouter.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        return models.User.findOne({ where: { email: value } }).then(
          userDoc => {
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
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.'),
    body('password')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Password should be of length 5 characters.'),
  ],
  login
)

export default authRouter;