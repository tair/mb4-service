import sequelizeConn from '../util/db.js'
import { Op } from 'sequelize'
import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'
import * as taxaService from '../services/taxa-service.js'
import { models } from '../models/init-models.js'
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
  const taxon = models.Taxon.build(values)

  taxon.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
  })

  try {
    const transaction = await sequelizeConn.transaction()
    await taxon.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create taxon with server error' })
    return
  }

  res.status(200).json({ taxon: taxon })
}

export async function createTaxa(req, res) {
  const taxa = req.body

  try {
    const results = []
    const transaction = await sequelizeConn.transaction()
    for (const values of taxa) {
      const taxon = models.Taxon.build(values)
      taxon.set({
        project_id: req.project.project_id,
        user_id: req.user.user_id,
      })
      await taxon.save({
        transaction,
        user: req.user,
      })
      results.push(taxon)
    }
    await transaction.commit()
    res.status(200).json({ taxa: results })
  } catch (e) {
    console.log(e)
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

  try {
    const transaction = await sequelizeConn.transaction()
    await taxon.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update taxon with server error' })
    return
  }

  res.status(200).json({
    taxon: taxon,
  })
}

export async function getUsage(req, res) {
  const taxonIds = req.body.taxon_ids
  const referenceMapper = new ModelRefencialMapper(ModelReferencialConfig.TAXA)

  const usages = await referenceMapper.getUsageCount(taxonIds)
  res.status(200).json({
    usages: usages,
  })
}

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
