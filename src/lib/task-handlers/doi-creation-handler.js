import sequelizeConn from '../../util/db.js'
import { DataCiteDOICreator } from '../data-cite-doi-creator.js'
import { Handler, HandlerErrors } from './handler.js'
import { QueryTypes } from 'sequelize'
import { models } from '../../models/init-models.js'

const BASE_URL = `${process.env.FRONTEND_URL}/project`

/** A handler to creating DOIs for Projects and Matrices. */
export class DOICreationHandler extends Handler {
  constructor() {
    super()
    this.doiCreator = new DataCiteDOICreator()
  }

  async process(parameters) {
    console.log(
      'DOICreationHandler: Starting process with parameters:',
      parameters
    )

    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      console.log(
        'DOICreationHandler: Invalid project ID:',
        parameters.project_id
      )
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    const userId = parseInt(parameters.user_id)
    if (!userId) {
      console.log('DOICreationHandler: Invalid user ID:', parameters.user_id)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User ID is not defined'
      )
    }

    const project = await models.Project.findByPk(parameters.project_id)
    if (project == null) {
      console.log('DOICreationHandler: Project not found:', projectId)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ${projectId} does not exist'
      )
    }

    if (!parameters.authors) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Authors was not defined'
      )
    }

    const authors = parameters.authors.split(',')
    const projectDoiId = `P${projectId}`
    const projectTitle = `${project.name} (project)`

    const projectDoiExist = await this.doiCreator.exists(projectDoiId)
    let projectDoiToUpdate = null

    if (project.project_doi == null) {
      if (!projectDoiExist) {
        // DOI doesn't exist, create it
        const projectResource = `${BASE_URL}/${projectId}/overview`

        const result = await this.doiCreator.create({
          id: projectDoiId,
          user_id: userId,
          authors: authors,
          title: projectTitle,
          resource: projectResource,
        })
        if (!result.success) {
          console.log(
            'DOICreationHandler: Failed to create project DOI:',
            projectDoiId
          )
          return this.createError(
            HandlerErrors.HTTP_CLIENT_ERROR,
            `Error creating DOI: ${projectDoiId}`
          )
        } else {
          projectDoiToUpdate = result.doi
          console.log(
            'DOICreationHandler: Project DOI created:',
            projectDoiToUpdate
          )
        }
      } else {
        // DOI exists but database is null, construct full DOI for update
        projectDoiToUpdate = `${this.doiCreator.shoulder}/${projectDoiId}`
      }
    } else {
      console.log(
        'DOICreationHandler: Skipping project DOI - already set in database'
      )
    }

    const matrixDois = new Map()
    const matrices = await models.Matrix.findAll({
      where: {
        project_id: projectId,
        matrix_doi: null,
      },
    })

    for (const matrix of matrices) {
      const matrixId = parseInt(matrix.matrix_id)
      if (!matrixId) {
        return this.createError(
          HandlerErrors.ILLEGAL_PARAMETER,
          `Failed to parse Matrix ${matrixId}`
        )
      }

      const matrixDoiId = `X${matrixId}`
      const doiExist = await this.doiCreator.exists(matrixDoiId)
      if (!doiExist) {
        // DOI doesn't exist, create it
        const matrixTitle = matrix.title ?? '(matrix)'
        const result = await this.doiCreator.create({
          id: matrixDoiId,
          user_id: userId,
          authors: authors,
          title: `${projectTitle} [X${matrixId}] ${matrixTitle}`,
          resource: `${BASE_URL}/${projectId}/matrices/${matrixId}/view`,
        })
        if (!result.success) {
          return this.createError(
            HandlerErrors.HTTP_CLIENT_ERROR,
            `Error creating DOI: ${matrixDoiId}`
          )
        } else {
          console.log('DOICreationHandler: Matrix DOI created:', result.doi)
          matrixDois.set(matrixId, result.doi)
        }
      } else {
        // DOI exists but database is null, construct full DOI for update
        const fullDoi = `${this.doiCreator.shoulder}/${matrixDoiId}`
        matrixDois.set(matrixId, fullDoi)
      }
    }

    const transaction = await sequelizeConn.transaction()
    if (project.project_doi == null && projectDoiToUpdate) {
      await sequelizeConn.query(
        `
        UPDATE projects
        SET project_doi = ?
        WHERE project_id = ? AND project_doi IS NULL`,
        {
          replacements: [projectDoiToUpdate, projectId],
          type: QueryTypes.UPDATE,
          transaction: transaction,
        }
      )
    }
    for (const [matrixId, matrixDoi] of matrixDois.entries()) {
      await sequelizeConn.query(
        `
        UPDATE matrices
        SET matrix_doi = ?
        WHERE matrix_id = ? AND matrix_doi IS NULL`,
        {
          replacements: [matrixDoi, matrixId],
          type: QueryTypes.UPDATE,
          transaction: transaction,
        }
      )
    }
    await transaction.commit()

    // Count actual DOIs created (not just attempted)
    let createdCount = 0
    if (projectDoiToUpdate) createdCount++
    createdCount += matrixDois.size

    return {
      result: {
        created_dois: createdCount,
        project_doi: projectDoiToUpdate,
        matrix_dois: Array.from(matrixDois.values()),
      },
    }
  }

  getName() {
    return 'DOICreation'
  }
}
