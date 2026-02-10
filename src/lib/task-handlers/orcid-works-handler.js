import sequelizeConn from '../../util/db.js'
import { Handler, HandlerErrors } from './handler.js'
import { QueryTypes } from 'sequelize'
import { models } from '../../models/init-models.js'
import { ORCIDWorksService } from '../orcid-works-service.js'
import { time } from '../../util/util.js'
import config from '../../config.js'

/**
 * Handler for pushing published project information to ORCID Works
 * for project members who have linked their ORCID accounts.
 * 
 * NOTE: This handler requires ORCID Member API credentials to function.
 * The Member API domain must be configured (api.orcid.org or api.sandbox.orcid.org)
 * and ORCID membership is required ($3,700/year via Lyrasis).
 */
export class ORCIDWorksHandler extends Handler {
  constructor() {
    super()
    this.orcidWorksService = new ORCIDWorksService()
  }

  /**
   * Check if ORCID Works feature is enabled (requires Member API credentials)
   */
  isWorksEnabled() {
    return config.orcid?.worksEnabled === true
  }

  async process(parameters) {
    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    // Check if ORCID Works feature is enabled
    const apiDomain = config.orcid?.apiDomain || 'NOT SET'
    const worksEnabled = config.orcid?.worksEnabled || false
    
    if (!this.isWorksEnabled()) {
      return {
        result: {
          message: 'ORCID Works feature not enabled - skipping works push',
          works_added: 0,
          skipped: true,
        },
      }
    }
    
    if (!apiDomain || apiDomain === 'NOT SET') {
      return {
        result: {
          message: 'ORCID API domain not configured - skipping works push',
          works_added: 0,
          skipped: true,
        },
      }
    }

    // Get the project - use raw query to ensure fresh data from database
    const [projectRows] = await sequelizeConn.query(
      'SELECT * FROM projects WHERE project_id = ?',
      { replacements: [projectId] }
    )
    
    if (!projectRows || projectRows.length === 0) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `Project ${projectId} does not exist`
      )
    }
    
    const project = projectRows[0]

    // NOTE: We don't check published status here because this task is only
    // queued after a successful publish in publishing-controller.js.
    // The task queue itself is the guarantee that the project was published.

    // Get article authors for filtering
    const articleAuthors = project.article_authors || ''

    // Query eligible project members:
    // - Have ORCID linked
    // - Have access token
    // - Are listed in article_authors (name appears in the authors string)
    // Note: We no longer exclude admins/curators - if their name is in article_authors,
    // they are legitimate authors and should get ORCID credit.
    const eligibleMembersQuery = `
      SELECT DISTINCT u.user_id, u.orcid, u.orcid_access_token, u.fname, u.lname
      FROM projects_x_users AS pxu
      INNER JOIN ca_users AS u ON u.user_id = pxu.user_id
      WHERE pxu.project_id = ?
        AND u.orcid IS NOT NULL
        AND u.orcid_access_token IS NOT NULL
        AND u.orcid != ''
        AND u.orcid_access_token != ''
        AND (LOCATE(u.fname, ?) > 0 OR LOCATE(u.lname, ?) > 0)
    `

    const [eligibleMembers] = await sequelizeConn.query(
      eligibleMembersQuery,
      {
        replacements: [projectId, articleAuthors, articleAuthors],
      }
    )

    if (!eligibleMembers || eligibleMembers.length === 0) {
      return {
        result: {
          message: 'No eligible members with ORCID found',
          works_added: 0,
        },
      }
    }

    // Process each eligible member
    const results = {
      works_added: 0,
      works_failed: 0,
      errors: [],
    }

    for (const member of eligibleMembers) {
      try {
        // Get full user object for potential token refresh
        const user = await models.User.findByPk(member.user_id, {
          attributes: [
            'user_id',
            'orcid',
            'orcid_access_token',
            'orcid_refresh_token',
          ],
        })

        if (!user) {
          results.works_failed++
          results.errors.push({
            user_id: member.user_id,
            orcid: member.orcid,
            error: 'User not found',
          })
          continue
        }

        // Check if work already exists (if tracking table exists)
        let existingWork = null
        try {
          if (models.ProjectsXOrcidWork) {
            existingWork = await models.ProjectsXOrcidWork.findOne({
              where: {
                project_id: projectId,
                user_id: member.user_id,
              },
            })
          }
        } catch (err) {
          // Table might not exist yet, continue without tracking
        }

        // Skip if work already exists
        if (existingWork && existingWork.status === 'success') {
          continue
        }

        // Add work to ORCID
        const addResult = await this.orcidWorksService.addWork(
          member.orcid,
          member.orcid_access_token,
          project,
          user
        )

        if (addResult.success) {
          results.works_added++

          // Record success in tracking table (if exists)
          try {
            if (models.ProjectsXOrcidWork) {
              if (existingWork) {
                // Update existing record
                existingWork.put_code = addResult.putCode
                existingWork.status = 'success'
                existingWork.updated_on = time()
                await existingWork.save({ shouldSkipLogChange: true })
              } else {
                // Create new record
                await models.ProjectsXOrcidWork.create({
                  project_id: projectId,
                  user_id: member.user_id,
                  orcid: member.orcid,
                  put_code: addResult.putCode,
                  status: 'success',
                  created_on: time(),
                }, { shouldSkipLogChange: true })
              }
            }
          } catch (err) {
            // Tracking table might not exist, log but don't fail
            console.error(
              'ORCIDWorksHandler: Could not record tracking info:',
              err.message
            )
          }

        } else {
          results.works_failed++
          results.errors.push({
            user_id: member.user_id,
            orcid: member.orcid,
            error: addResult.error || 'Unknown error',
          })

          // Record failure in tracking table (if exists)
          try {
            if (models.ProjectsXOrcidWork) {
              if (existingWork) {
                existingWork.status = 'failed'
                existingWork.error_message = addResult.error || 'Unknown error'
                existingWork.updated_on = time()
                await existingWork.save({ shouldSkipLogChange: true })
              } else {
                await models.ProjectsXOrcidWork.create({
                  project_id: projectId,
                  user_id: member.user_id,
                  orcid: member.orcid,
                  status: 'failed',
                  error_message: addResult.error || 'Unknown error',
                  created_on: time(),
                }, { shouldSkipLogChange: true })
              }
            }
          } catch (err) {
            // Tracking table might not exist, log but don't fail
            console.error(
              'ORCIDWorksHandler: Could not record failure tracking info:',
              err.message
            )
          }
        }
      } catch (error) {
        results.works_failed++
        results.errors.push({
          user_id: member.user_id,
          orcid: member.orcid,
          error: error.message || 'Unknown error',
        })

        console.error(
          `ORCIDWorksHandler: Error processing member ${member.user_id}:`,
          error
        )
      }
    }

    return {
      result: {
        project_id: projectId,
        works_added: results.works_added,
        works_failed: results.works_failed,
        total_eligible: eligibleMembers.length,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    }
  }

  getName() {
    return 'ORCIDWorks'
  }
}

