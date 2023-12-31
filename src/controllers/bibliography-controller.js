import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import { DataTypes } from 'sequelize'
import * as service from '../services/bibliography-service.js'

export async function getBibliographies(req, res) {
  const groupId = req.project.group_id
  const bibliographies = groupId
    ? await service.getBibliographiesByGroupId(groupId)
    : await service.getBibliographiesByProjectId(req.project.project_id)
  res.status(200).json({
    bibliographies: bibliographies.map(convertBibliographicResponse),
  })
}

export async function createBibliographies(req, res) {
  const values = sanitizeBibliographyRequest(req.body)
  const bibliography = models.BibliographicReference.build(values)

  bibliography.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    monograph_title: '',
    external_identifier: '',
    article_secondary_title: '',
    worktype: '',
    author_address: '',
  })

  try {
    const transaction = await sequelizeConn.transaction()
    await bibliography.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update bibliography with server error' })
    return
  }

  res.status(200).json({
    bibliography: convertBibliographicResponse(bibliography),
  })
}

export async function deleteBibliographies(req, res) {
  const referenceIds = req.body.reference_ids
  const transaction = await sequelizeConn.transaction()
  await models.BibliographicReference.destroy({
    where: {
      reference_id: referenceIds,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ reference_ids: referenceIds })
}

export async function editBibliographies(req, res) {
  const referenceIds = req.body.reference_ids
  const projectId = req.project.project_id
  const values = sanitizeBibliographyRequest(req.body.changes)

  const transaction = await sequelizeConn.transaction()
  await models.BibliographicReference.update(values, {
    where: {
      reference_id: referenceIds,
      project_id: projectId,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  const bibliographies = service.getBibliographiesByIds(referenceIds)
  res.status(200).json({
    bibliographies: bibliographies.map(convertBibliographicResponse),
  })
}

export async function getBibliography(req, res) {
  const projectId = req.project.project_id
  const referenceId = req.params.referenceId
  const bibliography = await service.getBibliography(projectId, referenceId)
  res.status(200).json({
    bibliographies: bibliography.map(convertBibliographicResponse),
  })
}

export async function editBibliography(req, res) {
  const referenceId = req.params.referenceId
  const bibliography = await models.BibliographicReference.findByPk(referenceId)
  if (bibliography == null) {
    res.status(404).json({ message: 'Bibliograhy is not found' })
    return
  }

  // Bibliographic references can be shared across projects that are in the same
  // group.
  const projectId = req.project.project_id
  if (bibliography.project_id != projectId && req.project.group_id != null) {
    const project = await models.Project.findByPk(projectId)
    if (req.project.group_id != project.group_id) {
      res.status(404).json({ message: 'Bibliograhy is not in project' })
      return
    }
  }

  const values = sanitizeBibliographyRequest(req.body)
  for (const column in values) {
    bibliography.set(column, values[column])
  }

  try {
    const transaction = await sequelizeConn.transaction()
    await bibliography.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update bibliography with server error' })
    return
  }

  res.status(200).json({
    bibliography: convertBibliographicResponse(bibliography),
  })
}

export async function search(req, res) {
  // TODO(kenzley): Implement a real search instead of a random selection.
  const projectId = req.project.project_id
  const bibliographies = await service.getBibliographiesByProjectId(projectId)
  const bibliographyIds = bibliographies
    .map((b) => b.reference_id)
    .sort(() => 0.5 - Math.random())
    .splice(0, 15)
  res.status(200).json({
    results: bibliographyIds,
  })
}

function sanitizeBibliographyRequest(body) {
  const obj = {}
  const attributes = models.BibliographicReference.getAttributes()
  for (const column in body) {
    const attribute = attributes[column]
    if (attribute == null) {
      continue
    }

    let value = body[column]
    const typeKey = attribute.type.key
    switch (typeKey) {
      case DataTypes.SMALLINT.key:
        value = parseInt(value) || 0
    }
    if (!value && attribute.allowNull) {
      value = null
    }
    obj[column] = value
  }

  return obj
}

function convertBibliographicResponse(bibliography) {
  return {
    reference_id: bibliography.reference_id,
    user_id: bibliography.user_id,
    created_on: bibliography.created_on,
    article_title: bibliography.article_title,
    journal_title: bibliography.journal_title,
    monograph_title: bibliography.monograph_title,
    authors: bibliography.authors,
    editors: bibliography.editors,
    vol: bibliography.vol,
    num: bibliography.num,
    pubyear: bibliography.pubyear,
    publisher: bibliography.publisher,
    abstract: bibliography.abstract,
    description: bibliography.description,
    collation: bibliography.collation,
    external_identifier: bibliography.external_identifier,
    secondary_authors: bibliography.secondary_authors,
    article_secondary_title: bibliography.article_secondary_title,
    urls: bibliography.urls,
    worktype: bibliography.worktype,
    edition: bibliography.edition,
    sect: bibliography.sect,
    isbn: bibliography.isbn,
    keywords: bibliography.keywords,
    lang: bibliography.lang,
    electronic_resource_num: bibliography.electronic_resource_num,
    author_address: bibliography.author_address,
    reference_type: bibliography.reference_type,
    place_of_publication: bibliography.place_of_publication,
    project_citation: bibliography.project_citation,
  }
}
