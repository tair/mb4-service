import express from 'express'
import * as userController from '../controllers/user-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const userRouter = express.Router()

userRouter.get('/', authenticateToken, userController.getUsers)

export default userRouter
