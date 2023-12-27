import config from '../config.js'
import https from 'node:https'
import { Buffer } from 'node:buffer'

export class DataCiteDOICreator {
  constructor() {
    verifyDataciteConfiguration()
    const bearer = `${config.datacite.username}:${config.datacite.password}`
    this.authorizationToken = `Basic ${Buffer.from(bearer).toString('base64')}`
    this.hostname = config.datacite.hostname
    this.urlPath = config.datacite.urlPath
    this.shoulder = config.datacite.shoulder
  }

  async create(parameter) {
    const content = this.generateJSON(parameter)
    const options = {
      host: this.hostname,
      path: this.urlPath,
      method: 'POST',
      headers: {
        Authorization: this.authorizationToken,
        'Content-type': 'application/vnd.api+json',
      },
    }
    const response = await performRequest(options, content)
    return response.status < 300
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
    const response = await performRequest(options)
    return response.status < 300
  }

  generateJSON(parameter) {
    const date = new Date()
    const doi = `${this.shoulder}/${parameter.id}`
    const json = {
      data: {
        id: doi,
        type: 'dois',
        attributes: {
          event: 'publish',
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
        },
      },
    }

    if (Array.isArray(parameter.authors) && parameter.authors.length > 0) {
      json.data.attributes.creators = []
      for (const author of parameter.authors) {
        json.data.attributes.creators.push({ name: author })
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
        resolve({
          status: res.statusCode,
          data: JSON.parse(data.join('')),
        })
      })
    })

    request.end(content)

    request.on('error', (err) => reject(err))
  })
}
