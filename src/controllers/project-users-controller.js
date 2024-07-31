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
  if (user == null || user.project_id != projectId) {
    res.status(404).json({ message: 'User is not found' })
    return
  }
  const transaction = await sequelizeConn.transaction()
  try {
    const valuesUser = req.body.user
    const updatedJoinedGroupIds = req.body.groupsJoined.map((groupId) => {
      return parseInt(groupId)
    })

    const joinedGroups = await models.ProjectMembersXGroup.findAll({
      where: {
        membership_id: valuesUser.link_id,
      },
    })
    const joinedGroupIds = joinedGroups.map(
      (group) => group.group_id
    )
    const groupsToAdd = updatedJoinedGroupIds.filter(
      (updatedGroupId) => !joinedGroupIds.includes(updatedGroupId)
    )
    const groupsToDelete = joinedGroupIds.filter(
      (joinedGroupId) => !updatedJoinedGroupIds.includes(joinedGroupId)
    )
    // adding groups member is a part of by creating PMXG row for user
    if (groupsToAdd) {
      await models.ProjectMembersXGroup.bulkCreate(
        groupsToAdd.map((id) => ({
          group_id: id,
          membership_id: valuesUser.link_id,
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
          membership_id: linkId
        },
        transaction: transaction,
        individualHooks: true,
        user: req.user,
      })
    }

    // setting the changes for the member_type in pxu
    if(valuesUser.membership_type !== undefined) {
      user.membership_type = valuesUser.membership_type
    }
    // saving the changes made for user (membership_type)
    await user.save({
      transaction,
      user: req.user,
    })
    user.joined_groups = updatedJoinedGroupIds

    await transaction.commit()
    res.status(200).json({ user: convertUser(user, admin) })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to edit user due to server error' })
  }
}

//converts member data from db into its own object
function convertUser(row, admin) {
  if((typeof row.joined_groups) == 'string') {
    return {
      user_id: parseInt(row.user_id),
      link_id: parseInt(row.link_id),
      admin: row.user_id == admin,
      fname: row.fname,
      lname: row.lname,
      membership_type: parseInt(row.membership_type),
      email: row.email,
      joined_groups: (row.joined_groups.split(',')).map((groupId) => parseInt(groupId)),
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
    joined_groups: (row.joined_groups !== null) ? row.joined_groups: [],
  }
}
