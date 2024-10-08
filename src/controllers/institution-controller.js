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
  const name = req.body.name?.trim()
  const institutionId = req.body.institutionId

  if (name == null || name.length == 0) {
    res.status(404).json({ message: 'Institution cannot be found' })
    return
  }

  let institution = institutionId
    ? await models.Institution.findByPk(institutionId)
    : await models.Institution.findOne({ where: { name: name } })

  try {
    const transaction = await sequelizeConn.transaction()

    if (institution == null) {
      institution = await models.Institution.create(
        {
          name: name,
          user_id: req.user.user_id,
        },
        {
          transaction: transaction,
          user: req.user,
        }
      )
    }

    await models.InstitutionsXProject.create(
      {
        project_id: projectId,
        institution_id: institution.institution_id,
      },
      {
        transaction: transaction,
        user: req.user,
      }
    )

    await transaction.commit()
    res.status(200).json({ institution })
  } catch (e) {
    console.error(e)
    res
      .status(500)
      .json({ message: 'Error adding the institution to the project.' })
  }
}

export async function editInstitution(req, res) {
  const projectId = req.params.projectId
  const institutionId = req.body.institutionId
  const name = req.body.name?.trim()
  const selectedInstitutionId = req.body.selectedInstitutionId

  if (name == null || name.length == 0) {
    return res.status(400)
  }

  const institution = await models.Institution.findByPk(institutionId)

  let newInstitution = selectedInstitutionId
    ? await models.Institution.findByPk(selectedInstitutionId)
    : await models.Institution.findOne({ where: { name: name } })

  // Determine whether the current institution is referenced any where else
  // outside of the current project.
  const dupeProjectInstitutionIds =
    await institutionService.getInstitutionIdsReferencedOutsideProject(
      [institutionId],
      projectId
    )

  const institutionInUse = dupeProjectInstitutionIds.length != 0

  const transaction = await sequelizeConn.transaction()

  try {
    if (!institutionInUse) {
      // If the previous institution is not is use outside of this project and
      // the new instituion does not already exist, let's update the current
      // institution and return it immediately.
      if (newInstitution == null) {
        institution.name = name
        await institution.save({
          user: req.user,
        })

        return res.status(200).json({ institution })
      }

      // If the institution is not in use and another one is more correct, let's
      // just delete it from the database so that it doesn't pollute searching
      // for other users.
      await models.Institution.destroy({
        where: {
          institution_id: institutionId,
        },
        transaction: transaction,
        individualHooks: true,
        user: req.user,
      })
    }

    if (newInstitution == null) {
      newInstitution = await models.Institution.create(
        {
          name: name,
          user_id: req.user.user_id,
        },
        {
          transaction: transaction,
          user: req.user,
        }
      )
    }

    await models.InstitutionsXProject.create(
      {
        project_id: projectId,
        institution_id: newInstitution.institution_id,
      },
      {
        transaction: transaction,
        user: req.user,
      }
    )

    await models.InstitutionsXProject.destroy({
      where: {
        project_id: projectId,
        institution_id: institutionId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    await transaction.commit()
    return res.status(200).json({ institution: newInstitution })
  } catch (e) {
    res.status(500)
    console.error('Could not change Institution', e)
  }
}

export async function removeInstitutionFromProject(req, res) {
  const projectId = req.params.projectId
  const institutionIds = req.body.institutionIds

  if (institutionIds == null || institutionIds.length == 0) {
    res.status(404).json({ message: 'Institutions not found' })
    return
  }

  try {
    const dupeProjectInstitutionIds =
      await institutionService.getInstitutionIdsReferencedOutsideProject(
        institutionIds,
        projectId
      )

    const uniqueInstitutionIds = institutionIds.filter((institutionId) => {
      return !dupeProjectInstitutionIds.includes(institutionId)
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

    // Extract ids because sequelize expects values not objects
    const dupes = projectInstitutions.map((i) => i.institution_id)

    // Get all institutions with like name segment and not within other model
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
