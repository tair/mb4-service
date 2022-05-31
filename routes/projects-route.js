const express = require('express')
const router = express.Router()

const projectsController = require('../controllers/projects-controller.js')
const mediaController = require('../controllers/media-controller.js')
const datadumbController = require('../controllers/datadump-controller.js')

const isAuth = require('../controllers/auth-controller.js').authenticateToken

router.get('/data_dump', datadumbController.dataDump)

router.get('/', projectsController.getProjects)
router.get('/:id', projectsController.getProjectsById)
router.get('/media_files/:id', mediaController.getMediaFiles)

module.exports = router
