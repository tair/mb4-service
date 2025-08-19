import express from 'express'
import * as controller from '../controllers/duplication-request-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

const duplicationRequestRouter = express.Router()

// Apply authentication and user authorization to all routes
duplicationRequestRouter.use(authenticateToken)
duplicationRequestRouter.use(authorizeUser)

// GET /duplication-requests/stats - Get statistics for dashboard
duplicationRequestRouter.get('/stats', controller.getDuplicationRequestStats)

// GET /duplication-requests - List all requests with filtering
duplicationRequestRouter.get('/', controller.listDuplicationRequests)

// GET /duplication-requests/:requestId - Get specific request details
duplicationRequestRouter.get('/:requestId', controller.getDuplicationRequest)

// PUT /duplication-requests/:requestId - Update request (approve/deny)
duplicationRequestRouter.put('/:requestId', controller.updateDuplicationRequest)

// DELETE /duplication-requests/:requestId - Delete request
duplicationRequestRouter.delete('/:requestId', controller.deleteDuplicationRequest)

export { duplicationRequestRouter }
