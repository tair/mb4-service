import axios from 'axios'

export class iDigBioMediaFetcher {
  constructor() {}

  fetchTaxa(taxa) {
    const results = new Map()
    for (const taxon of taxa) {
      results.set(taxon.taxon_id, fetchiDigBioImagesForTaxonName(taxon))
    }
    return results
  }

  async fetchiDigBioImagesForTaxonName(taxon) {
    const taxonSearchParams = {}
    if (taxon.genus) {
      taxonSearchParams['genus'] = taxon.genus.trim()
    }
    if (taxon.specific_epithet) {
      taxonSearchParams['specific_epithet'] = taxon.specific_epithet.trim()
    }

    if (Object.keys(taxonSearchParams).length == 0) {
      return {
        success: false,
      }
    }

    const params = {
      rq: taxonSearchParams,
      limit: 1,
    }

    try {
      const response = await getRequest('https://search.idigbio.org/v2/search/media/', {
        params,
      })
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
          success: false
        }
      }

      for (const item of items) {
        const id = result.id
        const imageResults = await getImagesFromLink(id)
        if (imageResults.success && imageResults.results?.length > 0) {
          return {
            link: result.link,
            ...imageResults,
          }
        }
      }

      return {
        success: false
      }
    } catch(e) {
      return {
        success: false,
        retry: true,
        error: e.message
      }
    }
  }
}

/**
 * The external service is very brittle and it will return a 502 at times. We will retry
 * three times with an exponential delay to ensure that we get a response.
 */
function getRequest(options, params) {
  let retries = 0
  let sendDelay = 1000
  const maxRetries = 3
  return new Promise((resolve, reject) => {
    const fetch = async () => {
      try {
        const response = await axios(options, params)
        if (response.status >= 500 && ++retries < maxRetries) {
          setTimeout(() => fetch(), sendDelay)
          sendDelay = Math.min(20_000, sendDelay << 1)
        } else {
          resolve(response)
        }
      } catch (err) {
        console.error('Failed to fetch EOL', err)
        reject(err)
      }
    }

    fetch()
  })
}