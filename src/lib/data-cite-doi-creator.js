import config from '../config.js'
import https from 'node:https'
import { Buffer } from 'node:buffer'

export class DataCiteDOICreator {
  constructor() {
    verifyDataciteConfiguration()

    console.log('DataCiteDOICreator: Initializing with config:', {
      hostname: config.datacite.hostname,
      urlPath: config.datacite.urlPath,
      shoulder: config.datacite.shoulder,
      username: config.datacite.username,
      password: config.datacite.password ? '[SET]' : '[NOT SET]',
    })

    const bearer = `${config.datacite.username}:${config.datacite.password}`
    this.authorizationToken = `Basic ${Buffer.from(bearer).toString('base64')}`
    this.hostname = config.datacite.hostname
    this.urlPath = config.datacite.urlPath
    this.shoulder = config.datacite.shoulder
  }

  async create(parameter) {
    const content = this.generateJSON(parameter, { isUpdate: false })
    return this._sendDoiMutation('POST', this.urlPath, content, parameter.id)
  }

  /**
   * Update an existing DOI in DataCite (metadata refresh). Same path pattern as
   * {@link exists} / MDS: `/dois/{shoulder}/{suffix}`.
   */
  async update(parameter) {
    const content = this.generateJSON(parameter, { isUpdate: true })
    const path = `${this.urlPath}/${this.shoulder}/${parameter.id}`
    return this._sendDoiMutation('PUT', path, content, parameter.id)
  }

  _sendDoiMutation(method, path, content, idSuffix) {
    const fullDoi = `${this.shoulder}/${idSuffix}`
    const options = {
      host: this.hostname,
      path,
      method,
      headers: {
        Authorization: this.authorizationToken,
        'Content-type': 'application/vnd.api+json',
      },
    }
    return this._doJsonRequest(options, content, fullDoi)
  }

  async _doJsonRequest(options, content, fullDoi) {
    try {
      const response = await performRequest(options, content)
      const success = response.status < 300
      if (success) {
        return { success: true, doi: fullDoi }
      } else {
        console.error(
          'DataCiteDOICreator: Request failed with error:',
          response.data
        )
        return { success: false, doi: null }
      }
    } catch (error) {
      console.error('DataCiteDOICreator: Request failed with error:', error)
      throw error
    }
  }

  async exists(doi) {
    const options = {
      host: this.hostname,
      path: `${this.urlPath}/${this.shoulder}/${doi}`,
      method: 'GET',
      headers: {
        Authorization: this.authorizationToken,
      },
    }

    try {
      const response = await performRequest(options)
      return response.status < 300
    } catch (error) {
      console.error(
        'DataCiteDOICreator: Exists check failed with error:',
        error
      )
      return false
    }
  }

  generateJSON(parameter, options) {
    const { isUpdate = false } = options || {}
    const date = new Date()
    const doi = `${this.shoulder}/${parameter.id}`
    // DataCite only allows event: publish | register | hide. There is no "update".
    // For metadata refresh (PUT), omit event; for new DOIs, publish to register as findable.
    const attributes = {
      doi: doi,
      created: date.toISOString(), // E.g: "2016-09-19T21:53:56.000Z";
      publisher: 'MorphoBank',
      publicationYear: date.getFullYear(),
      titles: [
        {
          title: parameter.title,
        },
      ],
      types: {
        resourceTypeGeneral: 'Dataset',
      },
      url: parameter.resource,
      schemaVersion: 'http://datacite.org/schema/kernel-4',
    }
    if (!isUpdate) {
      attributes.event = 'publish'
    }
    const json = {
      data: {
        id: doi,
        type: 'dois',
        attributes,
      },
    }

    if (Array.isArray(parameter.authors) && parameter.authors.length > 0) {
      json.data.attributes.creators = []
      for (const author of parameter.authors) {
        // Support both plain strings and {name, orcid} objects
        const name = typeof author === 'string' ? author : author.name
        const orcid = typeof author === 'object' ? author.orcid : null
        const creator = { name }
        if (orcid) {
          creator.nameIdentifiers = [
            {
              nameIdentifier: `https://orcid.org/${orcid}`,
              nameIdentifierScheme: 'ORCID',
              schemeUri: 'https://orcid.org',
            },
          ]
        }
        json.data.attributes.creators.push(creator)
      }
    }

    return JSON.stringify(json)
  }
}

function verifyDataciteConfiguration() {
  if (!config.datacite.username) {
    throw 'No user name defined for DataCite'
  }
  if (!config.datacite.password) {
    throw 'No password defined for DataCite'
  }
  if (!config.datacite.shoulder) {
    throw 'No shoulder defined for DataCite'
  }
  if (!config.datacite.hostname) {
    throw 'No host name defined for DataCite'
  }
  if (!config.datacite.urlPath) {
    throw 'No url path defined for DataCite'
  }
}

function performRequest(options, content = undefined) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (res) => {
      const data = []
      res.on('data', (chunk) => {
        data.push(chunk)
      })

      res.on('close', () => {
        const responseBody = data.join('')

        try {
          const parsedData = responseBody ? JSON.parse(responseBody) : {}
          resolve({
            status: res.statusCode,
            data: parsedData,
          })
        } catch (parseError) {
          console.error(
            'DataCiteDOICreator: Failed to parse response JSON:',
            parseError
          )
          console.error('DataCiteDOICreator: Raw response body:', responseBody)
          resolve({
            status: res.statusCode,
            data: { error: 'Failed to parse response', raw: responseBody },
          })
        }
      })
    })

    if (content) {
      request.write(content)
    }

    request.end()

    request.on('error', (err) => {
      console.error('DataCiteDOICreator: HTTP request error:', err)
      reject(err)
    })
  })
}
