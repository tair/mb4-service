import * as projectUserService from '../services/project-user-service.js'
import * as projectMemberGroupsService from '../services/project-member-groups-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectUsers(req, res) {
  const projectId = req.params.projectId
  const admin = req.project.user_id
  try {
    const users = await projectUserService.getUsersInProjects(projectId)
    // getting groups user is part of
    const userGroups = await projectMemberGroupsService.getUserGroups(projectId)
    const groupsMap = new Map()
    // making a map of userGroups {user_id: new Set([group_ids])}
    for (let row of userGroups) {
      const groupIds = row.group_ids
        .split(',')
        .map((groupId) => Number(groupId))
      groupsMap.set(row.user_id, new Set(groupIds))
    }
    // sending back a response but with data in desired structure
    res.status(200).json({
      users: users.map((row) =>
        convertUser(row, admin, groupsMap.get(row.user_id))
      ),
    })
  } catch (err) {
    console.error(`Error: Cannot fetch members for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching members.' })
  }
}

export async function deleteUser(req, res) {
  const link_id = req.body.link_id
  const transaction = await sequelizeConn.transaction()
  await models.ProjectsXUser.destroy({
    where: {
      link_id: link_id,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ link_id: link_id })
}

export async function editUser(req, res) {
  const projectId = req.project.project_id
  const linkId = req.params.linkId
  const user = await models.ProjectsXUser.findByPk(linkId)
  if (user == null || user.project_id != projectId) {
    res.status(404).json({ message: 'User is not found' })
    return
  }
  const transaction = await sequelizeConn.transaction()
  try {
    const updatedGroupIds = await Promise.all(
      req.body.group_ids.map(async (groupId) => {
        const groupInProject = await models.ProjectMemberGroup.findOne({
          attributes: ['project_id'],
          where: {
            group_id: Number(groupId),
          },
        })
        if (groupInProject == null || groupInProject.project_id != projectId) {
          res.status(404).json({ message: 'Group not in project' })
          return
        }
        return Number(groupId)
      })
    )
    const groups = await models.ProjectMembersXGroup.findAll({
      attributes: ['group_id'],
      where: {
        membership_id: linkId,
      },
    })
    const groupIds = groups.map((group) => group.group_id)
    const groupsToAdd = updatedGroupIds.filter(
      (updatedGroupId) => !groupIds.includes(updatedGroupId)
    )
    const groupsToDelete = groupIds.filter(
      (groupId) => !updatedGroupIds.includes(groupId)
    )
    // adding groups member is a part of by creating PMXG rows for user
    if (groupsToAdd) {
      await models.ProjectMembersXGroup.bulkCreate(
        groupsToAdd.map((id) => ({
          group_id: id,
          membership_id: linkId,
        })),
        {
          transaction: transaction,
          individualHooks: true,
          user: req.user,
        }
      )
    }
    // deleting the groups specified for a specific user
    if (groupsToDelete) {
      await models.ProjectMembersXGroup.destroy({
        where: {
          group_id: groupsToDelete,
          membership_id: linkId,
        },
        transaction: transaction,
        individualHooks: true,
        user: req.user,
      })
    }
    // setting the changes for the member_type in pxu
    user.membership_type = req.body.membership_type
    // saving the changes made for user (membership_type)
    await user.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    // sending updated fields back to update the user in the frontend
    res.status(200).json({
      group_ids: updatedGroupIds,
      membership_type: user.membership_type,
    })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to edit user due to server error' })
  }
}

//converts member data from db into its own object
function convertUser(row, admin, groupIds) {
  return {
    user_id: parseInt(row.user_id),
    link_id: parseInt(row.link_id),
    admin: row.user_id == admin,
    fname: row.fname,
    lname: row.lname,
    membership_type: parseInt(row.membership_type),
    email: row.email,
    group_ids: groupIds != undefined ? [...groupIds] : [],
  }
}
