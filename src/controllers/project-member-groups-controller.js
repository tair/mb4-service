import * as service from '../services/project-member-groups-service.js'

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

function convertGroup(row) {
  return {
    group_id: parseInt(row.group_id),
    group_name: row.group_name,
    description: row.description,
  }
}
