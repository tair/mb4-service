import sequelizeConn from '../util/db.js'

export async function getMediaLabels(mediaId, tableNumber, linkId = null) {
  let query = 'SELECT * FROM media_labels WHERE media_id = ? AND table_num = ?'
  let replacements = [mediaId, tableNumber]
  
  // Filter by link_id if provided
  if (linkId) {
    query += ' AND link_id = ?'
    replacements.push(linkId)
  }
  
  const [labels] = await sequelizeConn.query(query, {
    replacements: replacements,
  })
  return labels
}
