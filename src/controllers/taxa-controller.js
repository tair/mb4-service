import sequelizeConn from '../util/db.js'
import { Op } from 'sequelize'
import * as bibliographyService from '../services/bibliography-service.js'
import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'
import * as taxaService from '../services/taxa-service.js'
import { models } from '../models/init-models.js'
import { getTaxonHash } from '../models/taxon.js'
import { TAXA_FIELD_NAMES, getTaxonName } from '../util/taxa.js'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'
import { array_difference, set_intersect } from '../util/util.js'
import { Multimap } from '../lib/multimap.js'

export async function getTaxa(req, res) {
  const projectId = req.params.projectId

  const [taxa, partitions, matrices] = await Promise.all([
    taxaService.getTaxaInProject(projectId),
    partitionService.getPartitions(projectId),
    matrixService.getMatrices(projectId),
  ])

  const partitionIds = partitions.map((partition) => partition.partition_id)
  const matrixIds = matrices.map((matrix) => matrix.matrix_id)

  const [taxaPartitions, taxaMatrices] = await Promise.all([
    partitionService.getTaxaInPartitions(partitionIds),
    matrixService.getTaxaInMatrices(matrixIds),
  ])

  for (const partition of partitions) {
    const taxaIds = taxaPartitions.get(partition.partition_id) ?? []
    partition.taxon_ids = taxaIds
  }

  for (const matrix of matrices) {
    const taxaIds = taxaMatrices.get(matrix.matrix_id) ?? []
    matrix.taxon_ids = taxaIds
  }

  res.status(200).json({
    taxa,
    partitions,
    matrices,
  })
}

export async function createTaxon(req, res) {
  const values = req.body
  const projectId = req.project.project_id

  // Validate: require at least one taxonomic field
  const hasTaxonomicField = TAXA_FIELD_NAMES.some((field) => {
    const v = values[field]
    return v !== undefined && String(v).trim() !== ''
  })
  if (!hasTaxonomicField) {
    return res
      .status(400)
      .json({ message: 'At least one taxonomic field must be provided.' })
  }

  let transaction
  try {
    transaction = await sequelizeConn.transaction()
    
    // Build the taxon and compute its hash
    const taxon = models.Taxon.build(values)
    taxon.set({
      project_id: projectId,
      user_id: req.user.user_id,
    })
    
    const hash = getTaxonHash(taxon)
    
    // Check if a taxon with the same hash already exists in this project
    const query = `
      SELECT t.*
      FROM taxa t
      WHERE t.project_id = ?
      AND t.taxon_hash = ?
    `
    const existingTaxa = await sequelizeConn.query(query, {
      replacements: [projectId, hash],
      transaction: transaction,
      type: sequelizeConn.QueryTypes.SELECT,
    })
    
    if (existingTaxa && existingTaxa.length > 0) {
      await transaction.rollback()
      const existingTaxon = existingTaxa[0]
      // Get taxon name and strip HTML tags for display
      const taxonName = getTaxonName(existingTaxon, null, false, false)
      const displayName = taxonName ? taxonName.replace(/<\/?[^>]+(>|$)/g, '') : 'this taxon'
      return res.status(400).json({ 
        message: `The taxon "${displayName}" already exists in this project.`,
        existing_taxon_id: existingTaxon.taxon_id,
        existing_taxon_name: displayName
      })
    }
    
    // No duplicate found, proceed with save
    await taxon.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    
    res.status(200).json({ taxon: taxon })
  } catch (e) {
    if (transaction) {
      await transaction.rollback()
    }
    console.error('Error creating taxon:', e)
    res
      .status(500)
      .json({ message: 'Failed to create taxon with server error' })
  }
}

export async function createTaxa(req, res) {
  const taxa = req.body.taxa
  const projectId = req.project.project_id

  let transaction
  try {
    // Validate each taxon: must have at least one taxonomic field
    const invalid = Array.isArray(taxa)
      ? taxa.filter(
          (values) =>
            !TAXA_FIELD_NAMES.some((field) => {
              const v = values[field]
              return v !== undefined && String(v).trim() !== ''
            })
        )
      : []
    if (invalid.length > 0) {
      return res.status(400).json({
        message:
          'Each taxon must include at least one taxonomic field. Found entries with no taxonomic data.',
        invalid_count: invalid.length,
      })
    }

    const results = []
    transaction = await sequelizeConn.transaction()

    // First pass: prepare all taxon objects and collect hashes
    const taxonHashes = []
    const taxonObjects = new Map()

    for (const values of taxa) {
      const taxon = models.Taxon.build(values)
      taxon.set({
        project_id: projectId,
        user_id: req.user.user_id,
      })

      const hash = getTaxonHash(taxon)
      taxonHashes.push(hash)
      taxonObjects.set(hash, { taxon, values })
    }

    // Bulk search for existing taxa by hash
    let existingTaxaMap = new Map()
    if (taxonHashes.length > 0) {
      const placeholders = taxonHashes.map(() => '?').join(',')
      const query = `
        SELECT t.*
        FROM taxa t
        WHERE t.project_id = ?
        AND t.taxon_hash IN (${placeholders})
      `
      const replacements = [projectId, ...taxonHashes]

      const foundTaxa = await sequelizeConn.query(query, {
        replacements,
        transaction: transaction,
        type: sequelizeConn.QueryTypes.SELECT,
      })

      // Create a map of existing taxa by their hash
      if (Array.isArray(foundTaxa)) {
        for (const taxon of foundTaxa) {
          if (taxon && taxon.taxon_hash) {
            existingTaxaMap.set(taxon.taxon_hash, taxon)
          }
        }
      }
    }

    // Second pass: create or use existing taxa
    for (const [hash, { taxon, values }] of taxonObjects) {
      const existingTaxon = existingTaxaMap.get(hash)

      if (existingTaxon) {
        // Use existing taxon - just return it in results
        results.push(existingTaxon)
      } else {
        // Create new taxon
        await taxon.save({
          transaction,
          user: req.user,
        })
        results.push(taxon)
      }
    }

    await transaction.commit()
    res.status(200).json({ taxa: results })
  } catch (e) {
    if (transaction) {
      await transaction.rollback()
    }
    console.error('Error creating taxa:', e)
    res
      .status(500)
      .json({ message: 'Failed to create taxon with server error' })
  }
}

export async function editTaxon(req, res) {
  const projectId = req.project.project_id
  const taxonId = req.params.taxonId
  const taxon = await models.Taxon.findByPk(taxonId)
  if (taxon == null || taxon.project_id != projectId) {
    res.status(404).json({ message: 'Taxon is not found' })
    return
  }

  const values = req.body
  for (const column in values) {
    taxon.set(column, values[column])
  }

  let transaction
  try {
    transaction = await sequelizeConn.transaction()
    await taxon.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    
    res.status(200).json({
      taxon: taxon,
    })
  } catch (e) {
    if (transaction) {
      await transaction.rollback()
    }
    console.error('Error updating taxon:', e)
    res
      .status(500)
      .json({ message: 'Failed to update taxon with server error' })
  }
}

export async function editTaxa(req, res) {
  const projectId = req.project.project_id
  const taxaIds = req.body.taxa_ids
  const values = req.body.taxa

  const isInProject = await taxaService.isTaxaInProject(taxaIds, projectId)
  if (!isInProject) {
    return res.status(400).json({
      message: 'Not all taxa are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    const referenceId = values.reference_id
    if (referenceId) {
      const rows = await bibliographyService.getTaxaIds(referenceId, taxaIds)
      const existingTaxaIds = new Set(rows.map((r) => r.taxon_id))
      const newTaxaIds = taxaIds.filter((id) => !existingTaxaIds.has(id))
      await models.TaxaXBibliographicReference.bulkCreate(
        newTaxaIds.map((taxonId) => ({
          reference_id: referenceId,
          taxon_id: taxonId,
          user_id: req.user.user_id,
        })),
        {
          transaction: transaction,
          individualHooks: true,
          ignoreDuplicates: true,
          user: req.user,
        }
      )
    }

    await models.Taxon.update(values, {
      where: { taxon_id: taxaIds },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    const taxa = await models.Taxon.findAll({
      where: {
        taxon_id: taxaIds,
      },
      transaction: transaction,
    })
    await transaction.commit()
    res.status(200).json({
      taxa,
    })
  } catch (e) {
    await transaction.rollback()
    console.log(e)
    res.status(500).json({ message: 'Failed to edit media with server error' })
  }
}

export async function getUsage(req, res) {
  const taxonIds = req.body.taxon_ids
  const referenceMapper = new ModelRefencialMapper(ModelReferencialConfig.TAXA)

  const usages = await referenceMapper.getUsageCount(taxonIds)
  res.status(200).json({
    usages: usages,
  })
}

// TODO(kenzley): Implement a real search.
export async function search(req, res) {
  const projectId = req.project.project_id
  const text = req.body.text

  const taxa = text?.length
    ? await models.Taxon.findAll({
        attributes: ['taxon_id'],
        where: {
          genus: {
            [Op.like]: `%${text}%`,
          },
          project_id: projectId,
        },
      })
    : []
  const taxonIds = taxa.map((t) => t.taxon_id)
  res.status(200).json({
    results: taxonIds,
  })
}

export async function deleteTaxa(req, res) {
  const projectId = req.project.project_id
  const taxonIds = req.body.taxon_ids
  const remappedTaxonIds = req.body.remapped_taxon_ids

  const remapSourceTaxonIds = Object.keys(remappedTaxonIds).map((id) =>
    parseInt(id)
  )
  const remapTargetTaxonIds = Object.values(remappedTaxonIds).map((id) =>
    parseInt(id)
  )

  // Ensure that the taxon ids that will be remapped are also in the list of
  // taxa that will be deleted.
  if (array_difference(remapSourceTaxonIds, taxonIds).length) {
    return res.status(200).json({
      message: 'Remap contains taxon that specified in deletion',
    })
  }

  // Ensure that we are not remapping to the same taxon.
  for (const [source, target] of Object.entries(remappedTaxonIds)) {
    if (source == target) {
      return res.status(400).json({
        message: 'Cannot remap to the same taxon',
      })
    }
  }

  // Ensure that all of the deleted taxa and the ones that will be remapped are
  // within the same project.
  const allTaxonIds = Array.from(new Set([...taxonIds, ...remapTargetTaxonIds]))
  const isTaxaInProject = await taxaService.isTaxaInProject(
    allTaxonIds,
    projectId
  )
  if (!isTaxaInProject) {
    return res.status(400).json({
      message: 'Not all taxa are in the specified project',
    })
  }

  // Ensure that the source taxon id doesn't map to a target taxon id within the
  // same matrix since this will combine cell sources which is not supported.
  const mappedTaxonIds = Array.from(
    new Set([...remapSourceTaxonIds, ...remapTargetTaxonIds])
  )
  if (mappedTaxonIds.length) {
    const taxonIdToMatrixIdRows = await taxaService.getMatrixIds(mappedTaxonIds)
    const taxonMatrixIds = new Multimap()
    for (const record of taxonIdToMatrixIdRows) {
      const taxonId = parseInt(record.taxon_id)
      const matrixId = parseInt(record.matrix_id)
      taxonMatrixIds.put(taxonId, matrixId)
    }
    for (const [source, target] of Object.entries(remappedTaxonIds)) {
      const sourceMatrixIds = taxonMatrixIds.get(source)
      if (!sourceMatrixIds) {
        continue
      }
      const targetMatrixIds = taxonMatrixIds.get(target)
      if (!targetMatrixIds) {
        continue
      }
      if (set_intersect(sourceMatrixIds, targetMatrixIds).size) {
        return res.status(400).json({
          message: 'Cannot remap to the same taxon',
        })
      }
    }
  }

  const transaction = await sequelizeConn.transaction()

  const referenceMapper = new ModelRefencialMapper(
    ModelReferencialConfig.TAXA,
    transaction,
    req.user
  )
  await referenceMapper.moveReferences(
    new Map(Object.entries(remappedTaxonIds))
  )

  await models.Taxon.destroy({
    where: {
      taxon_id: taxonIds,
      project_id: projectId,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ taxon_ids: taxonIds })
}

export async function getCitations(req, res) {
  const projectId = req.project.project_id
  const taxonId = req.params.taxonId
  const citations = await taxaService.getTaxonCitations(projectId, taxonId)
  res.status(200).json({
    citations,
  })
}

export async function createCitation(req, res) {
  const projectId = req.project.project_id
  const taxonId = req.params.taxonId

  const taxon = await models.Taxon.findByPk(taxonId)
  if (taxon == null) {
    res.status(404).json({ message: 'Unable to find taxon' })
    return
  }

  if (taxon.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Taxon is not associated with this project' })
    return
  }

  const values = req.body.citation
  const referenceId = req.body.citation.reference_id
  const bibliography = await models.BibliographicReference.findByPk(referenceId)
  if (bibliography == null) {
    res.status(404).json({ message: 'Unable to find bibliography' })
    return
  }

  if (bibliography.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Bibliography is not associated with this project' })
    return
  }

  // Check for duplicate citation
  const existingCitation = await models.TaxaXBibliographicReference.findOne({
    where: {
      taxon_id: taxon.taxon_id,
      reference_id: bibliography.reference_id,
    },
  })

  if (existingCitation) {
    res.status(400).json({ message: 'This citation already exists' })
    return
  }

  const citation = models.TaxaXBibliographicReference.build(values)
  citation.set({
    taxon_id: taxon.taxon_id,
    reference_id: bibliography.reference_id,
    user_id: req.user.user_id,
  })

  let transaction
  try {
    transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    
    res.status(200).json({ citation })
  } catch (e) {
    if (transaction) {
      await transaction.rollback()
    }
    console.error('Error creating citation:', e)
    res
      .status(500)
      .json({ message: 'Failed to create citation with server error' })
  }
}

export async function editCitation(req, res) {
  const projectId = req.project.project_id
  const taxonId = req.params.taxonId
  const citationId = req.params.citationId

  const taxon = await models.Taxon.findByPk(taxonId)
  if (taxon == null) {
    res.status(404).json({ message: 'Unable to find taxon' })
    return
  }

  if (taxon.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Taxon is not associated with this project' })
    return
  }

  const citation = await models.TaxaXBibliographicReference.findByPk(citationId)
  if (citation == null || citation.taxon_id != taxonId) {
    res.status(404).json({ message: 'Unable to find citation' })
    return
  }

  const values = req.body.citation

  // For editing, we only allow updating pp and notes, not reference_id
  const allowedFields = ['pp', 'notes']
  for (const key in values) {
    if (allowedFields.includes(key)) {
      citation.set(key, values[key])
    }
  }
  
  let transaction
  try {
    transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    
    res.status(200).json({ citation })
  } catch (e) {
    if (transaction) {
      await transaction.rollback()
    }
    console.error('Error updating citation:', e)
    res
      .status(500)
      .json({ message: 'Failed to update citation with server error' })
  }
}

export async function deleteCitations(req, res) {
  const projectId = req.project.project_id
  const taxonId = req.params.taxonId
  const citationIds = req.body.citation_ids

  const inProject = await taxaService.isTaxonCitationsInProject(
    projectId,
    taxonId,
    citationIds
  )
  if (!inProject) {
    return res.status(400).json({
      message: 'Not all taxa are in the specified project',
    })
  }
  const transaction = await sequelizeConn.transaction()
  try {
    await models.TaxaXBibliographicReference.destroy({
      where: {
        link_id: citationIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ citation_ids: citationIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: "Error deleting taxa's citations" })
    console.log('Error deleting citations', e)
  }
}

export async function updateExtinctStatusBatch(req, res) {
  const projectId = req.project.project_id
  const taxonIds = req.body.ids
  const isExtinct = req.body.extinct ? 1 : 0

  if (!Array.isArray(taxonIds) || taxonIds.length === 0) {
    return res.status(400).json({
      message: 'Invalid taxon IDs provided',
    })
  }

  // Validate extinct status
  if (typeof req.body.extinct !== 'number' && typeof req.body.extinct !== 'boolean') {
    return res.status(400).json({
      message: 'Invalid extinct status. Must be 0 or 1',
    })
  }

  try {
    // Verify all taxa exist and belong to this project
    const isInProject = await taxaService.isTaxaInProject(taxonIds, projectId)
    if (!isInProject) {
      return res.status(400).json({
        message: 'Not all taxa are in the specified project',
      })
    }

    const transaction = await sequelizeConn.transaction()
    
    // Update extinct status for all specified taxa
    await models.Taxon.update(
      { is_extinct: isExtinct },
      {
        where: {
          taxon_id: taxonIds,
          project_id: projectId,
        },
        transaction: transaction,
        individualHooks: true,
        user: req.user,
      }
    )

    await transaction.commit()
    
    res.status(200).json({
      status: 'ok',
      message: `Successfully updated ${taxonIds.length} taxa`,
      updated_count: taxonIds.length,
    })
  } catch (e) {
    console.log('Error updating extinct status:', e)
    res.status(500).json({
      status: 'error',
      errors: ['Failed to update extinct status with server error'],
    })
  }
}
