import * as projectUserService from '../services/project-user-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectUsers(req, res) {
  const projectId = req.params.projectId
  const admin = req.project.user_id
  try {
    const users = await projectUserService.getUsersInProjects(projectId)
    res.status(200).json({
      users: users.map((row) => convertUser(row, admin)),
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
  const admin = req.project.user_id
  const user = await models.ProjectsXUser.findByPk(linkId)
  const userData = req.body.userData
  if (user == null || user.project_id != projectId) {
    res.status(404).json({ message: 'User is not found' })
    return
  }
  const transaction = await sequelizeConn.transaction()
  try {
    const updatedGroupIds = req.body.group_ids.map((group) => Number(group))
    const groups = await models.ProjectMembersXGroup.findAll({
      where: {
        membership_id: userData.link_id,
      },
    })
    const groupIds = groups.map((group) => group.group_id)
    const groupsToAdd = updatedGroupIds.filter(
      (updatedGroupId) => !groupIds.includes(updatedGroupId)
    )
    const groupsToDelete = groupIds.filter(
      (groupId) => !updatedGroupIds.includes(groupId)
    )
    // adding groups member is a part of by creating PMXG row for user
    if (groupsToAdd) {
      await models.ProjectMembersXGroup.bulkCreate(
        groupsToAdd.map((id) => ({
          group_id: id,
          membership_id: userData.link_id,
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
    const membershipType = req.body.membership_type
    if (membershipType !== undefined) {
      user.membership_type = membershipType
    }
    // saving the changes made for user (membership_type)
    await user.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()

    userData.membership_type = user.membership_type

    const newGroups = await models.ProjectMembersXGroup.findAll({
      where: {
        membership_id: userData.link_id,
      },
    })
    const newGroupIds = newGroups.map((group) => group.group_id)
    userData.group_ids = newGroupIds

    res.status(200).json({ user: convertUser(userData, admin) })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to edit user due to server error' })
  }
}

//converts member data from db into its own object
function convertUser(row, admin) {
  if (typeof row.group_ids == 'string') {
    return {
      user_id: parseInt(row.user_id),
      link_id: parseInt(row.link_id),
      admin: row.user_id == admin,
      fname: row.fname,
      lname: row.lname,
      membership_type: parseInt(row.membership_type),
      email: row.email,
      group_ids: row.group_ids.split(',').map((groupId) => parseInt(groupId)),
    }
  }
  return {
    user_id: parseInt(row.user_id),
    link_id: parseInt(row.link_id),
    admin: row.user_id == admin,
    fname: row.fname,
    lname: row.lname,
    membership_type: parseInt(row.membership_type),
    email: row.email,
    group_ids: row.group_ids !== null ? row.group_ids : [],
  }
}
