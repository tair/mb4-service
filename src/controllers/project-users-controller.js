import * as projectUserService from '../services/project-user-service.js'
import * as projectMemberGroupsService from '../services/project-member-groups-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectUsers(req, res) {
  const projectId = req.params.projectId
  const admin = req.project.user_id
  try {
    const [users, userGroups] = await Promise.all([
      projectUserService.getUsersInProjects(projectId),
      projectMemberGroupsService.getUserGroups(projectId),
    ])
    // sending back a response but with data in desired structure
    res.status(200).json({
      users: users.map((row) =>
        convertUser(row, admin, userGroups.get(row.user_id))
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
    const updatedGroupIds = req.body.group_ids.map((groupId) => Number(groupId))
    const groupsInProject = await projectMemberGroupsService.isGroupInProject(
      updatedGroupIds,
      projectId
    )
    if (!groupsInProject) {
      res.status(404).json({ message: 'Group not in project' })
      return
    }
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

export async function createUser(req, res) {
  const projectId = req.project.project_id
  const values = req.body.json
  const existingUser = req.body.existing_user
  const transaction = await sequelizeConn.transaction()
  try {
    if (existingUser) {
      const user = await models.User.findByPk(values.user_id, {
        attributes: ['fname', 'lname', 'email', 'user_id'],
      })
      const project_x_user = await models.ProjectsXUser.create(
        {
          project_id: projectId,
          user_id: user.user_id,
          membership_type: values.membership_type,
        },
        {
          transaction,
          user: req.user,
        }
      )
      await models.TaskQueue.create(
        {
          user_id: req.user.user_id,
          priority: 500,
          entity_key: null,
          row_key: null,
          handler: 'Email',
          parameters: {
            template: 'project_member_invitation',
            subject: `Invitation to Morphobank project ${projectId}`,
            name: `${user.fname} ${user.lname}`,
            projectId: projectId,
            projectName: req.project.name,
            inviteeName: `${req.user.fname} ${req.user.lname}`,
            inviteeEmail: req.user.email,
            messageStart: values.message
              ? `${user.fname} ${user.lname} wrote:`
              : null,
            message: values.message,
            to: user.email,
          },
        },
        {
          transaction: transaction,
          user: req.user,
        }
      )
      await transaction.commit()

      res.status(200).json({
        user: convertUser(
          {
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            user_id: user.user_id,
            membership_type: project_x_user.membership_type,
            link_id: project_x_user.link_id,
          },
          req.project.user_id
        ),
      })
    } else {
      const password = generateRandomString()
      const hashedPassword = await models.User.hashPassword(password)
      const user = await models.User.create(
        {
          email: values.email,
          fname: values.fname,
          lname: values.lname,
          password_hash: hashedPassword,
          active: 0,
        },
        {
          transaction,
          user: req.user,
        }
      )

      const project_x_user = await models.ProjectsXUser.create(
        {
          project_id: projectId,
          user_id: user.user_id,
          membership_type: values.membership_type,
        },
        {
          transaction,
          user: req.user,
        }
      )
      await models.TaskQueue.create(
        {
          user_id: req.user.user_id,
          priority: 500,
          entity_key: null,
          row_key: null,
          handler: 'Email',
          parameters: {
            template: 'project_member_invitation',
            subject: `Invitation to Morphobank project ${projectId}`,
            name: `${user.fname} ${user.lname}`,
            projectId: projectId,
            projectName: req.project.name,
            inviteeName: `${req.user.fname} ${req.user.lname}`,
            inviteeEmail: req.user.email,
            messageStart: values.message
              ? `${user.fname} ${user.lname} wrote:`
              : null,
            message: values.message,
            passwordText: `Your password is ${password}`,
            to: user.email,
          },
        },
        {
          transaction: transaction,
          user: req.user,
        }
      )
      await transaction.commit()

      res.status(200).json({
        user: convertUser(
          {
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            user_id: user.user_id,
            membership_type: project_x_user.membership_type,
            link_id: project_x_user.link_id,
          },
          req.project.user_id
        ),
      })
    }
  } catch (err) {
    await transaction.rollback()
    console.error(`Error: Error while having user join group`, err)
    res.status(500).json({ message: 'Error while having user join group.' })
  }
}
// generates random string (intended for use in creating temp password)
function generateRandomString() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const charactersLength = characters.length

  for (let i = 0; i < 10; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}
// check to see if the user is active and if not deleted
export async function isEmailAvailable(req, res) {
  const email = req.body.email
  try {
    const user = await models.User.findOne({
      attributes: ['fname', 'lname', 'email', 'user_id', 'active', 'userclass'],
      where: { email: email },
    })
    res.status(200).json({
      existing_user: user ? true : false,
      user: user ? user : { email: email },
      errorMessage:
        user == null
          ? false
          : user.active == 0
          ? "Was not able to add user as a member because they're inactive"
          : user.userclass == 255
          ? 'Was not able to add user as a member because they have been deleted'
          : false,
    })
  } catch (err) {
    console.error(`Error: Error while fetching user for ${email}`, err)
    res.status(500).json({ message: 'Error while fetching user.' })
  }
}

//converts member data from db into its own object
function convertUser(row, admin, groupIds = []) {
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
