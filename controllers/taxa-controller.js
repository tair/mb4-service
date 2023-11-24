import sequelizeConn from '../util/db.js'
import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'
import * as taxaService from '../services/taxa-service.js'
import { models } from '../models/init-models.js'

export async function getTaxa(req, res) {
  const projectId = req.params.projectId
  const taxa = await taxaService.getTaxaInProject(projectId)
  res.status(200).json({ taxa })
}

export async function getTaxaUsages(req, res) {
  const projectId = req.params.projectId
  const [partitions, matrices] = await Promise.all([
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
    partition.taxa_ids = taxaIds
  }

  for (const matrix of matrices) {
    const taxaIds = taxaMatrices.get(matrix.matrix_id) ?? []
    matrix.taxa_ids = taxaIds
  }

  res.status(200).json({
    partitions: partitions,
    matrices: matrices,
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

export async function deleteTaxa(req, res) {
  const projectId = req.project.project_id
  const taxonIds = req.body.taxon_ids

  const transaction = await sequelizeConn.transaction()
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
