import * as projectUserService from '../services/project-user-service.js'
import * as projectMemberGroupsService from '../services/project-member-groups-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectUsers(req, res) {
  const projectId = req.params.projectId
  const admin = req.project.user_id
  try {
    const users = await projectUserService.getUsersInProjects(projectId)
    const convertedUsers = await Promise.all(users.map((row) => {
      return convertUser(row, admin)
    }))
    res.status(200).json({
      users: convertedUsers,
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

  const values = req.body.user
  await editGroupsMembership(values.groups_membership, req)

  delete values.groups_membership

  for (const column in values) {
    user.set(column, values[column])
  }
  const transaction = await sequelizeConn.transaction()
  try {
    await user.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()
    const convertedUser = await convertUser(user, admin)
    res.status(200).json({ user: convertedUser })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to edit user due to server error' })
  }
}

async function editGroupsMembership(groupsMembership, req) {
  for( let group of groupsMembership) {
    if(group.joined == 0) {
      await deleteGroupsMembership(group.link_id, req)
    } else {
      await addGroupsMembership(group.group_id, req)
    }
  }
}

async function addGroupsMembership(groupId, req) {
  const linkId = req.params.linkId
  const transaction = await sequelizeConn.transaction()
  const [projectMembersXGroup, created] = await models.ProjectMembersXGroup.findOrCreate({
    where: { 
      membership_id: linkId,
      group_id: groupId,
     },
     transaction: transaction,
     user: req.user,
  })
  if(created) {
    await projectMembersXGroup.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  }
}

async function deleteGroupsMembership(link_id, req) {
  const transaction = await sequelizeConn.transaction()
  await models.ProjectMembersXGroup.destroy({
    where: {
      link_id: link_id,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
}

async function getGroupsMembership(projectId, membershipId) {
  const groups = await projectMemberGroupsService.getGroupsInProject(projectId)
  const groups_joined = await projectMemberGroupsService.getGroupsForMember(membershipId)
  return convertGroupsJoined(groups, groups_joined)
}

function convertGroupsJoined(groups, groups_joined) {
  const groups_membership = []
  while(groups.length>0) {
    let pushed = false
    let i = 0
    while(groups_joined.length>i) {
      if(groups_joined[i].group_id == groups[0].group_id){
        groups_membership.push(groupsJoinedHelper(groups[0], groups_joined[i]))
        pushed = true
        break
      }
      i++
    }
    if(!pushed) {
      groups_membership.push(groupsJoinedHelper(groups[0], null))
    } else {
      groups_joined.splice(i,1)
    }
    groups.shift()
  }

  return groups_membership
}

function groupsJoinedHelper(group, group_joined) {
  if(group_joined) {
    return {
      joined: (group.group_id == group_joined.group_id) ? 1 : 0,
      group_name: group.group_name,
      group_id: parseInt(group.group_id),
      link_id: group_joined.link_id
    }
  } else {
    return {
      joined: 0,
      group_name: group.group_name,
      group_id: parseInt(group.group_id),
      link_id: 0,
    }
  }
}

//converts member data from db into its own object
async function convertUser(row, admin) {
  return {
    user_id: parseInt(row.user_id),
    link_id: parseInt(row.link_id),
    admin: row.user_id == admin,
    fname: row.fname,
    lname: row.lname,
    membership_type: parseInt(row.membership_type),
    email: row.email,
    groups_membership: await getGroupsMembership(row.project_id, row.link_id),
  }
}
