import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

import * as taxaService from '../services/taxa-service.js'
import * as specimenService from '../services/specimen-service.js'
import { EolMediaFetcher } from '../lib/eol-media-fetcher.js'
import { time } from '../util/util.js'

export async function getiDigBioInfo(req, res) {
  const projectId = req.params.projectId
  const info = await taxaService.getiDigBioInfo(projectId)
  res.status(200).json({ results: info.map( i => convertInfo(i)) })
}

export async function fetchiDigBioImages(req, res) {
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
    const fetcher = new iDigBioMediaFetcher()
    const mediaInfoPromiseMap = fetcher.fetchTaxa(taxonNames)

    const resultMap = new Map()
    const taxa = new Map()
    for (const taxonId of taxonIds) {
      const taxon = await models.Taxon.findByPk(taxonId)
      if (taxon == null || taxon.project_id != projectId) {
        res.status(400).json({ message: 'Taxon is not found' })
        return
      }

      taxa.set(taxonId, taxon)
      resultMap.set(taxonId, {
        taxonId: taxonId,
        media: []
      })
    }

    const transaction = await sequelizeConn.transaction()
    for await (const [taxonId, mediaInfoPromise] of mediaInfoPromiseMap) {
      const mediaInfo = await mediaInfoPromise
      const taxon = taxa.get(taxonId)
      const result = resultMap.get(taxonId)
      if (mediaInfo.success) {
        result.link = mediaInfo.link
        for (const info of mediaInfo.results) {
          result.media.push({
            url: info.media_url,
            copyright_info: null,
            copyright_permission: null,
            copyright_license: null,
          })
        }
        taxon.tmp_more_info_link = mediaInfo.link
        taxon.idigbio_no_results_on = null
        taxon.idigbio_pulled_on = time()
        taxon.tmp_idigbio_data = mediaInfo.results ?? null
      } else {
        result.retry = mediaInfo.retry
        taxon.idigbio_no_results_on = time()
      }

      await taxon.save({
        transaction,
        user: req.user,
      })
    }

    await transaction.commit()
    res.status(200).json({
      results: [...resultMap.values()]
    })
    res.status(200).json({ results: [] })
  } catch(e) {
    console.error(e)
    res
      .status(500)
      .json({ message: 'Failed to update taxon with server error' })
  }
}

function convertInfo(info) {
  return {
    taxon_id: info.taxon_id,
    no_results_on: info.idigbio_no_results_on || undefined,
    pulled_on: info.idigbio_pulled_on|| undefined,
    set_on: info.idigbio_set_on|| undefined,
  }
}