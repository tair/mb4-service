import sequelizeConn from '../util/db.js';

async function getImageProps(projectId, type) {
  const [rows] = await sequelizeConn.query(`
    SELECT media
    FROM media_files m
    WHERE m.project_id = ? AND m.media <> ''
    ORDER BY m.media_id
    LIMIT 1`,
    { replacements: [projectId] }
  )
  try {
      return rows.length ? rows[0].media[type]: null;
  } catch (e) {
    console.log('getImageProp: ' + rows[0].media)
  }
}

async function getMediaFiles(projectId) {
  const [rows] = await sequelizeConn.query(
    "SELECT * FROM media_files WHERE project_id = ? AND media != ''",
    { replacements: [projectId] }
  )

  for (let i = 0; i < rows.length; i++) {
    let mediaObj = rows[i]
    if (mediaObj.media) {
      const { medium, thumbnail } = mediaObj.media
      mediaObj.media = { medium, thumbnail }
      rows[i] = mediaObj
    }
  }

  return rows
}

async function getMediaViews(projectId) {
  let [rows] = await sequelizeConn.query(
    "SELECT name FROM media_views WHERE project_id = ? ",
    { replacements: [projectId] }
  )

  let res = []
  for (var i in rows) {
    res.push(rows[i].name)
  }
  return res
}

export {getImageProps, getMediaFiles, getMediaViews}