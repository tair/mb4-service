import fs from 'fs/promises'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as mediaService from '../services/media-service.js'
import * as taxaService from '../services/taxa-service.js'
import * as specimenService from '../services/specimen-service.js'
import { iDigBioMediaFetcher } from '../lib/idigbio-media-fetcher.js'
import { MediaUploader } from '../lib/media-uploader.js'
import { downloadUrl } from '../util/url.js'
import { time } from '../util/util.js'
import { normalize } from '../util/string.js'

export async function getiDigBioInfo(req, res) {
  const projectId = req.params.projectId
  const info = await taxaService.getiDigBioInfo(projectId)
  res.status(200).json({ results: info.map((i) => convertInfo(i)) })
}

export async function fetchMedia(req, res) {
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

    const uuids = new Set(await mediaService.getUUIDs(projectId))

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
        for (const info of mediaInfo.results) {
          result.media.push({
            id: info.idigbio_uuid,
            url: info.tmp_media_url,
            imported: uuids.has(info.idigbio_uuid),
            specimen_uuid: info.idigbio_specimen_uuid,
            taxonomy: info.idigbio_taxonomy,
            source: info.source,
            link: info.link,
            copyright_info: info.tmp_media_copyright_info,
            copyright_permission: info.tmp_media_copyright_permission,
            copyright_license: info.tmp_media_copyright_license,
          })
        }

        taxon.idigbio_no_results_on = null
        taxon.idigbio_pulled_on = time()
      } else {
        taxon.idigbio_no_results_on = time()
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

  if (taxonIds.length == 0) {
    res
      .status(200)
      .json({ success: false, message: 'You must select media to import' })
    return
  }

  const urls = new Map(
    imports.flatMap((i) => i.media).map((m) => [m.id, m.url])
  )

  const specimenUUIDs = imports
    .flatMap((i) => i.media)
    .map((m) => m?.specimen_uuid)
    .filter((x) => !!x)

  const fetcher = new iDigBioMediaFetcher()
  const specimentInfoPromiseMap =
    fetcher.getSpecimenInfoBySpecimenUUID(specimenUUIDs)

  // Asynchronously download the URLs to the local file system so that we can
  // incremently add images to the database without waiting for the entire
  // set of files to download.
  const files = new Map()
  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new MediaUploader(transaction, req.user)
  try {
    for (const [id, url] of urls) {
      files.set(id, downloadUrl(url))
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

    const currentTime = time()
    const specimenIdsMap =
      await specimenService.getVoucheredSpecimenIdByTaxaIds(projectId, taxonIds)

    for (const i of imports) {
      for (const item of i.media) {
        let taxon = taxaMap.get(i.taxon_id)

        const id = item.id
        const link = item.link
        const specimenUUID = item.specimen_uuid

        // Check if iDigBio has specimen information for the image and import it.
        const specimenInfo = await specimentInfoPromiseMap.get(specimenUUID)
        if (
          specimenInfo &&
          specimenInfo.success &&
          specimenInfo.items?.length > 0
        ) {
          const specimenItem = specimenInfo.items[0]
          const terms = specimenItem['indexTerms']
          const specimen = await models.Specimen.create(
            {
              user_id: userId,
              project_id: projectId,
              reference_source: 0,
              access: 0,
              description: `Imported from iDigBio. uuid: ${specimenUUID} Occurrence ID: ${terms['occurrenceid']}; Institution Source: ${item['source']}`,
              institution_code: terms.institutioncode,
              collection_code: terms.collectioncode,
              catalog_number: terms.catalognumber,
              occurrence_id: terms.occurrenceid,
              uuid: specimenUUID,
            },
            {
              user: req.user,
              transaction: transaction,
            }
          )

          // If the iDigBio specimen taxonomy has more information than what is
          // in the MorphoBank taxon record, let's check whether there is a more
          // accurate taxon in the project and if not, let's make a new record
          // so that we don't modify existing records created by the user.
          if (!isTaxonEqualTerms(taxon, terms)) {
            taxon = await models.Taxon.findOne({
              where: {
                project_id: projectId,
                genus: terms.genus,
                specific_epithet: terms.specificepithet,
                subspecific_epithet: terms.infraspecificepithet ?? '',
                higher_taxon_kingdom: terms.kingdom,
                higher_taxon_phylum: terms.phylum,
                higher_taxon_class: terms.class,
                higher_taxon_order: terms.order,
                higher_taxon_family: terms.family,
              },
              transaction: transaction,
            })
            if (taxon == null) {
              taxon = await models.Taxon.create(
                {
                  user_id: userId,
                  project_id: projectId,
                  genus: terms.genus,
                  specific_epithet: terms.specificepithet,
                  subspecific_epithet: terms.infraspecificepithet,
                  higher_taxon_kingdom: terms.kingdom,
                  higher_taxon_phylum: terms.phylum,
                  higher_taxon_class: terms.class,
                  higher_taxon_order: terms.order,
                  higher_taxon_family: terms.family,
                  notes: `Imported from iDigBio. specimen uuid: ${specimenUUID}`,
                },
                {
                  user: req.user,
                  transaction: transaction,
                }
              )
            }
          }
          specimenIdsMap.set(taxon.taxon_id, specimen.specimen_id)
        } else if (!specimenIdsMap.has(taxon.taxon_id)) {
          const specimen = await models.Specimen.create(
            {
              user_id: userId,
              project_id: projectId,
              reference_source: 1,
              access: 0,
              description:
                'Automatically created while pulling taxon media from iDigBio.org API',
            },
            {
              user: req.user,
              transaction: transaction,
            }
          )

          specimenIdsMap.set(taxon.taxon_id, specimen.specimen_id)
        }

        const specimenId = specimenIdsMap.get(taxon.taxon_id)
        await models.TaxaXSpecimen.create(
          {
            taxon_id: taxon.taxon_id,
            specimen_id: specimenId,
            user_id: userId,
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        const media = await models.MediaFile.create(
          {
            user_id: userId,
            specimen_id: specimenId,
            project_id: projectId,
            notes: `Loaded from iDigBio.org: ${link}`,
            published: 0,
            access: 0,
            cataloguing_status: 1,
            url: link,
            url_description: `Automatically pulled from iDigBio.org API. UUID: ${id}`,
            is_copyrighted: 1,
            copyright_permission: item.copyright_permission,
            copyright_license: item.copyright_license,
            copyright_info: item.copyright_info?.name,
            uuid: id,
            media_type: 'image',
          },
          {
            user: req.user,
            transaction: transaction,
          }
        )

        const file = await files.get(id)
        await mediaUploader.setMedia(media, 'media', file)
        await media.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        if (item.should_add_as_exemplar) {
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
        }
      }

      let taxon = taxaMap.get(i.taxon_id)
      taxon.idigbio_set_on = currentTime
      await taxon.save({
        user: req.user,
        transaction: transaction,
      })
    }

    await transaction.commit()
    res.status(200).json({ success: true })
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    console.error('Failed to import media', e)
    res.status(200).json({ success: false, message: e.message })
  } finally {
    for await (const file of files.values()) {
      fs.unlink(file.path)
    }
  }
}

function convertInfo(info) {
  return {
    taxon_id: info.taxon_id,
    no_results_on: info.idigbio_no_results_on || undefined,
    pulled_on: info.idigbio_pulled_on || undefined,
    set_on: info.idigbio_set_on || undefined,
  }
}

function isTaxonEqualTerms(taxon, terms) {
  return (
    terms.genus &&
    terms.specificepithet &&
    normalize(taxon.genus) == normalize(terms.genus) &&
    normalize(taxon.specific_epithet) == normalize(terms.specificepithet) &&
    normalize(taxon.subspecific_epithet) ==
      normalize(terms.infraspecificepithet)
  )
}
