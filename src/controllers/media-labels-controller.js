import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as service from '../services/media-label-service.js'
import { TABLE_NUMBERS } from '../lib/table-number.js'
import { Datamodel } from '../lib/datamodel/datamodel.js'

export async function getMediaLabels(req, res) {
  const projectId = req.params.projectId
  const mediaId = req.params.mediaId

  // Confirms that the media file belongs to the project to prevent access to
  // media files in different projects.
  const media = await models.MediaFile.findByPk(mediaId)
  if (media == null || media.project_id != projectId) {
    res.status(404).json({ message: 'Media is not found' })
    return
  }

  const type = req.query.type
  const tableNum = getTabelNumberFromType(type)
  if (tableNum == null) {
    res.status(400).json({ message: 'Type not specified' })
    return
  }

  const rows = await service.getMediaLabels(mediaId, tableNum)

  const labels = []
  for (const row of rows) {
    // TODO: Consider merging the title and content columns. Not sure why there are two.
    const title = type == 'M' ? row.title : row.content
    const properties = row.properties
    const label = {
      annotation_id: row.label_id,
      x: properties.x,
      y: properties.y,
      w: properties.w || 1,
      h: properties.h || 1,
      tx: properties.tx || properties.x + 10,
      ty: properties.ty || properties.y - 10,
      tw: properties.tw || 1,
      th: properties.th || 1,
      label: title,
      locked: properties.locked,
      showDefaultText: properties.showDefaultText ?? 1,
    }
    switch (row.typecode) {
      case 0:
        label.type = 'rect'
        break
      case 1:
        label.type = 'point'
        break
      case 2:
        label.type = 'poly'
        label.points = properties.points
        break
    }

    labels.push(label)
  }

  res.status(200).json(labels)
}

export async function editMediaLabels(req, res) {
  const projectId = req.params.projectId
  const mediaId = req.params.mediaId

  // Confirms that the media file belongs to the project to prevent access to
  // media files in different projects.
  const media = await models.MediaFile.findByPk(mediaId)
  if (media == null || media.project_id != projectId) {
    res.status(404).json({ message: 'Media is not found' })
    return
  }

  const type = req.query.type
  const tableNum = getTabelNumberFromType(type)
  if (tableNum == null) {
    res.status(400).json({ message: 'Type not specified' })
    return
  }

  // Get the linking table media table and verify that it still exists in the
  // database.
  const datamodel = Datamodel.getInstance()
  const tableModel = datamodel.getTableByNumber(tableNum)
  const linkId = req.body.linkId
  const link = await tableModel.findByPk(linkId)
  if (link == null) {
    res.status(400).json({ message: 'Link is not found' })
    return
  }

  // Confirm that the linking reference also belongs to the project. This
  // check ensures that we don't have cross projects references for labels.
  const reference = await getLinkingReference(link, type)
  if (reference == null || reference.project_id != projectId) {
    res.status(400).json({ message: 'Reference not found in project' })
    return
  }

  const transaction = await sequelizeConn.transaction()
  const newLabels = req.body.save
  for (const properties of newLabels) {
    let label = null
    if (properties.annotation_id) {
      label = await models.MediaLabel.findByPk(properties.annotation_id)
    }
    if (label == null) {
      label = models.MediaLabel.build({
        user_id: req.user.user_id,
        media_id: mediaId,
        link_id: linkId,
        table_num: tableNum,
      })
    }

    label.title = properties.label
    label.content = properties.label
    label.properties = {
      x: properties.x,
      y: properties.y,
      tx: properties.tx,
      ty: properties.ty,
      tw: properties.tw,
      th: properties.th,
      showDefaultText: properties.showDefaultText,
      locked: 0,
    }
    switch (properties.type) {
      case 'rect':
        label.typecode = 0
        label.properties.w = properties.w
        label.properties.h = properties.h
        break
      case 'point':
        label.typecode = 1
        break
      case 'poly':
        label.typecode = 2
        label.properties.points = properties.points
        break
    }

    await label.save({
      transaction,
      user: req.user,
    })

    properties.annotation_id = label.label_id
  }

  await transaction.commit()
  res.status(200).json({
    labels: newLabels,
  })
}

export async function deleteMediaLabels(req, res) {
  const annotationIds = req.body.annotationIds

  // TODO: Implement the ability to delete media labels based on their label_id
  //     primary keys. We must also verify that the label belongs to the media
  //     in the URL.

  res.status(200).json({
    annotationIds,
  })
}

/**
 * Returns the table number of the linking tables which based on the type.
 */
function getTabelNumberFromType(type) {
  switch (type) {
    case 'X':
      return TABLE_NUMBERS.cells_x_media
    case 'M':
      return TABLE_NUMBERS.media_files
    case 'T':
      return TABLE_NUMBERS.taxa_x_media
    case 'C':
      return TABLE_NUMBERS.characters_x_media
    default:
      return null
  }
}

/**
 * Returns the referenced top-level Model in which the labels are associated
 * with (e.g. Matrix, MediaFile, Taxon, Character).
 */
async function getLinkingReference(link, type) {
  switch (type) {
    case 'X':
      return models.Matrix.findByPk(link.matrix_id)
    case 'M':
      return link
    case 'T':
      return models.Taxon.findByPk(link.taxon_id)
    case 'C':
      return models.Character.findByPk(link.character_id)
    default:
      return null
  }
}
