import sequelizeConn from '../util/db.js'

export async function getMediaLabels(mediaId, tableNumber) {
  const [labels] = await sequelizeConn.query(
    'SELECT * FROM media_labels WHERE media_id = ? AND table_num = ?',
    {
      replacements: [mediaId, tableNumber],
    }
  )
  return labels
}
