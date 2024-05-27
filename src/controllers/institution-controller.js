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

export async function addInstitutionToProject(req, res) {
  const projectId = req.params.projectId
  const name = req.body.name.trim()
  const institutionId = req.body.institutionId

  if (name == null || name.length == 0) {
    res.status(404).json({ message: 'Institution cannot be found' })
    return
  }

  let institution = await models.Institution.findByPk(institutionId)

  try {
    const transaction = await sequelizeConn.transaction()

    if (institution == null) {
      institution = models.Institution.build({
        name: name,
        user_id: req.user.user_id,
        active: true,
      })

      await institution.save({
        transaction: transaction,
        user: req.user,
      })
    }

    const institutionXProject = models.InstitutionsXProject.build({
      project_id: projectId,
      institution_id: institution.institution_id,
    })

    await institutionXProject.save({
      transaction: transaction,
      user: req.user,
    })

    await transaction.commit()
    res.status(200).json({ institution })
  } catch (e) {
    console.error(e)
    res
      .status(500)
      .json({ message: 'Error adding the institution to the project.' })
  }
}

export async function removeInstitutionFromProject(req, res) {
  const projectId = req.params.projectId
  const institutionIds = req.body.institutionIds

  if (institutionIds == null || !(institutionIds.length > 0)) {
    res.status(404).json({ message: 'Institutions not found' })
    return
  }

  try {
    const dupeInstitutionIds = await models.InstitutionsXProject.findAll({
      attributes: ['institution_id'],
      where: {
        institution_id: institutionIds,
        project_id: { [Sequelize.Op.not]: projectId },
      },
    })

    const dupeInstitutionIdsArray = dupeInstitutionIds.map(
      (i) => i.institution_id
    )
    const uniqueInstitutionIds = institutionIds.filter((institutionId) => {
      return !dupeInstitutionIdsArray.includes(institutionId)
    })

    const transaction = await sequelizeConn.transaction()

    await models.InstitutionsXProject.destroy({
      where: {
        project_id: projectId,
        institution_id: institutionIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    await models.Institution.destroy({
      where: {
        institution_id: uniqueInstitutionIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    await transaction.commit()

    res.status(200).json({ institutionIds })
  } catch (e) {
    res
      .status(500)
      .json({ message: 'Could not remove institution from the project.' })
    console.log('Could not remove institution from the project.', e)
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
    const dupes = projectInstitutions.map((i) => i.institution_id)

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
