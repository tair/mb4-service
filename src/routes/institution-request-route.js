import express from 'express'
import * as controller from '../controllers/institution-request-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

const institutionRequestRouter = express.Router()

// Apply authentication and user authorization to all routes
institutionRequestRouter.use(authenticateToken)
institutionRequestRouter.use(authorizeUser)

// GET /curation-requests/institutions/stats - Get statistics for dashboard
institutionRequestRouter.get('/stats', controller.getInstitutionRequestStats)

// GET /curation-requests/institutions - List all requests with filtering
institutionRequestRouter.get('/', controller.listInstitutionRequests)

// GET /curation-requests/institutions/:requestId - Get specific request details
institutionRequestRouter.get('/:requestId', controller.getInstitutionRequest)

// PUT /curation-requests/institutions/:requestId - Update request (approve/reject)
institutionRequestRouter.put('/:requestId', controller.updateInstitutionRequest)

// DELETE /curation-requests/institutions/:requestId - Delete request
institutionRequestRouter.delete('/:requestId', controller.deleteInstitutionRequest)

export { institutionRequestRouter }

