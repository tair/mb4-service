import { fetchWithRetry } from '../util/url.js'
import { getCopyrightInfo } from './eol-media-fetcher.js'

export class iDigBioMediaFetcher {
  fetchTaxa(taxa, size = 1) {
    const results = new Map()
    for (const taxon of taxa) {
      results.set(taxon.taxon_id, fetchiDigBioImagesForTaxonName(taxon, size))
    }
    return results
  }

  getSpecimenInfoBySpecimenUUID(specimenUUIDs) {
    const results = new Map()
    for (const specimenUUID of specimenUUIDs) {
      results.set(specimenUUID, getSpecimenInfo({ uuid: specimenUUID }))
    }
    return results
  }
}

async function fetchiDigBioImagesForTaxonName(taxon, size = 1) {
  const taxonSearchParams = {}
  if (taxon.genus) {
    taxonSearchParams['genus'] = taxon.genus.trim()
  }
  if (taxon.specific_epithet) {
    taxonSearchParams['specificepithet'] = taxon.specific_epithet.trim()
  }

  if (Object.keys(taxonSearchParams).length == 0) {
    return {
      success: false,
    }
  }

  const params = {
    rq: JSON.stringify(taxonSearchParams),
    limit: size,
  }

  try {
    const response = await fetchWithRetry(
      'https://search.idigbio.org/v2/search/media/',
      {
        params,
      }
    )
    if (response.status != 200) {
      return {
        success: false,
        retry: true,
        error: `Search failed with HTTP status: ${response.status}`,
      }
    }

    const items = response.data?.items
    if (items == null || !Array.isArray(items) || items.length == 0) {
      return {
        success: false,
        error: 'No results found on iDigBio.org for this taxon',
      }
    }

    const attributions = new Map()
    if (
      response.data?.attribution &&
      Array.isArray(response.data.attribution)
    ) {
      for (const attribution of response.data.attribution) {
        const uuid = attribution.uuid
        attributions.set(uuid, {
          uuid,
          name: attribution.name,
          description: attribution.description,
          url: attribution.url,
          data_rights: attribution.data_rights,
        })
      }
    }

    const results = []
    for (const item of items) {
      if (item.indexTerms.format != 'image/jpeg') {
        continue
      }
      const imageLicense = getLicenceLink(item, attributions)
      const imageRightsHolder = getImageRightsHolder(item, attributions)
      const [mediaCopyrightPermission, mediaCopyrightLicense] =
        getCopyrightInfo(imageLicense)
      const imageUrl = IMAGE_URL_PATH + item.uuid

      const attributionId = item['indexTerms']['recordset']
      const attribution = attributions.get(attributionId)

      let source = undefined
      if (attribution) {
        if (attribution.name) {
          source = {
            name: attribution.name,
          }
          if (attribution.url) {
            source.url = attribution.url
          }
        }
      }

      let specimenUUID = undefined
      if (item.indexTerms?.records && Array.isArray(item.indexTerms?.records)) {
        specimenUUID = item.indexTerms.records[0]
      }

      let taxonomyName = undefined
      if (specimenUUID != null) {
        const specimenResults = await getSpecimenInfo({ uuid: specimenUUID })
        if (specimenResults.success && Array.isArray(specimenResults.items)) {
          const specimenInfo = specimenResults.items[0]
          const term = specimenInfo['indexTerms']
          taxonomyName = `${term.genus} ${term.specificepithet} ${term.infraspecificepithet}`
        }
      }

      // TODO(kenzley): The keys are named this way to retain parity with V3 once we have
      //     migrated completely off V3 onto V4. We should remove these fields and consider
      //     creating a new JSON column with similar column names.
      results.push({
        idigbio_uuid: item.uuid,
        source: source,
        idigbio_taxonomy: taxonomyName,
        idigbio_specimen_uuid: specimenUUID,
        link: LINK_URL_PATH + item.uuid,
        tmp_media_url: imageUrl,
        tmp_media_copyright_info: imageRightsHolder,
        tmp_media_copyright_permission: mediaCopyrightPermission,
        tmp_media_copyright_license: mediaCopyrightLicense,
      })
    }

    return {
      success: true,
      results: results,
    }
  } catch (e) {
    return {
      success: false,
      retry: true,
      error: e.message,
    }
  }
}

async function getSpecimenInfo(parameters) {
  const query = JSON.stringify(parameters)
  try {
    const response = await fetchWithRetry(
      'https://search.idigbio.org/v2/search/records/',
      {
        rq: query,
        limit: 50,
      }
    )
    if (response.status != 200) {
      return {
        success: false,
        retry: true,
        error: `Search failed with HTTP status: ${response.status}`,
      }
    }
    return {
      success: true,
      items: response.data.items,
    }
  } catch (e) {
    console.error('Failed to fech specimen:', e)
    return {
      success: false,
      retry: true,
      error: e.message,
    }
  }
}

function getLicenceLink(item, attributions) {
  if (item.data['dcterms:rights']) {
    return item.data['dcterms:rights']
  }

  if (item.data['dc:rights']) {
    return item.data['dc:rights']
  }

  if (item.data['dcterms:license']) {
    return item.data['dcterms:license']
  }

  if (item.attribution['data_rights']) {
    return item.attribution['data_rights']
  }

  if (item.indexTerms['rights']) {
    return item.indexTerms['rights']
  }

  const attributionId = item['indexTerms']['recordset']
  const attribution = attributions.get(attributionId)
  if (attribution?.data_rights) {
    return attribution.data_rights
  }

  return ''
}

function getImageRightsHolder(item, attributions) {
  if (item.data['dcterms:rightsHolder']) {
    return item.data['dcterms:rightsHolder']
  }

  if (item.data['ac:providerLiteral']) {
    return item.data['ac:providerLiteral']
  }

  if (item.data['dc:source']) {
    return item.data['dc:source']
  }

  if (item.data['dc:creator']) {
    return item.data['dc:creator']
  }

  if (item.data['dcterms:creator']) {
    return item.data['dcterms:creator']
  }

  const attributionId = item['indexTerms']['recordset']
  const attribution = attributions.get(attributionId)
  if (attribution?.name) {
    return attribution.name
  }

  return undefined
}

const LINK_URL_PATH = 'https://www.idigbio.org/portal/mediarecords/'
const IMAGE_URL_PATH = 'https://api.idigbio.org/v2/media/'
