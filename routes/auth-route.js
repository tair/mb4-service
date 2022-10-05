import express from 'express';
import {body} from 'express-validator';
import * as authController from '../controllers/auth-controller.js';
import * as userController from '../controllers/user-controller.js';
import {initModels} from "../models/init-models.js";
import sequelizeConn from '../util/db.js';

const models = initModels(sequelizeConn);

const authRouter = express.Router()

authRouter.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        return models.User.findOne({ where: { email: value } }).then(
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