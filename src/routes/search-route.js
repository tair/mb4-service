import express from 'express'
import * as searchController from '../controllers/search-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const searchRouter = express.Router()

searchRouter.get('/', searchController.searchInstitutions)
searchRouter.get('/projects', searchController.searchProjects)

export default searchRouter
