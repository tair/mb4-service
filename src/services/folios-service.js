import sequelizeConn from '../util/db.js'

// for published project data dump
export async function getFolioDetails(projectId) {
  const [rows] = await sequelizeConn.query(
    `SELECT f.folio_id, f.name, f.description, fm.media_id
    FROM folios AS f
    INNER JOIN folios_x_media_files AS fm ON fm.folio_id = f.folio_id
    WHERE  project_id = ?
    ORDER BY folio_id, media_id;`,
    { replacements: [projectId] }
  )
  // Initialize an empty object to group by folio_id
  const groupedByFolio = {}

  // Loop through the results and organize the data
  rows.forEach((row) => {
    const { folio_id, name, description, media_id } = row

    // Check if the folio_id already exists in the groupedByFolio object
    if (!groupedByFolio[folio_id]) {
      // If not, create a new entry for this folio_id
      groupedByFolio[folio_id] = {
        folio_id: folio_id,
        name: name,
        description: description,
        media_files: [],
      }
    }

    // Append the media_id to the media_files array
    groupedByFolio[folio_id].media_files.push(media_id)
  })

  return Object.values(groupedByFolio)
}

export async function getFolios(projectId) {
  const [rows] = await sequelizeConn.query(
    'SELECT * FROM folios WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows
}

export async function isFolioInProject(folioIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM folios
    WHERE project_id = ? AND folio_id IN (?)`,
    {
      replacements: [projectId, folioIds],
    }
  )
  return count == folioIds.length
}

export async function getMedia(projectId, folioId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT fm.link_id, fm.folio_id, fm.media_id, fm.position
    FROM folios AS f
    INNER JOIN folios_x_media_files AS fm ON fm.folio_id = f.folio_id
    WHERE f.project_id = ? AND f.folio_id = ?
    ORDER BY fm.position ASC`,
    {
      replacements: [projectId, folioId],
    }
  )
  return rows
}

export async function getMediaIds(folioId, mediaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT media_id
      FROM folios_x_media_files
      WHERE folio_id = ? AND media_id IN (?)`,
    { replacements: [folioId, mediaIds] }
  )
  return rows
}

export async function isLinkInFolio(folioId, linkIds) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM folios_x_media_files
    WHERE folio_id = ? AND link_id IN (?)`,
    {
      replacements: [folioId, linkIds],
    }
  )
  return count == linkIds.length
}

export async function getFolioMediaPositions(folioId, linkIds) {
  const [row] = await sequelizeConn.query(
    `
    SELECT link_id, position
    FROM folios_x_media_files
    WHERE folio_id = ? AND link_id IN (?)`,
    {
      replacements: [folioId, linkIds],
    }
  )
  return row
}

export async function getMaxPositionForFolioMedia(folioId) {
  const [[{ position }]] = await sequelizeConn.query(
    `
    SELECT MAX(position) as position
    FROM folios_x_media_files
    WHERE folio_id = ?`,
    {
      replacements: [folioId],
    }
  )
  return Math.max(position, 1)
}

export async function reorderMedia(folioId, linkIds, position) {
  const transaction = await sequelizeConn.transaction()

  try {
    // Simple approach: get all items, reorder in memory, then update positions

    // Step 1: Get all media items for this folio ordered by current position
    const [allItems] = await sequelizeConn.query(
      `SELECT link_id, position FROM folios_x_media_files 
       WHERE folio_id = ? ORDER BY position ASC`,
      { replacements: [folioId], transaction }
    )

    // Step 2: Find the items to move and remove them from the array
    const itemsToMove = allItems.filter((item) =>
      linkIds.includes(item.link_id)
    )
    const remainingItems = allItems.filter(
      (item) => !linkIds.includes(item.link_id)
    )

    // Step 3: Insert the moved items at the new position (convert from 1-based to 0-based index)
    const targetIndex = position - 1
    const newOrder = [
      ...remainingItems.slice(0, targetIndex),
      ...itemsToMove,
      ...remainingItems.slice(targetIndex),
    ]

    // Step 4: Update all positions in the database
    for (let i = 0; i < newOrder.length; i++) {
      await sequelizeConn.query(
        `UPDATE folios_x_media_files 
         SET position = ? 
         WHERE folio_id = ? AND link_id = ?`,
        { replacements: [i + 1, folioId, newOrder[i].link_id], transaction }
      )
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    console.error('Reorder failed:', error)
    throw error
  }
}
