import sequelizeConn from '../util/db.js'
import { SDDExporter } from '../lib/project-export/sdd-exporter.js'
import s3Service from './s3-service.js'
import config from '../config.js'

export async function getProjectsForUser(userId) {
  const [projects] = await sequelizeConn.query(
    `
    SELECT
      p.project_id, p.name, p.created_on, p.published, p.exemplar_media_id,
      p.article_authors, p.journal_year, p.article_title, p.journal_title,
      p.journal_volume, p.journal_number, p.article_pp,  p.journal_cover,
      p.journal_in_press, p.last_accessed_on, p.user_id AS admin_user_id,
      pu.last_accessed_on AS user_last_accessed_on
    FROM projects AS p
    INNER JOIN projects_x_users AS pu ON pu.project_id = p.project_id
    WHERE p.deleted = 0 AND pu.user_id = ?
    ORDER BY p.published, p.project_id`,
    { replacements: [userId] }
  )
  return projects
}

export async function getProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT project_id, name, description, user_id, published, created_on,
          journal_title, journal_url, journal_volume, journal_number,
          journal_cover, journal_year, article_authors, article_title,
          article_pp, group_id, published_on, exemplar_media_id,
          partition_published_on, article_doi, project_doi, nsf_funded,
          disk_usage, disk_usage_limit, publish_cc0, allow_reviewer_login, journal_in_press
      FROM projects
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows.length > 0 ? rows[0] : {}
}

export async function getJournalList() {
  const rows = await sequelizeConn.query(
    `
    SELECT DISTINCT journal_title
    FROM projects
    WHERE deleted < 1
    ORDER BY journal_title`,
    { type: sequelizeConn.QueryTypes.SELECT }
  )
  return rows
    .map((row) => row.journal_title?.trim())
    .filter((title) => title && title.length > 0)
}

export function getJournalCoverPath(journalTitle) {
  if (!journalTitle) return null

  // Clean the journal title similar to the PHP code
  let cleanTitle = journalTitle.trim()
  cleanTitle = cleanTitle.replace(/:/g, '')
  cleanTitle = cleanTitle.replace(/ /g, '_')
  cleanTitle = cleanTitle.replace(/\./g, '')
  cleanTitle = cleanTitle.replace(/&/g, 'and')
  cleanTitle = cleanTitle.toLowerCase()

  // Construct the path to the journal cover
  // TODO: this is a temporary solution, we need to move the journal covers to S3 and use the new URL
  const coverPath = `https://morphobank.org/themes/default/graphics/journalIcons/${cleanTitle}.jpg`

  return coverPath
}

/**
 * Validate if a user has access to download SDD for a project
 * @param {number} projectId - The project ID
 * @param {number|null} userId - The user ID (null for anonymous)
 * @param {number|null} partitionId - Optional partition ID
 * @returns {Promise<{hasAccess: boolean, project: object|null, partition: object|null}>}
 */
export async function validateProjectSDDAccess(
  projectId,
  userId = null,
  partitionId = null
) {
  const { models } = await import('../models/init-models.js')

  // Validate project exists
  const project = await models.Project.findByPk(projectId)
  if (!project) {
    return { hasAccess: false, project: null, partition: null }
  }

  // Check if project is published or user has access
  let hasAccess = project.published === 1

  if (!hasAccess && userId) {
    // Check if user is the project owner
    if (project.user_id === userId) {
      hasAccess = true
    } else {
      // Check if user is a member of the project
      const projectUser = await models.ProjectsXUser.findOne({
        where: {
          project_id: projectId,
          user_id: userId,
        },
      })
      hasAccess = !!projectUser
    }
  }

  if (!hasAccess) {
    return { hasAccess: false, project, partition: null }
  }

  // Validate partition if specified
  let partition = null
  if (partitionId) {
    partition = await models.Partition.findOne({
      where: {
        partition_id: partitionId,
        project_id: projectId,
      },
    })
    if (!partition) {
      return { hasAccess: false, project, partition: null }
    }
  }

  return { hasAccess: true, project, partition }
}

/**
 * Generate project SDD fallback download (ZIP with media) and upload to S3
 * This is used as a fallback when preprocessed S3 files are not available
 * @param {string} projectId - The project ID
 * @param {string|null} partitionId - Optional partition ID
 * @param {string} projectName - The project name (sanitized)
 * @param {Object} responseStream - Express response stream to pipe data to
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function generateProjectSDDFallback(
  projectId,
  partitionId,
  projectName,
  responseStream
) {
  try {
    // Create progress callback for logging
    const progressCallback = (progress) => {
      // console.log(
      //   `[Project ${projectId}] ${progress.stage}: ${progress.message} (${progress.overallProgress}%)`
      // )
    }

    // Create SDD exporter with progress tracking
    const exporter = new SDDExporter(projectId, partitionId, progressCallback)

    // For full project exports (no partition), capture the ZIP data to upload to S3
    if (!partitionId) {
      // Create a PassThrough stream to capture the data
      const { PassThrough } = await import('stream')
      const captureStream = new PassThrough()
      const chunks = []

      // Capture data as it flows through
      captureStream.on('data', (chunk) => {
        chunks.push(chunk)
      })

      // Handle completion
      captureStream.on('end', async () => {
        try {
          const zipBuffer = Buffer.concat(chunks)
          const s3Key = `sdd_exports/${projectId}_morphobank.zip`
          const bucketName = config.aws.defaultBucket || 'mb4-data'

          const uploadResult = await s3Service.putObject(
            bucketName,
            s3Key,
            zipBuffer,
            'application/zip'
          )

          console.log(`ZIP uploaded to S3 for project ${projectId}`)
        } catch (s3UploadError) {
          console.error(
            `Failed to upload ZIP to S3 for project ${projectId}:`,
            s3UploadError
          )
          // Don't fail the user download if S3 upload fails
        }
      })

      // Pipe to both the response and our capture stream
      captureStream.pipe(responseStream)

      // Stream ZIP to the capture stream (which pipes to response)
      await exporter.exportAsZip(captureStream)
    } else {
      // For partition exports, stream directly (no S3 upload)
      await exporter.exportAsZip(responseStream)
    }

    return { success: true }
  } catch (error) {
    console.error('Error generating SDD fallback export:', error)
    return { success: false, error: error.message }
  }
}
