import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import { DataTypes } from 'sequelize'
import * as service from '../services/bibliography-service.js'
import { XMLParser } from 'fast-xml-parser'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

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

export async function uploadEndNoteXML(req, res) {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ message: 'No file uploaded' })
  }

  const projectId = req.project.project_id
  const file = req.files.file
  const tempFilePath = path.join(os.tmpdir(), file.name)

  try {
    // Save the uploaded file temporarily
    await file.mv(tempFilePath)

    // Parse the XML file
    const xmlData = await fs.readFile(tempFilePath, 'utf8')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    })
    const xmlObj = parser.parse(xmlData).xml

    if (!xmlObj.records || !xmlObj.records.record) {
      return res.status(400).json({
        message: 'Invalid EndNote XML format',
        import_info: {
          import_count: 0,
          update_count: 0,
          error_count: 1,
          record_count: 0,
          errors: ['Uploaded file was not in the EndNote XML format'],
        },
      })
    }

    const records = Array.isArray(xmlObj.records.record)
      ? xmlObj.records.record
      : [xmlObj.records.record]

    const transaction = await sequelizeConn.transaction()
    let importCount = 0
    let updateCount = 0
    let errorCount = 0
    const errors = []

    for (const record of records) {
      try {
        const externalIdentifier = `${record['source-app']['#text']}:${record.database['#text']}:${record['rec-number']}`

        // Check if reference already exists
        const existingRef = await models.BibliographicReference.findOne({
          where: {
            external_identifier: externalIdentifier,
            project_id: projectId,
          },
        })

        // Helper function to extract text from style object
        const getText = (obj) => {
          if (!obj) return ''
          if (Array.isArray(obj.style)) {
            return obj.style.map((s) => s['#text']).join(' ')
          }
          return obj.style?.['#text'] || ''
        }

        // Helper function to extract keywords
        const getKeywords = (keywords) => {
          if (!keywords?.keyword) return ''
          const keywordArray = Array.isArray(keywords.keyword)
            ? keywords.keyword
            : [keywords.keyword]
          return keywordArray.map((k) => k.style['#text']).join(', ')
        }

        const bibliographyData = {
          project_id: projectId,
          user_id: req.user.user_id,
          external_identifier: externalIdentifier,
          article_title: getText(record.titles?.title),
          article_secondary_title: getText(record.titles?.['secondary-title']),
          journal_title: getText(record.periodical?.['full-title']),
          monograph_title: '', // Required field, default empty string
          description: '', // Required field, default empty string
          place_of_publication: '', // Required field, default empty string
          author_address: '', // Not present in the XML
          reference_type: parseInt(record['ref-type']?.['#text']) || 0,
          electronic_resource_num: getText(record['electronic-resource-num']),
          lang: '', // Not present in the XML
          worktype: '', // Not present in the XML
          vol: getText(record.volume),
          num: getText(record.number),
          pubyear: getText(record.dates?.year),
          publisher: getText(record.publisher),
          collation: getText(record.pages),
          isbn: getText(record.isbn),
          abstract: getText(record.abstract),
          edition: '', // Not present in the XML
          sect: '', // Not present in the XML
          urls: record.urls?.['pdf-urls']?.url || '',
          keywords: getKeywords(record.keywords),
          authors: JSON.stringify([]), // Initialize empty authors array
          secondary_authors: JSON.stringify([]), // Initialize empty secondary authors array
        }

        let bibliography
        if (existingRef) {
          await existingRef.update(bibliographyData, {
            transaction,
            user: req.user,
          })
          bibliography = existingRef
          updateCount++
        } else {
          bibliography = await models.BibliographicReference.create(
            bibliographyData,
            {
              transaction,
              user: req.user,
            }
          )
          importCount++
        }

        // Process primary authors
        const primaryAuthors = []
        if (record.contributors?.authors?.author) {
          const authors = Array.isArray(record.contributors.authors.author)
            ? record.contributors.authors.author
            : [record.contributors.authors.author]

          for (const author of authors) {
            const authorName = author.style['#text']
            const authorParts = authorName.split(',')
            const surname = authorParts[0]?.trim()
            const forename = authorParts[1]?.trim()
            const middlename = authorParts[2]?.trim() || ''

            if (surname) {
              // Also add to primary authors array
              primaryAuthors.push({
                surname,
                forename: forename || '',
                middlename: middlename || '',
              })
              // No need to save to bibliography-author table
            }
          }
        }

        // Process secondary authors
        const secondaryAuthors = []
        if (record.contributors?.['secondary-authors']?.author) {
          const authors = Array.isArray(
            record.contributors['secondary-authors'].author
          )
            ? record.contributors['secondary-authors'].author
            : [record.contributors['secondary-authors'].author]

          for (const author of authors) {
            const authorName = author.style['#text']
            const authorParts = authorName.split(',')
            const surname = authorParts[0]?.trim()
            const forename = authorParts[1]?.trim()
            const middlename = authorParts[2]?.trim() || ''

            if (surname) {
              // Also add to secondary authors array
              secondaryAuthors.push({
                surname,
                forename: forename || '',
                middlename: middlename || '',
              })
              // No need to save to bibliography-author table
            }
          }
        }

        await bibliography.update(
          {
            authors: primaryAuthors,
            secondary_authors: secondaryAuthors,
          },
          {
            transaction,
            user: req.user,
          }
        )
      } catch (error) {
        console.log(error.message)
        errorCount++
        errors.push(`Error processing record: ${error.message}`)
      }
    }

    await transaction.commit()
    await fs.unlink(tempFilePath) // Clean up temp file

    res.status(200).json({
      import_info: {
        import_count: importCount,
        update_count: updateCount,
        error_count: errorCount,
        record_count: records.length,
        errors,
      },
    })
  } catch (error) {
    console.error('Error processing EndNote XML:', error)
    res.status(500).json({
      message: 'Error processing EndNote XML file',
      error: error.message,
    })
  }
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
