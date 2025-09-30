import express from 'express'
import * as apiServiceController from '../controllers/api-service-controller.js'

const apiServiceRouter = express.Router()

// Main API service endpoint that matches the pattern service.php/[command]/[resource type]
// Example: /service/List/PublishedProjects
apiServiceRouter.get('/:command/:resourceType', apiServiceController.handleApiRequest)

export default apiServiceRouter

