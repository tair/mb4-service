import express from 'express'
import * as controller from '../controllers/project-member-groups-controller.js'

const projectMemberGroupsRouter = express.Router({ mergeParams: true })

projectMemberGroupsRouter.get('/', controller.getProjectGroups)
projectMemberGroupsRouter.post('/delete', controller.deleteGroup)
projectMemberGroupsRouter.post('/:groupId/edit', controller.editGroup)

export default projectMemberGroupsRouter
