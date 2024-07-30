import sequelizeConn from '../util/db.js'

export async function getMediaLabels(mediaId, tableNumber) {
  const [labels] = await sequelizeConn.query(
    `
    SELECT *
    FROM media_labels l
    INNER JOIN ca_users AS wu ON wu.user_id = l.user_id
    INNER JOIN media_files AS m ON m.media_id = l.media_id
    WHERE l.media_id = ? AND l.table_num = ?`,
    {
      replacements: [mediaId, tableNumber],
    }
  )
  return labels
}
