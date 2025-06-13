import express from 'express'
import * as searchController from '../controllers/search-controller.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

const searchRouter = express.Router({ mergeParams: true })
searchRouter.use(maybeAuthenticateToken)
searchRouter.use(authorizeUser)

searchRouter.get('/', searchController.searchInstitutions)
searchRouter.get('/projects', searchController.searchProjects)
searchRouter.get('/media', searchController.searchMedia)
searchRouter.get('/media-views', searchController.searchMediaViews)
searchRouter.get('/specimens', searchController.searchSpecimens)
searchRouter.get('/characters', searchController.searchCharacters)
searchRouter.get('/references', searchController.searchReferences)
searchRouter.get('/matrices', searchController.searchMatrices)
searchRouter.get('/taxa', searchController.searchTaxa)

export default searchRouter
