import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

import * as taxaService from '../services/taxa-service.js'
import * as specimenService from '../services/specimen-service.js'
import { EolFetcher } from '../lib/eol-fetcher.js'
import { time } from '../util/util.js'

export async function getEolInfo(req, res) {
  const projectId = req.params.projectId
  const eolInfo = await taxaService.getEolInfo(projectId)
  res.status(200).json({ eol: eolInfo })
}

export async function fetchEolImages(req, res) {
  try {
    const projectId = req.params.projectId
    const taxonIds = req.body.taxon_ids
    if (!taxonIds || taxonIds.length == 0) {
      res.status(400).json({ message: 'You must defined taxa to fetch' })
      return
    }

    const taxonNames = await taxaService.getTaxonName(taxonIds)
    if (taxonNames.length == 0) {
      res.status(400).json({ message: 'The taxa no longer exists' })
      return
    }

    const fetcher = new EolFetcher()
    const mediaInfoPromiseMap = fetcher.fetchTaxa(taxonNames)

    const response = {
      failed: [],
      success: [],
    }
    const transaction = await sequelizeConn.transaction()
    for await (const [taxonId, mediaInfoPromise] of mediaInfoPromiseMap) {
      const mediaInfo = await mediaInfoPromise
      const taxon = await models.Taxon.findByPk(taxonId)
      if (taxon == null || taxon.project_id != projectId) {
        res.status(400).json({ message: 'Taxon is not found' })
        return
      }

      const taxonId = taxon.taxon_id
      if (mediaInfo.success) {
        response.success.push({taxon_id: taxonId, results: mediaInfo.results })

        taxon.eol_no_results_on = null
        taxon.eol_pulled_on = time()
        taxon.tmp_eol_data = mediaInfo.results ?? null
      } else {
        response.failed.push({taxon_id: taxonId, retry: mediaInfo.retry})

        taxon.eol_no_results_on = time()
      }

      await taxon.save({
        transaction,
        user: req.user,
      })
    }

    await transaction.commit()
    res.status(200).json({ taxon_ids: taxonIds })
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update taxon with server error' })
    return
  }
}

export async function importEolImage(req, res) {
  const projectId = req.params.projectId
  const userId = req.user.user_id
  const taxons = req.body.taxons
  const taxonIds = Object.keys(taxons)

  const taxa = models.Taxon.findAll({
    where: {
      taxon_id: taxonIds,
    },
  })

  const specimenIdsMap = await specimenService.getSpecimenIdByTaxaIds(
    projectId,
    taxonIds
  )

  const transaction = await sequelizeConn.transaction()
  for (const taxon of taxa) {
    if (taxon.eol_pulled_on == null) {
      continue
    }

    const eolData = taxon.tmp_eol_data
    if (eolData == null) {
      continue
    }

    const indices = taxons[taxon.taxon_id]
    for (const index in eolData) {
      if (!indices.includes(index)) {
        continue
      }

      const mediaInfo = eolData[index]
      const mediaUrl = mediaInfo.tmp_media_url

      if (!specimenIdsMap.has(taxon.taxon_id)) {
        const specimen = models.Specimen.create(
          {
            user_id: userId,
            project_id: projectId,
            reference_source: 1,
            access: 0,
            description:
              'Automatically created while pulling taxon media from EOL.org API',
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        await models.TaxaXSpecimen.create(
          {
            taxon_id: taxon.taxon_id,
            specimen_id: specimen.specimen_id,
            user_id: userId,
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        specimenIdsMap.set(taxon.taxon_id, specimen.specimen_id)
      }

      const specimenId = specimenIdsMap.get(taxon.taxon_id)
      // TODO(kenzley): Upload the media somehow.
      const media = await models.MediaFile.create(
        {
          media: null,
          user_id: userId,
          specimen_id: specimenId,
          project_id: projectId,
          notes: 'Loaded from Eol.org: ' + taxon.tmp_more_info_link,
          published: 0,
          access: 0,
          cataloguing_status: 1,
          url: mediaUrl,
          url_description: 'Automatically pulled from EOL.org API',
          is_copyrighted: 1,
          copyright_permission: mediaInfo.tmp_media_copyright_permission,
          copyright_license: mediaInfo.tmp_media_copyright_license,
          copyright_info: mediaInfo.tmp_media_copyright_info,
          eol_id: mediaInfo.eol_id,
        },
        {
          user: req.user,
          transaction: transaction,
        }
      )

      await models.TaxaXMedium.create(
        {
          user_id: userId,
          taxon_id: taxon.taxon_id,
          media_id: media.media_id,
        },
        {
          user: req.user,
          transaction: transaction,
        }
      )

      taxon.eol_set_on = time()
      await taxon.save({
        user: req.user,
        transaction: transaction,
      })
    }
  }

  await transaction.commit()
  res.status(200).json({ message: 'Nothing' })
}
