const sequelize = require('../util/db.js')

async function getImageProps(project_id, type) {
  const [rows, metadata] = await sequelize.query(
    `select media from media_files m where 
      m.project_id=${project_id} and m.media <> '' order by m.media_id limit 1`
  )
  try {
    return rows[0].media[type]
  } catch (e) {
    console.log('getImageProp: ' + rows[0].media)
  }
}

async function getMediaFiles(project_id) {
  var [rows, metadata] = await sequelize.query(
    `select * from media_files where project_id=${project_id} and media != ''`
  )

  for (let i = 0; i < rows.length; i++) {
    let mediaObj = rows[i]
    if (mediaObj.media) {
      let { medium, thumbnail } = mediaObj.media
      mediaObj.media = { medium, thumbnail }
      rows[i] = mediaObj
    }
  }

  return rows
}

async function getMediaViews(project_id) {
  let [rows, metadata] = await sequelize.query(
    `select name from media_views where project_id=${project_id}`
  )

  let res = []
  for (var i in rows) {
    res.push(rows[i].name)
  }

  return res
}

module.exports = {
  getImageProps,
  getMediaViews,
  getMediaFiles,
}
