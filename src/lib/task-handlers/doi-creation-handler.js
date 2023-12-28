import sequelizeConn from '../../util/db.js'
import { DataCiteDOICreator } from '../data-cite-doi-creator.js'
import { Handler, HandlerErrors } from './handler.js'
import { QueryTypes } from 'sequelize'
import { models } from '../../models/init-models.js'

const BASE_URL = 'https://morphobank.org/index.php/projects'

/** A handler to creating DOIs for Projects and Matrices. */
export class DOICreationHandler extends Handler {
  constructor() {
    super()
    this.doiCreator = new DataCiteDOICreator()
  }

  async process(parameters) {
    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    const userId = parseInt(parameters.user_id)
    if (!userId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User ID is not defined'
      )
    }

    const project = await models.Project.findByPk(parameters.project_id)
    if (project == null) {
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
    const projectDoi = `P${projectId}`
    const projectTitle = `${project.name} (project)`
    const projectDoiExist = await this.doiCreator.exists(projectDoi)
    if (project.project_doi == null && !projectDoiExist) {
      const success = await this.doiCreator.create({
        id: projectDoi,
        user_id: userId,
        authors: authors,
        title: projectTitle,
        resource: `${BASE_URL}/ProjectOverview/project_id/${projectId}`,
      })
      if (!success) {
        return this.createError(
          HandlerErrors.HTTP_CLIENT_ERROR,
          `Error creating DOI: ${projectDoi}`
        )
      }
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

      const matrixDoi = `X${matrixId}`
      const doiExist = await this.doiCreator.exists(matrixDoi)
      if (!doiExist) {
        const matrixTitle = matrix.title ?? '(matrix)'
        const success = await this.doiCreator.create({
          id: matrixDoi,
          user_id: userId,
          authors: authors,
          title: `${projectTitle} [X${matrixId}] ${matrixTitle}`,
          resource: `${BASE_URL}/viewMatrix/matrix_id/${matrixId}/project_id/${projectId}`,
        })
        if (!success) {
          return this.createError(
            HandlerErrors.HTTP_CLIENT_ERROR,
            `Error creating DOI: ${matrixDoi}`
          )
        }
      }
      matrixDois.set(matrixId, matrixDoi)
    }

    const transaction = await sequelizeConn.transaction()
    if (project.project_doi == null) {
      await sequelizeConn.query(
        `
        UPDATE projects
        SET project_doi = ?
        WHERE project_id = ? AND project_doi IS NULL`,
        {
          replacements: [projectDoi, projectId],
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
    return {
      result: {
        created_dois: matrices.length + 1 /* projects */,
      },
    }
  }

  getName() {
    return 'DOICreation'
  }
}
