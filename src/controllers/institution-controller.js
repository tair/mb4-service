import * as institutionService from '../services/institution-service.js'
import { models } from '../models/init-models.js'
import { Sequelize } from 'sequelize'
import sequelizeConn from '../util/db.js'

export async function fetchProjectInstitutions(req, res) {
  try {
    const institutions = await institutionService.fetchInstitutions(
      req.params.projectId
    )
    res.status(200).json({ institutions })
  } catch (e) {
    console.error('Problem while getting project institutions (controller).', e)
    res
      .status(500)
      .json({ message: 'Error while getting project institutions.' })
  }
}

export async function assignInstitutionToProject(req, res) {
  const projectId = req.params.projectId
  const institutionId = req.body.institutionToAdd

  if (institutionId == null) {
    res.status(404).json({ message: 'Institution is not found' })
    return
  }

  try {
    const assignment = models.InstitutionsXProject.build({
      project_id: projectId,
      institution_id: institutionId,
    })

    const transaction = await sequelizeConn.transaction()
    await assignment.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()
    const institution = await models.Institution.findByPk(institutionId)
    console.log('first id: %d', institution.institution_id)
    res.status(200).json({ institution })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'could not assign the two' })
  }
}

export async function removeInstitutionFromProject(req, res) {
  const projectId = req.params.projectId
  const institutionIds = req.body.institutionIds

  if (institutionIds == null) {
    res.status(404).json({ message: 'Institutions not found' })
    return
  }

  const transaction = await sequelizeConn.transaction()
  try {
    await models.InstitutionsXProject.destroy({
      where: {
        project_id: projectId,
        institution_id: institutionIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    await transaction.commit()
    res.status(200).json({ institutionIds })
  } catch (e) {
    await transaction.rollback()
    res.status(404).json({ message: 'could not remove association' })
    console.log('error removing association', e)
  }
}

export async function searchInstitutions(req, res) {
  const searchTerm = req.query.searchTerm
  const projectId = req.params.projectId

  try {
    const projectInstitutions = await models.InstitutionsXProject.findAll({
      attributes: ['institution_id'],
      where: { project_id: projectId },
    })

    // extract ids because sequelize expects values not objects
    const dupes = projectInstitutions.map((instu) => instu.institution_id)

    // get all institutions with like name segment and not within other model
    const institutions = await models.Institution.findAll({
      attributes: ['institution_id', 'name'],
      where: {
        name: { [Sequelize.Op.like]: '%' + searchTerm + '%' },
        institution_id: { [Sequelize.Op.notIn]: dupes },
      },
    })

    return res.status(200).json(institutions)
  } catch (e) {
    res.status(500).json({ message: 'error obtaining list of insititutions' })
    console.log('error obtaining list of insititutions', e)
  }
}
