import { models } from '../models/init-models.js'
import { Op } from 'sequelize'
import sequelizeConn from '../util/db.js'

export async function createRequest(req, res) {
  const projectId = req.params.projectId
  const remarks = req.body.remarks
  const transfer = req.body.transfer

  // if user chooses to transfer(boolean) onetime media
  const onetimeAction = transfer ? 100 : 1

  try {
    const request = models.ProjectDuplicationRequest.build({
      project_id: projectId,
      request_remarks: remarks,
      status: 1,
      user_id: req.user.user_id,
      onetime_use_action: onetimeAction,
      notes: remarks, // not entirely sure what values go into this and the next line
      new_project_number: (parseInt(projectId) + 1).toString(),
    })

    const transaction = await sequelizeConn.transaction()
    await request.save({
      transaction: transaction,
      user: req.user,
    })

    await transaction.commit()
    res
      .status(200)
      .json({ message: 'Sucessfully created a duplication request' })
  } catch (e) {
    console.error('Error making duplication request', e)
    res.status(500).json({ message: 'Could not create duplication request' })
  }
}

export async function getCondition(req, res) {
  const projectId = req.params.projectId

  const oneTimeMedia = await models.MediaFile.findAll({
    where: {
      project_id: projectId,
      is_copyrighted: { [Op.gt]: 0 },
      copyright_license: 8,
    },
  })

  const member = await models.ProjectsXUser.findOne({
    where: {
      project_id: projectId,
      user_id: req.user.user_id,
      membership_type: 0,
    },
  })

  const project = await models.Project.findByPk(projectId)
  const projectPublished = project.published == 1
  const hasAccess = member != null || req.user.user_id == project.user_id

  res.status(200).json({ oneTimeMedia, projectPublished, hasAccess })
}
