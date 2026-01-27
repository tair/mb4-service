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
    console.log('[ORCIDWorksHandler] Starting process with parameters:', parameters)
    
    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      console.log('[ORCIDWorksHandler] Invalid project ID:', parameters.project_id)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    // Check if ORCID Works feature is enabled
    const memberApiDomain = config.orcid?.memberApiDomain || 'NOT SET'
    const worksEnabled = config.orcid?.worksEnabled || false
    console.log(`[ORCIDWorksHandler] Member API Domain: ${memberApiDomain}, Works Enabled: ${worksEnabled}`)
    
    if (!this.isWorksEnabled()) {
      console.log(
        '[ORCIDWorksHandler] ORCID Works feature not enabled. Skipping ORCID Works push.',
        'To enable, set ORCID_WORKS_ENABLED=true and ORCID_MEMBER_API_DOMAIN to api.orcid.org (production) or api.sandbox.orcid.org (sandbox).'
      )
      return {
        result: {
          message: 'ORCID Works feature not enabled - skipping works push',
          works_added: 0,
          skipped: true,
        },
      }
    }
    
    if (!memberApiDomain || memberApiDomain === 'NOT SET') {
      console.log('[ORCIDWorksHandler] ORCID_MEMBER_API_DOMAIN not configured. Skipping ORCID Works push.')
      return {
        result: {
          message: 'ORCID Member API domain not configured - skipping works push',
          works_added: 0,
          skipped: true,
        },
      }
    }
    
    console.log('[ORCIDWorksHandler] ORCID Works feature is enabled, proceeding...')

    // Get the project
    const project = await models.Project.findByPk(projectId)
    if (project == null) {
      console.log('ORCIDWorksHandler: Project not found:', projectId)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `Project ${projectId} does not exist`
      )
    }

    // Verify project is published
    if (project.published !== 1) {
      console.log(
        'ORCIDWorksHandler: Project is not published, skipping ORCID push:',
        projectId
      )
      return {
        result: {
          message: 'Project is not published',
          works_added: 0,
        },
      }
    }

    // Get article authors for filtering
    const articleAuthors = project.article_authors || ''
    console.log(`[ORCIDWorksHandler] Project ${projectId} article_authors: "${articleAuthors}"`)

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

    // Also run a debug query to see all project members with ORCID (without article_authors filter)
    const debugQuery = `
      SELECT u.user_id, u.orcid, u.fname, u.lname
      FROM projects_x_users AS pxu
      INNER JOIN ca_users AS u ON u.user_id = pxu.user_id
      WHERE pxu.project_id = ?
        AND u.orcid IS NOT NULL
        AND u.orcid != ''
    `
    
    const [allOrcidMembers] = await sequelizeConn.query(
      debugQuery,
      {
        replacements: [projectId],
      }
    )
    
    console.log(`[ORCIDWorksHandler] All project members with ORCID:`, allOrcidMembers)

    const [eligibleMembers] = await sequelizeConn.query(
      eligibleMembersQuery,
      {
        replacements: [projectId, articleAuthors, articleAuthors],
      }
    )

    console.log(`[ORCIDWorksHandler] Eligible members after filtering:`, eligibleMembers)

    if (!eligibleMembers || eligibleMembers.length === 0) {
      console.log(
        '[ORCIDWorksHandler] No eligible members found for project:',
        projectId,
        '- Check: Is your name in article_authors? Do you have a curator/admin role?'
      )
      return {
        result: {
          message: 'No eligible members with ORCID found',
          works_added: 0,
        },
      }
    }

    console.log(
      `ORCIDWorksHandler: Found ${eligibleMembers.length} eligible members for project ${projectId}`
    )

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
          console.warn(
            `ORCIDWorksHandler: User ${member.user_id} not found, skipping`
          )
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
          console.log(
            'ORCIDWorksHandler: Tracking table not available, continuing without duplicate check'
          )
        }

        // Skip if work already exists
        if (existingWork && existingWork.status === 'success') {
          console.log(
            `ORCIDWorksHandler: Work already exists for user ${member.user_id}, skipping`
          )
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
                await existingWork.save()
              } else {
                // Create new record
                await models.ProjectsXOrcidWork.create({
                  project_id: projectId,
                  user_id: member.user_id,
                  orcid: member.orcid,
                  put_code: addResult.putCode,
                  status: 'success',
                  created_on: time(),
                })
              }
            }
          } catch (err) {
            // Tracking table might not exist, log but don't fail
            console.log(
              'ORCIDWorksHandler: Could not record tracking info:',
              err.message
            )
          }

          console.log(
            `ORCIDWorksHandler: Successfully added work to ORCID ${member.orcid} for project ${projectId}`
          )
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
                await existingWork.save()
              } else {
                await models.ProjectsXOrcidWork.create({
                  project_id: projectId,
                  user_id: member.user_id,
                  orcid: member.orcid,
                  status: 'failed',
                  error_message: addResult.error || 'Unknown error',
                  created_on: time(),
                })
              }
            }
          } catch (err) {
            // Tracking table might not exist, log but don't fail
            console.log(
              'ORCIDWorksHandler: Could not record failure tracking info:',
              err.message
            )
          }

          console.error(
            `ORCIDWorksHandler: Failed to add work to ORCID ${member.orcid} for project ${projectId}:`,
            addResult.error
          )
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

