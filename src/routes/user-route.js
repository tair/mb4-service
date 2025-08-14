import express from 'express'
import * as userController from '../controllers/user-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const userRouter = express.Router()

userRouter.get('/', authenticateToken, userController.getUsers)
userRouter.get('/get-profile', authenticateToken, userController.getProfile)
userRouter.put(
  '/update-profile',
  authenticateToken,
  userController.updateProfile
)
userRouter.get(
  '/search-institutions',
  authenticateToken,
  userController.searchInstitutions
)
userRouter.get(
  '/check-profile-confirmation',
  authenticateToken,
  userController.checkProfileConfirmation
)

export default userRouter
