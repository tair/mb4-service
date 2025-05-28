import sequelizeConn from '../util/db.js'
import * as specimenService from '../services/specimen-service.js'
import * as taxaService from '../services/taxa-service.js'
import { models } from '../models/init-models.js'
import { getTaxonHash } from '../models/taxon.js'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'

export async function getSpecimens(req, res) {
  const projectId = req.params.projectId
  const specimens = await specimenService.getProjectSpecimens(projectId)
  res.status(200).json({
    specimens: specimens.map((s) => convertSpecimenResponse(s, s.taxon_id)),
  })
}

export async function createSpecimen(req, res) {
  const columnValues = req.body.specimen
  const taxonId = columnValues.taxon_id
  if (taxonId) {
    const taxon = await models.Taxon.findByPk(taxonId)
    if (taxon.project_id != req.project.project_id) {
      res
        .status(403)
        .json({ message: 'Failed to include taxon from other project' })
      return
    }
  }

  const specimen = models.Specimen.build(columnValues)
  specimen.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
  })

  try {
    const transaction = await sequelizeConn.transaction()
    await specimen.save({
      transaction,
      user: req.user,
    })
    if (taxonId) {
      await models.TaxaXSpecimen.create(
        {
          specimen_id: specimen.specimen_id,
          taxon_id: taxonId,
          user_id: req.user.user_id,
          notes: '',
        },
        {
          user: req.user,
          transaction: transaction,
        }
      )
    }

    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create specimen with server error' })
    return
  }

  res.status(200).json({
    specimen: convertSpecimenResponse(specimen, taxonId),
  })
}

export async function createSpecimens(req, res) {
  const projectId = req.project.project_id
  const taxaMap = new Map()
  try {
    const results = {
      taxa: [],
      specimens: [],
    }
    const transaction = await sequelizeConn.transaction()
    // Create the values from the user and store the hash so that they can be
    // referenced later.
    const hashes = []
    for (const [key, values] of Object.entries(req.body.taxa)) {
      const taxon = models.Taxon.build(values)
      const hash = getTaxonHash(taxon)
      taxon.set({
        project_id: projectId,
        user_id: req.user.user_id,
        taxon_hash: hash,
      })
      taxaMap.set(key, taxon)
      hashes.push(hash)
    }

    // Search the database for the taxon hashes so that we can use a
    // pre-existing taxon instead of a creating a new taxon. If there is no
    // record in the database, we'll create a new taxon and return the values
    // to the user.
    const hashToTaxonIds = await taxaService.getTaxonIdsByHash(
      projectId,
      hashes
    )
    const hashToTaxonIdMap = new Map(
      hashToTaxonIds.map((row) => [row.taxon_hash, row.taxon_id])
    )
    for (const taxon of taxaMap.values()) {
      if (hashToTaxonIdMap.has(taxon.taxon_hash)) {
        const taxonId = hashToTaxonIdMap.get(taxon.taxon_hash)
        taxon.taxon_id = taxonId
      } else {
        await taxon.save({
          transaction,
          user: req.user,
        })
        // Insert the hash into the map so that other entries which have the
        // same hash will not create new elements.
        hashToTaxonIdMap.set(taxon.taxon_hash, taxon.taxon_id)
        results.taxa.push(taxon)
      }
    }

    for (const values of req.body.specimens) {
      const specimen = models.Specimen.build(values)
      specimen.set({
        project_id: req.project.project_id,
        user_id: req.user.user_id,
      })
      await specimen.save({
        transaction,
        user: req.user,
      })
      let taxonId = undefined
      if (values.taxon_hash) {
        taxonId = taxaMap.get(values.taxon_hash).taxon_id
        await models.TaxaXSpecimen.create(
          {
            taxon_id: taxonId,
            specimen_id: specimen.specimen_id,
            user_id: req.user.user_id,
          },
          {
            transaction,
            user: req.user,
          }
        )
      }
      results.specimens.push(convertSpecimenResponse(specimen, taxonId))
    }
    await transaction.commit()
    res.status(200).json(results)
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create taxon with server error' })
  }
}

export async function deleteSpecimens(req, res) {
  const projectId = req.project.project_id
  const specimenIds = req.body.specimen_ids
  const remappedSpecimenIds = req.body.remapped_specimen_ids || {}

  if (!specimenIds || specimenIds.length == 0) {
    return res.status(200).json({ specimen_ids: [] })
  }

  const remapTargetSpecimenIds = Object.values(remappedSpecimenIds).map((id) =>
    parseInt(id)
  )

  for (const [source, target] of Object.entries(remappedSpecimenIds)) {
    // Ensure that we are not remapping to the same specimen.
    if (source == target) {
      return res.status(400).json({
        message: 'Cannot remap to the same specimen',
      })
    }

    // Ensure that the specimens that we plan to remap are in the list of
    // specimens that we will delete.
    if (!specimenIds.includes(parseInt(source))) {
      return res.status(400).json({
        message: 'Remap contains specimen that is not specified in deletion',
      })
    }

    // Ensure that the specimen ids that we are remapping to are not in the list
    // of specimens that we will soon delete.
    if (specimenIds.includes(target)) {
      return res.status(400).json({
        message: 'Remapped specimen contains to-be deleted specimen',
      })
    }
  }

  // Ensure that all of the deleted specimen and the ones that will be remapped are
  // within the same project.
  const allSpecimenIds = Array.from(
    new Set([...specimenIds, ...remapTargetSpecimenIds])
  )
  const isSpecimensInProject = await specimenService.isSpecimensInProject(
    allSpecimenIds,
    projectId
  )
  if (!isSpecimensInProject) {
    return res.status(400).json({
      message: 'Not all specimens are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    const referenceMapper = new ModelRefencialMapper(
      ModelReferencialConfig.SPECIMEN,
      transaction,
      req.user
    )
    await referenceMapper.moveReferences(
      new Map(Object.entries(remappedSpecimenIds))
    )

    await models.Specimen.destroy({
      where: {
        specimen_id: specimenIds,
        project_id: projectId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ specimen_ids: specimenIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: 'Error deleting specimen' })
    console.log('Error deleting specimens', e)
  }
}

export async function getUsage(req, res) {
  const specimenIds = req.body.specimen_ids
  const referenceMapper = new ModelRefencialMapper(
    ModelReferencialConfig.SPECIMEN
  )

  const usages = await referenceMapper.getUsageCount(specimenIds)
  res.status(200).json({
    usages: usages,
  })
}

export async function search(req, res) {
  // TODO(kenzley): Implement a real search instead of a random selection.
  const projectId = req.project.project_id
  const specimens = await specimenService.getProjectSpecimens(projectId)
  const specimenIds = specimens
    .map((s) => s.specimen_id)
    .sort(() => 0.5 - Math.random())
    .splice(0, 15)
  res.status(200).json({
    results: specimenIds,
  })
}

export async function editSpecimen(req, res) {
  const projectId = req.project.project_id
  const specimenId = req.params.specimenId
  const specimen = await models.Specimen.findByPk(specimenId)
  if (specimen == null || specimen.project_id != projectId) {
    res.status(404).json({ message: 'Specimen is not found' })
    return
  }

  const values = req.body.specimen
  for (const column in values) {
    specimen.set(column, values[column])
  }

  const taxonId = req.body.specimen.taxon_id
  if (taxonId) {
    const specimenIds = await getSpecimenIdsWithDuplicateTaxonId(
      specimen,
      taxonId
    )
    if (specimenIds.length > 0 && specimenIds.some((id) => id != specimenId)) {
      res
        .status(403)
        .json({ message: 'Specimen already exists', specimen_ids: specimenIds })
      return
    }
  }
  try {
    const transaction = await sequelizeConn.transaction()
    if (taxonId) {
      const taxaSpecimen = await models.TaxaXSpecimen.findAll({
        where: { specimen_id: specimenId },
      })
      let shouldCreateLink = true
      for (const link of taxaSpecimen) {
        if (link.specimen_id == specimenId) {
          shouldCreateLink = false
        } else {
          await link.destroy({ user: req.user, transaction: transaction })
        }
      }
      if (shouldCreateLink) {
        await models.TaxaXSpecimen.create(
          {
            specimen_id: specimenId,
            taxon_id: taxonId,
            user_id: req.user.user_id,
            notes: '',
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )
      }
    }

    await specimen.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update specimen with server error' })
    return
  }

  res.status(200).json({
    specimen: convertSpecimenResponse(specimen, taxonId),
  })
}

export async function getCitations(req, res) {
  const projectId = req.project.project_id
  const specimenId = req.params.specimenId
  const citations = await specimenService.getSpecimenCitations(
    projectId,
    specimenId
  )
  res.status(200).json({
    citations,
  })
}

export async function createCitation(req, res) {
  const projectId = req.project.project_id
  const specimenId = req.params.specimenId

  const specimen = await models.Specimen.findByPk(specimenId)
  if (specimen == null) {
    res.status(404).json({ message: 'Unable to find specimen' })
    return
  }

  if (specimen.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Specimen is not assoicated with this project' })
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
      .json({ message: 'Bibliography is not assoicated with this project' })
    return
  }

  // Check for duplicate citation
  const existingCitation = await models.SpecimensXBibliographicReference.findOne({
    where: {
      specimen_id: specimen.specimen_id,
      reference_id: bibliography.reference_id
    }
  })

  if (existingCitation) {
    res.status(400).json({ message: 'This citation already exists' })
    return
  }

  const citation = models.SpecimensXBibliographicReference.build(values)
  citation.set({
    specimen_id: specimen.specimen_id,
    reference_id: bibliography.reference_id,
    user_id: req.user.user_id,
  })

  try {
    const transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create citation with server error' })
    return
  }

  res.status(200).json({ citation })
}

export async function editCitation(req, res) {
  const projectId = req.project.project_id
  const specimenId = req.params.specimenId
  const citationId = req.params.citationId

  const specimen = await models.Specimen.findByPk(specimenId)
  if (specimen == null) {
    res.status(404).json({ message: 'Unable to find specimen' })
    return
  }

  if (specimen.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Specimen is not assoicated with this project' })
    return
  }

  const citation = await models.SpecimensXBibliographicReference.findByPk(
    citationId
  )
  if (citation == null || citation.specimen_id != specimenId) {
    res.status(404).json({ message: 'Unable to find citation' })
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
      .json({ message: 'Bibliography is not assoicated with this project' })
    return
  }

  for (const key in values) {
    citation.set(key, values[key])
  }
  try {
    const transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create citation with server error' })
    return
  }

  res.status(200).json({ citation })
}

export async function deleteCitations(req, res) {
  const projectId = req.project.project_id
  const specimenId = req.params.specimenId
  const citationIds = req.body.citation_ids

  const inProject = await specimenService.isSpecimenCitationsInProject(
    projectId,
    specimenId,
    citationIds
  )
  if (!inProject) {
    return res.status(400).json({
      message: 'Not all specimens are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    await models.SpecimensXBibliographicReference.destroy({
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
    res.status(200).json({ message: "Error deleting specimen's citations" })
    console.log('Error deleting citations', e)
  }
}

async function getSpecimenIdsWithDuplicateTaxonId(specimen, taxonId) {
  if (specimen.reference_code) {
    return await specimenService.getVoucheredSpecimen(taxonId)
  } else {
    return await specimenService.getUnvoucheredSpecimen(
      taxonId,
      specimen.institution_code,
      specimen.collection_code,
      specimen.catalog_number
    )
  }
}

function convertSpecimenResponse(specimen, taxonId) {
  return {
    specimen_id: parseInt(specimen.specimen_id) ?? undefined,
    taxon_id: parseInt(taxonId) ?? undefined,
    user_id: specimen.user_id,
    access: specimen.access,
    created_on: specimen.created_on,
    last_modified_on: specimen.last_modified_on,
    description: specimen.description,
    institution_code: specimen.institution_code,
    collection_code: specimen.collection_code,
    catalog_number: specimen.catalog_number,
    reference_source: parseInt(specimen.reference_source),
    uuid: specimen.uuid,
    occurrence_id: specimen.occurrence_id,
  }
}
