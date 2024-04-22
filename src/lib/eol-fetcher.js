import axios from 'axios'

export class EolFetcher {
  constructor() {}

  fetchTaxa(taxa) {
    const results = new Map()
    for (const taxon of taxa) {
      const taxonName = `${taxon.genus} ${taxon.specific_epithet}`.trim()
      if (!taxonName) {
        continue
      }
      try {
        results.set(taxon.taxon_id, fetchEolImagesForTaxonName(taxonName))
      } catch (e) {
        results.set(taxon.taxon_id, {
          success: false,
          retry: true,
        })
      }
    }
    return results
  }
}

async function fetchEolImagesForTaxonName(taxonName) {
  const params = {
    q: taxonName,
    page: 1,
    exact: 'false',
  }

  const response = await getRequest('http://eol.org/api/search/1.0.json', {
    params,
  })
  if (response.status != 200) {
    return {
      success: false,
      retry: true,
    }
  }

  const results = response.data?.results
  if (results == null || !Array.isArray(results) || results.length == 0) {
    return { success: false }
  }

  for (const result of results) {
    const id = result.id
    const imageResults = await getImagesFromLink(id)
    if (imageResults.length > 0) {
      return imageResults
    }
  }
  return { success: true }
}

async function getImagesFromLink(id) {
  const params = {
    images_per_page: 1,
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
  const response = await getRequest(`http://eol.org/api/pages/1.0/${id}.json`, {
    params,
  })
  if (response.status != 200) {
    return {
      success: false,
      retry: true,
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

    let imageRightsHolder = ''
    const imageUrl = dataObject.eolMediaURL
    if (dataObject.rightsHolder) {
      imageRightsHolder = dataObject.rightsHolder
    } else if (Array.isArray(dataObject.agents)) {
      for (const agent of dataObject.agents) {
        switch (agent.role) {
          case 'photographer':
          case 'creator':
            if (agent.homepage) {
              imageRightsHolder += `<a href='${agent.homepage}' target='_blank'>`
            }
            imageRightsHolder += agent.full_name
            if (agent.homepage) {
              imageRightsHolder += '</a>'
            }
            break
        }
      }
    }

    let mediaCopyrightPermission = undefined
    let mediaCopyrightLicense = undefined
    const imageLicenseLink = dataObject.license?.toLowerCase()
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
      } else {
        mediaCopyrightLicense = 8
      }
    }

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

/**
 * The EOL service is very brittle and it will return a 502 at times. We will retry
 * three times with an exponential delay to ensure that we get a response from EOL.
 */
function getRequest(options, params) {
  let retries = 0
  let sendDelay = 1000
  const maxRetries = 3
  return new Promise((resolve, reject) => {
    const fetch = async () => {
      try {
        const response = await axios(options, params)
        resolve(response)
        return
      } catch (err) {
        if (err.response.status >= 500 && ++retries < maxRetries) {
          setTimeout(() => fetch(), sendDelay)
          sendDelay = Math.min(20_000, sendDelay << 1)
        } else {
          reject(err)
        }
      }
    }

    fetch()
  })
}
