import * as service from '../services/project-member-groups-service.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

export async function getProjectGroups(req, res) {
  const projectId = req.params.projectId
  try {
    const groups = await service.getGroupsInProject(projectId)
    res.status(200).json({
      groups: groups.map((row) => convertGroup(row)),
    })
  } catch (err) {
    console.error(`Error: Cannot fetch member groups for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching member groups.' })
  }
}

export async function deleteGroup(req, res) {
  const group_id = req.body.group_id
  const transaction = await sequelizeConn.transaction()
  await models.ProjectMemberGroup.destroy({
    where: {
      group_id: group_id,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ group_id: group_id })
}

function convertGroup(row) {
  return {
    group_id: parseInt(row.group_id),
    group_name: row.group_name,
    description: row.description,
  }
}
