import * as service from '../services/project-user-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectUsers(req, res) {
  const projectId = req.project.project_id
  const users = await service.getUsersInProjects([projectId])
  res.status(200).json({ users })
}

export async function getMembers(req, res) {
  const projectId = req.params.projectId
  try {
      const members = await service.getMembersInProject(projectId)
      const admin = (await service.getAdmin(projectId))[0].user_id
      res.status(200).json({
        members: members.map((row) => convertMember(row, admin)),
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
  res.status(200)
}

//converts member data from db into its own object
function convertMember(row, admin) {
  return {
    user_id: parseInt(row.user_id),
    admin: row.user_id == admin,
    fname: row.fname,
    lname: row.lname,
    membership_type: parseInt(row.membership_type),
    email: row.email,
  }
}