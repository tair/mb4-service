import * as service from '../services/members-service'

// this returns the members for specified project
export async function getMembers(req, res) {
    const projectId = req.params.projectId
    try {
        const members = await service.getMembersInProject(projectId)
        res.status(200).json({
          member: members.map((row) => convertMember(row)),
        })
      } catch (err) {
        console.error(`Error: Cannot fetch members for ${projectId}`, err)
        res.status(500).json({ message: 'Error while fetching members.' })
      }
}

//converts member data from db into its own object
function convertMember(row) {
    return {
      project_id: parseInt(row.project_id),
      user_id: parseInt(row.user_id),
      member_name: row.member_name,
      adminstrator: parseInt(row.adminstrator),
      //membership_status: parseInt(row.adminstrator), same as
      // member_role?
      member_email: row.member_email,
      member_role: parseInt(row.member_role),
    }
}