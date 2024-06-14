import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as service from '../services/members-service.js'

// this returns the members for specified project
export async function getMembers(req, res) {
    const projectId = req.params.projectId
    try {
        const members = await service.getMembersInProject(projectId)
        res.status(200).json({
          members: members.map((row) => convertMember(row)),
        })
      } catch (err) {
        console.error(`Error: Cannot fetch members for ${projectId}`, err)
        res.status(500).json({ message: 'Error while fetching members.' })
      }
}

export async function deleteMember(req, res) {
  const link_ids = req.body.link_ids
  const transaction = await sequelizeConn.transaction()
  await models.ProjectDocument.destroy({
    where: {
      link_id: link_ids,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ link_ids: link_ids })
}

//converts member data from db into its own object
function convertMember(row) {
    return {
      user_id: parseInt(row.user_id),
      fname: row.fname,
      lname: row.lname,
      membership_type: parseInt(row.membership_type),
      email: row.email,
    }
}