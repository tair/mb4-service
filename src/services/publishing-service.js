import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import { time } from '../util/util.js'
import { QueryTypes } from 'sequelize'

/**
 * Validates if project citation information is complete based on publication status
 * @param {Object} project - Project object
 * @returns {Object} { isValid: boolean, message: string }
 */
export async function validateCitationInfo(project) {
  const journalInPress = project.journal_in_press

  // Check if no article info has been entered
  if (journalInPress === 2) {
    return {
      isValid: false,
      message: 'You have not entered article information for your project.',
    }
  }

  // For published (0) or in press (1) articles
  if (journalInPress === 0 || journalInPress === 1) {
    const requiredFields = [
      'journal_title',
      'article_authors',
      'article_title',
      'journal_year',
    ]

    for (const field of requiredFields) {
      // console.log(field, project[field])
      if (!project[field] || project[field].trim() === '') {
        const status = journalInPress === 0 ? 'published' : 'in-press'
        return {
          isValid: false,
          message: `You have indicated there is a ${status} article associated with this project but have not entered all the citation information.`,
        }
      }
    }

    // Additional fields required only for published articles
    if (journalInPress === 0) {
      const publishedRequiredFields = [
        'journal_url',
        'journal_volume',
        'article_pp',
      ]

      for (const field of publishedRequiredFields) {
        // console.log(field, project[field])
        if (!project[field] || project[field].trim() === '') {
          return {
            isValid: false,
            message:
              'You have indicated there is a published article associated with this project but have not entered all the citation information.',
          }
        }
      }
    }
  }
  return { isValid: true }
}

/**
 * Gets media files with incomplete copyright information that would prevent publishing
 * @param {number} projectId - Project ID
 * @param {boolean} publishMatrixMediaOnly - Whether to only check matrix media
 * @returns {Array} Array of media objects with incomplete copyright info
 */
export async function getUnfinishedMedia(
  projectId,
  publishMatrixMediaOnly = false
) {
  let matrixMediaWhere = ''

  if (publishMatrixMediaOnly) {
    // First get list of media used in matrices
    const matrixMediaQuery = `
      SELECT media_id FROM media_files 
      WHERE project_id = ? AND in_use_in_matrix = 1
    `
    const [matrixMedia] = await sequelizeConn.query(matrixMediaQuery, {
      replacements: [projectId],
      type: QueryTypes.SELECT,
    })

    if (matrixMedia.length > 0) {
      const mediaIds = matrixMedia.map((row) => row.media_id)
      matrixMediaWhere = ` AND media_id IN (${mediaIds.join(', ')})`
    } else {
      // No matrix media found, return empty array
      return []
    }
  }

  const query = `
    SELECT media_id, copyright_permission, copyright_license, specimen_id, view_id, is_copyrighted
    FROM media_files 
    WHERE project_id = ? 
      AND published = 0 
      ${matrixMediaWhere}
      AND (
        (specimen_id IS NULL) OR 
        (view_id IS NULL) OR 
        (
          (is_copyrighted IS NULL) OR 
          (is_copyrighted = 1 AND (
            (copyright_permission IN (0,3,5)) OR 
            (copyright_permission != 4 AND copyright_license = 0) OR 
            (copyright_license = 20)
          ))
        )
      )
  `

  const results = await sequelizeConn.query(query, {
    replacements: [projectId],
    type: QueryTypes.SELECT,
  })

  return results
}

/**
 * Checks if project has any media files to publish
 * @param {number} projectId - Project ID
 * @returns {boolean} True if project has media files
 */
export async function hasMediaFiles(projectId) {
  const query = `
    SELECT COUNT(*) as count 
    FROM media_files 
    WHERE published = 0 AND project_id = ?
  `

  const [results] = await sequelizeConn.query(query, {
    replacements: [projectId],
    type: QueryTypes.SELECT,
  })

  return results.count > 0
}

/**
 * Updates the in_use_in_matrix flags for media files used in matrices
 * @param {number} projectId - Project ID
 * @param {number} exemplarMediaId - Exemplar media ID (always mark as in use)
 * @param {Object} transaction - Database transaction
 */
export async function updateMatrixMediaFlags(
  projectId,
  exemplarMediaId,
  transaction
) {
  // First reset all in_use_in_matrix flags to 0
  await sequelizeConn.query(
    'UPDATE media_files SET in_use_in_matrix = 0 WHERE project_id = ?',
    {
      replacements: [projectId],
      transaction,
      type: QueryTypes.UPDATE,
    }
  )

  const matrixMediaIds = new Set()

  // Add exemplar media if it exists
  if (exemplarMediaId) {
    matrixMediaIds.add(exemplarMediaId)
  }

  // Get media used in cells
  const cellMediaQuery = `
    SELECT cm.media_id 
    FROM cells_x_media cm 
    INNER JOIN media_files AS mf ON mf.media_id = cm.media_id 
    INNER JOIN matrices as m on cm.matrix_id = m.matrix_id 
    WHERE m.published = 0 AND m.project_id = ? AND mf.project_id = ?
  `
  const [cellMedia] = await sequelizeConn.query(cellMediaQuery, {
    replacements: [projectId, projectId],
    transaction,
    type: QueryTypes.SELECT,
  })

  cellMedia.forEach((row) => matrixMediaIds.add(row.media_id))

  // Get media linked to characters in matrix
  const characterMediaQuery = `
    SELECT cm.media_id 
    FROM characters_x_media cm 
    INNER JOIN media_files AS mf ON mf.media_id = cm.media_id 
    INNER JOIN cells AS c ON c.character_id = cm.character_id 
    INNER JOIN matrices as m on c.matrix_id = m.matrix_id 
    WHERE m.published = 0 AND m.project_id = ? AND mf.project_id = ?
  `
  const [characterMedia] = await sequelizeConn.query(characterMediaQuery, {
    replacements: [projectId, projectId],
    transaction,
    type: QueryTypes.SELECT,
  })

  characterMedia.forEach((row) => matrixMediaIds.add(row.media_id))

  // Get media linked to taxa in matrix
  const taxaMediaQuery = `
    SELECT tm.media_id 
    FROM taxa_x_media tm 
    INNER JOIN media_files AS mf ON mf.media_id = tm.media_id 
    INNER JOIN cells AS c ON c.taxon_id = tm.taxon_id 
    INNER JOIN matrices as m on c.matrix_id = m.matrix_id 
    WHERE m.published = 0 AND m.project_id = ? AND mf.project_id = ?
  `
  const [taxaMedia] = await sequelizeConn.query(taxaMediaQuery, {
    replacements: [projectId, projectId],
    transaction,
    type: QueryTypes.SELECT,
  })

  taxaMedia.forEach((row) => matrixMediaIds.add(row.media_id))

  // Update in_use_in_matrix flag for all matrix media
  if (matrixMediaIds.size > 0) {
    const mediaIdsArray = Array.from(matrixMediaIds)
    await sequelizeConn.query(
      `UPDATE media_files SET in_use_in_matrix = 1 WHERE media_id IN (${mediaIdsArray.join(
        ', '
      )})`,
      {
        transaction,
        type: QueryTypes.UPDATE,
      }
    )
  }
}

/**
 * Creates or updates a bibliographic reference from project citation info
 * @param {Object} project - Project object
 * @param {number} userId - User ID creating the reference
 * @param {Object} transaction - Database transaction
 * @param {Object} user - User object for changelog logging
 */
export async function createBibliographicReference(
  project,
  userId,
  transaction,
  user
) {
  if (!project.journal_title && !project.article_title) {
    return
  }

  // Try to load existing record
  let bibRef = await models.BibliographicReference.findOne({
    where: {
      project_id: project.project_id,
      project_citation: 1,
    },
    transaction,
  })

  const bibData = {
    project_id: project.project_id,
    project_citation: 1,
    user_id: userId,
    article_title: project.article_title || '',
    journal_title: project.journal_title || '',
    monograph_title: '', // Required field - empty for journal articles
    authors: project.article_authors || '', // TODO: Extract authors properly
    vol: project.journal_volume || '',
    num: project.journal_number || '',
    pubyear: project.journal_year || '',
    publisher: '', // Required field - empty for journal articles
    abstract: project.description || '',
    description: '', // Required field - separate from abstract
    collation: project.article_pp || '',
    external_identifier: '', // Required field - could be DOI
    article_secondary_title: '', // Required field - empty for most articles
    urls: project.journal_url || '',
    worktype: '', // Required field - empty for journal articles
    edition: '', // Required field - empty for journal articles
    sect: '', // Required field - empty for journal articles
    isbn: '', // Required field - empty for journal articles
    keywords: '', // Required field - empty for now
    lang: '', // Required field - empty for now
    electronic_resource_num: project.article_doi || '',
    author_address: '', // Required field - empty for now
    place_of_publication: '', // Required field - empty for journal articles
    reference_type: 1, // Journal Article
  }
  if (bibRef) {
    // Update existing reference
    await bibRef.update(bibData, { transaction, user })
  } else {
    // Create new reference
    bibData.created_on = time()
    await models.BibliographicReference.create(bibData, { transaction, user })
  }
}

/**
 * Links project member institutions to the project for published projects
 * @param {number} projectId - Project ID
 * @param {Object} project - Project object with article_authors
 * @param {Object} transaction - Database transaction
 */
export async function linkMemberInstitutions(projectId, project, transaction) {
  const insertQuery = `
    INSERT IGNORE institutions_x_projects(project_id, institution_id, created_on)
    SELECT DISTINCT p.project_id, ixu.institution_id, UNIX_TIMESTAMP(NOW())
    FROM projects AS p
    INNER JOIN projects_x_users AS pxu ON pxu.project_id = p.project_id
    INNER JOIN ca_users AS u ON u.user_id = pxu.user_id
    INNER JOIN institutions_x_users AS ixu ON ixu.user_id = pxu.user_id
    LEFT JOIN ca_users_x_roles AS uxr ON uxr.user_id = ixu.user_id
    LEFT JOIN institutions_x_projects ixp ON ixp.project_id = p.project_id AND ixp.institution_id = ixu.institution_id
    WHERE p.project_id = ? 
      AND (LOCATE(u.fname, p.article_authors) > 0 OR LOCATE(u.lname, p.article_authors) > 0) 
      AND uxr.relation_id IS NULL 
      AND ixp.link_id IS NULL
  `

  await sequelizeConn.query(insertQuery, {
    replacements: [projectId],
    transaction,
    type: QueryTypes.INSERT,
  })
}

/**
 * Gets count of published media for notification purposes
 * @param {number} projectId - Project ID
 * @param {boolean} publishMatrixMediaOnly - Whether only matrix media is published
 * @returns {number} Count of published media
 */
export async function getPublishedMediaCount(
  projectId,
  publishMatrixMediaOnly = false
) {
  let query = 'SELECT COUNT(*) AS count FROM media_files WHERE project_id = ?'

  if (publishMatrixMediaOnly) {
    query += ' AND in_use_in_matrix = 1'
  }

  const [results] = await sequelizeConn.query(query, {
    replacements: [projectId],
    type: QueryTypes.SELECT,
  })

  return results?.count || 0
}

/**
 * Main function to publish a project
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID publishing the project
 * @param {boolean} isCurator - Whether user is a curator (can bypass media checks)
 * @returns {Object} { success: boolean, message?: string, mediaErrors?: Array }
 */
export async function publishProject(projectId, userId, isCurator = false) {
  const transaction = await sequelizeConn.transaction()

  try {
    // Get the project
    const project = await models.Project.findByPk(projectId, { transaction })
    if (!project) {
      throw new Error('Project not found')
    }

    // Check if already published
    if (project.published === 1) {
      await transaction.rollback()
      return { success: false, message: 'Project is already published' }
    }

    // Check for media with incomplete copyright info (unless curator)
    if (!isCurator) {
      const unfinishedMedia = await getUnfinishedMedia(
        projectId,
        project.publish_matrix_media_only
      )

      if (unfinishedMedia.length > 0) {
        await transaction.rollback()
        const mediaNumbers = unfinishedMedia.map((m) => `M${m.media_id}`)
        return {
          success: false,
          message: `The following media files have no license selected or have their Copyright Permission set to 'Copyright permission not yet requested' or 'Permission pending' or Media reuse license set to 'Unknown - Will set before project publication': ${mediaNumbers.join(
            ', '
          )}. Please select the appropriate copyright permission and license for these files before publishing your project.`,
          mediaErrors: unfinishedMedia,
        }
      }
    }

    // Update matrix media flags if needed
    if (project.publish_matrix_media_only) {
      await updateMatrixMediaFlags(
        projectId,
        project.exemplar_media_id,
        transaction
      )
    }

    // Set exemplar media to publish
    if (project.exemplar_media_id) {
      await sequelizeConn.query(
        'UPDATE media_files SET published = 0 WHERE media_id = ?',
        {
          replacements: [project.exemplar_media_id],
          transaction,
          type: QueryTypes.UPDATE,
        }
      )
    }

    // Get user for changelog logging
    const user = await models.User.findByPk(userId, { transaction })
    if (!user) {
      throw new Error('User not found')
    }

    // Create/update bibliographic reference
    await createBibliographicReference(project, userId, transaction, user)

    // // Link member institutions
    await linkMemberInstitutions(projectId, project, transaction)

    // // Update project as published
    await project.update(
      {
        published: 1,
        published_on: time(),
      },
      { transaction, user }
    )

    await transaction.commit()

    return { success: true }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
