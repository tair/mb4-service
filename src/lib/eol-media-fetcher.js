import { fetchWithRetry } from '../util/url.js'

export class EolMediaFetcher {
  fetchTaxa(taxa, size = 1) {
    const results = new Map()
    for (const taxon of taxa) {
      const taxonName = `${taxon.genus} ${taxon.specific_epithet}`.trim()
      if (!taxonName) {
        continue
      }
      results.set(taxon.taxon_id, fetchEolImagesForTaxonName(taxonName, size))
    }
    return results
  }
}

async function fetchEolImagesForTaxonName(taxonName, size = 1) {
  const params = {
    q: taxonName,
    page: 1,
    exact: 'false',
  }

  try {
    const response = await fetchWithRetry(
      'http://eol.org/api/search/1.0.json',
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

    const results = response.data?.results
    if (results == null || !Array.isArray(results) || results.length == 0) {
      return {
        success: false,
      }
    }

    for (const result of results) {
      const id = result.id
      const imageResults = await getImagesFromLink(id, size)
      if (imageResults.success && imageResults.results?.length > 0) {
        return {
          link: result.link,
          ...imageResults,
        }
      }
    }

    return {
      success: false,
    }
  } catch (e) {
    return {
      success: false,
      retry: true,
      error: e.message,
    }
  }
}

async function getImagesFromLink(id, size) {
  const params = {
    images_per_page: size,
    videos: 0,
    sounds: 0,
    maps: 0,
    text: 0,
    iucn: false,
    subjects: 'overview',
    licenses: 'all',
    details: true,
    common_names: false,
    synonyms: false,
    references: false,
    vetted: 2,
  }
  const response = await fetchWithRetry(
    `http://eol.org/api/pages/1.0/${id}.json`,
    {
      params,
    }
  )
  if (response.status != 200) {
    return {
      success: false,
      retry: true,
      error: `Fetch failed with HTTP status: ${response.status}`,
    }
  }

  const dataObjects = response.data?.taxonConcept?.dataObjects
  if (dataObjects == null || !Array.isArray(dataObjects)) {
    return {
      success: false,
    }
  }

  const results = []
  for (const dataObject of dataObjects) {
    if (dataObject.mimeType != 'image/jpeg') {
      continue
    }

    if (!dataObject.eolMediaURL) {
      continue
    }

    const imageRightsHolder = {}
    const imageUrl = dataObject.eolMediaURL
    if (dataObject.rightsHolder) {
      imageRightsHolder.name = dataObject.rightsHolder
    } else if (Array.isArray(dataObject.agents)) {
      for (const agent of dataObject.agents) {
        switch (agent.role) {
          case 'photographer':
          case 'creator':
            if (agent.homepage) {
              imageRightsHolder.url += `<a href='${agent.homepage}' target='_blank'>`
            }
            imageRightsHolder.name = agent.full_name
            break
        }
      }
    }

    const [mediaCopyrightPermission, mediaCopyrightLicense] = getCopyrightInfo(
      dataObject.license
    )

    // TODO(kenzley): The keys are named this way to retain parity with V3 once we have
    //     migrated completely off V3 onto V4. We should remove these fields and consider
    //     creating a new JSON column with similar column names.
    results.push({
      eol_id: dataObject.identifier,
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
}

export function getCopyrightInfo(license) {
  let mediaCopyrightPermission = undefined
  let mediaCopyrightLicense = undefined
  const imageLicenseLink = license?.toLowerCase()
  if (imageLicenseLink.includes('publicdomain')) {
    mediaCopyrightPermission = 4
  } else {
    mediaCopyrightPermission = 2
    if (imageLicenseLink.includes('by-nc-sa')) {
      mediaCopyrightLicense = 5
    } else if (imageLicenseLink.includes('by-sa')) {
      mediaCopyrightLicense = 4
    } else if (imageLicenseLink.includes('by-nc')) {
      mediaCopyrightLicense = 3
    } else if (imageLicenseLink.includes('by')) {
      mediaCopyrightLicense = 2
    } else if (imageLicenseLink.includes('cc0')) {
      mediaCopyrightLicense = 1
    } else {
      mediaCopyrightLicense = 8
    }
  }
  return [mediaCopyrightPermission, mediaCopyrightLicense]
}
