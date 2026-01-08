import express from 'express'
import * as controller from '../controllers/curator-institution-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

const curatorInstitutionRouter = express.Router()

// Apply authentication and user authorization to all routes
curatorInstitutionRouter.use(authenticateToken)
curatorInstitutionRouter.use(authorizeUser)

// GET /curator/institutions - List all institutions
curatorInstitutionRouter.get('/', controller.listInstitutions)

// GET /curator/institutions/:id - Get specific institution with usage details
curatorInstitutionRouter.get('/:id', controller.getInstitution)

// GET /curator/institutions/:id/usage - Get institution usage count
curatorInstitutionRouter.get('/:id/usage', controller.getInstitutionUsage)

// PUT /curator/institutions/:id - Update institution
curatorInstitutionRouter.put('/:id', controller.updateInstitution)

// DELETE /curator/institutions/:id - Delete institution
curatorInstitutionRouter.delete('/:id', controller.deleteInstitution)

export { curatorInstitutionRouter }

