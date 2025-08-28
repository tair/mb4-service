import fs from 'fs/promises'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as mediaService from '../services/media-service.js'
import * as taxaService from '../services/taxa-service.js'
import * as specimenService from '../services/specimen-service.js'
import { EolMediaFetcher } from '../lib/eol-media-fetcher.js'
import { S3MediaUploader } from '../lib/s3-media-uploader.js'
import { downloadUrl } from '../util/url.js'
import { time } from '../util/util.js'

export async function getEolInfo(req, res) {
  const projectId = req.params.projectId
  const eolInfo = await taxaService.getEolInfo(projectId)
  res.status(200).json({ results: eolInfo.map((i) => convertEolInfo(i)) })
}

export async function fetchMedia(req, res) {
  try {
    const projectId = req.params.projectId
    const taxonIds = req.body.taxon_ids
    const size = req.body.size ?? 1
    if (!taxonIds || taxonIds.length == 0) {
      res.status(400).json({ message: 'You must defined taxa to fetch' })
      return
    }

    const taxonNames = await taxaService.getTaxonName(taxonIds)
    if (taxonNames.length == 0) {
      res.status(400).json({ message: 'The taxa no longer exists' })
      return
    }

    const fetcher = new EolMediaFetcher()
    const mediaInfoPromiseMap = fetcher.fetchTaxa(taxonNames, size)

    const eolIds = new Set(await mediaService.getEolIds(projectId))

    const taxa = await models.Taxon.findAll({
      where: {
        taxon_id: taxonIds,
      },
    })
    if (taxa.length != taxonIds.length) {
      res.status(400).json({ message: 'Taxa is not found' })
      return
    }

    const resultMap = new Map()
    const taxaMap = new Map()
    for (const taxon of taxa) {
      const taxonId = taxon.taxon_id
      taxaMap.set(taxonId, taxon)
      resultMap.set(taxonId, {
        taxon_id: taxonId,
        media: [],
      })
    }

    const transaction = await sequelizeConn.transaction()
    for await (const [taxonId, mediaInfoPromise] of mediaInfoPromiseMap) {
      const mediaInfo = await mediaInfoPromise
      const taxon = taxaMap.get(taxonId)
      const result = resultMap.get(taxonId)
      if (mediaInfo.success) {
        result.link = mediaInfo.link
        for (const info of mediaInfo.results) {
          result.media.push({
            id: info.eol_id,
            url: info.tmp_media_url,
            imported: eolIds.has(info.eol_id),
            copyright_info: info.tmp_media_copyright_info,
            copyright_permission: info.tmp_media_copyright_permission,
            copyright_license: info.tmp_media_copyright_license,
          })
        }
        taxon.tmp_more_info_link = mediaInfo.link
        taxon.eol_no_results_on = null
        taxon.eol_pulled_on = time()
      } else {
        result.retry = mediaInfo.retry
        result.error = mediaInfo.error
        result.errorType = mediaInfo.errorType
        
        // Only mark as "no results" if it's a legitimate no-media situation, not a timeout/network error
        if (mediaInfo.retry === false && (mediaInfo.errorType === 'no_results' || mediaInfo.errorType === 'no_media')) {
          taxon.eol_no_results_on = time()
        }
        // For timeout/network errors (retry=true), don't mark as no_results so user can try again
        // This ensures taxa remain available for retry after timeouts or network issues
      }

      await taxon.save({
        transaction,
        user: req.user,
      })
    }

    await transaction.commit()
    res.status(200).json({
      results: [...resultMap.values()],
    })
  } catch (e) {
    console.error(e)
    res
      .status(500)
      .json({ message: 'Failed to update taxon with server error' })
  }
}

export async function importMedia(req, res) {
  const projectId = req.params.projectId
  const userId = req.user.user_id
  const imports = req.body.imports ?? []
  const taxonIds = imports.map((i) => parseInt(i.taxon_id))
  const urls = new Map(
    imports.flatMap((i) => i.media).map((m) => [m.id, m.url])
  )

  if (taxonIds.length == 0) {
    res
      .status(200)
      .json({ success: false, message: 'You must select media to import' })
    return
  }

  // Asynchronously download the URLs to temporary files and upload to S3 so that we can
  // incrementally add images to the database without waiting for the entire
  // set of files to download and process.
  const files = new Map()
  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  try {
    for (const [id, url] of urls) {
      files.set(id, downloadUrl(url).catch(error => {
        console.error(`Failed to download media from URL ${url}:`, error)
        return { error: `Failed to download media: ${error}`, failed: true }
      }))
    }
    const taxa = await models.Taxon.findAll({
      where: {
        taxon_id: taxonIds,
      },
    })
    const taxaMap = new Map()
    for (const taxon of taxa) {
      taxaMap.set(taxon.taxon_id, taxon)
    }

    const specimenIdsMap =
      await specimenService.getVoucheredSpecimenIdByTaxaIds(projectId, taxonIds)

    for (const i of imports) {
      const taxonId = i.taxon_id
      const link = i.link
      const taxon = taxaMap.get(taxonId)

      // Create an Unvouchered specimen to the taxa if it doesn't exist.
      if (!specimenIdsMap.has(taxonId)) {
        const specimen = await models.Specimen.create(
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
            taxon_id: taxonId,
            specimen_id: specimen.specimen_id,
            user_id: userId,
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        specimenIdsMap.set(taxonId, specimen.specimen_id)
      }

      const specimenId = specimenIdsMap.get(taxonId)

      for (const item of i.media) {
        const id = item.id
        const media = await models.MediaFile.create(
          {
            user_id: userId,
            specimen_id: specimenId,
            project_id: projectId,
            notes: `Loaded from EOL.org: ${link}`,
            published: 0,
            access: 0,
            cataloguing_status: 1,
            is_copyrighted: 1,
            copyright_permission: item.copyright_permission,
            copyright_license: item.copyright_license,
            copyright_info: item.copyright_info?.name,
            eol_id: item.id,
            media_type: 'image',
            url: urls.get(id),
            url_description: 'Automatically pulled from EOL.org API',
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        const file = await files.get(id)
        if (file.failed) {
          console.error(`Skipping failed media file ${id} from ${link}: ${file.error}`)
          // Delete the media record since we can't process the file
          await media.destroy({ transaction, user: req.user })
          continue
        }
        
        try {
          await mediaUploader.setMedia(media, 'media', file)
        } catch (uploadError) {
          console.error(`Failed to upload media file ${id} from ${link}:`, uploadError.message)
          // Delete the media record since upload failed
          await media.destroy({ transaction, user: req.user })
          continue
        }
        await media.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        if (item.should_add_as_exemplar) {
          await models.TaxaXMedium.create(
            {
              user_id: userId,
              taxon_id: taxonId,
              media_id: media.media_id,
            },
            {
              user: req.user,
              transaction: transaction,
            }
          )
        }
      }

      taxon.eol_set_on = time()
      await taxon.save({
        user: req.user,
        transaction: transaction,
      })
    }

    await transaction.commit()
    mediaUploader.commit()
    res.status(200).json({ success: true })
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    console.error('Failed to import media', e)
    res.status(200).json({ success: false, message: e.message })
  } finally {
    for await (const filePromise of files.values()) {
      try {
        const file = await filePromise
        if (file.failed) {
          // Skip cleanup for files that failed to download
          continue
        }
        await fs.unlink(file.path)
      } catch (error) {
        // Skip cleanup for files that failed to download or delete
        console.warn('Skipping cleanup for failed file:', error.message)
      }
    }
  }
}

function convertEolInfo(eolInfo) {
  return {
    taxon_id: eolInfo.taxon_id,
    no_results_on: eolInfo.eol_no_results_on || null,
    pulled_on: eolInfo.eol_pulled_on || null,
    set_on: eolInfo.eol_set_on || null,
  }
}
