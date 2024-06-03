import * as memberService from '../services/members-service'

export async function getProjects(req, res) {
    const projectId = req.user?.projectId_id
    console.log(userId)
    console.log(projectId)
    if (userId == null) {
      res.status(200).json({ projects: [] })
      return
    }

    const members = await memberService.getMembersInProject(projectId)
}