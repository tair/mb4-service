import axios from 'axios'
import qs from 'qs'
import config from '../config.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'

/**
 * Service for interacting with ORCID Works API
 * Handles adding works to ORCID records when projects are published
 */
export class ORCIDWorksService {
  constructor() {
    // Use ORCID API domain for writing works (requires ORCID membership)
    this.apiDomain = config.orcid.apiDomain
  }

  /**
   * Refresh an ORCID access token using the refresh token
   * @param {string} refreshToken - The refresh token
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async refreshAccessToken(refreshToken) {
    try {
      const tokenUrl = `${config.orcid.domain}/oauth/token`
      const data = {
        client_id: config.orcid.clientId,
        client_secret: config.orcid.cliendSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }

      const options = {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }

      const response = await axios.post(
        tokenUrl,
        qs.stringify(data),
        options
      )

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
      }
    } catch (error) {
      console.error('Error refreshing ORCID access token:', error.message)
      throw new Error(`Failed to refresh ORCID token: ${error.message}`)
    }
  }

  /**
   * Build ORCID Work XML payload from project data
   * @param {Object} project - Project model instance
   * @returns {string} XML string for ORCID Work
   */
  buildWorkPayload(project) {
    const projectUrl = `${config.app.frontendDomain}/project/${project.project_id}/overview`
    
    // Build title
    const title = project.article_title || project.name || 'MorphoBank Project'
    
    // Build publication date - extract just the year
    let publicationYear = null
    if (project.journal_year) {
      const yearMatch = project.journal_year.trim().match(/(\d{4})/)
      if (yearMatch) {
        publicationYear = yearMatch[1]
      }
    }

    // Build external identifiers (DOIs or source-work-id)
    // ORCID requires at least one external identifier
    const externalIdList = []
    
    if (project.project_doi) {
      externalIdList.push({
        type: 'doi',
        value: project.project_doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
        url: `https://doi.org/${project.project_doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`,
      })
    }
    
    if (project.article_doi) {
      externalIdList.push({
        type: 'doi',
        value: project.article_doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
        url: `https://doi.org/${project.article_doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`,
      })
    }

    // If no DOI, use the MorphoBank project URL as a source-work-id
    if (externalIdList.length === 0) {
      externalIdList.push({
        type: 'uri',
        value: projectUrl,
        url: projectUrl,
      })
    }

    const externalIdElements = externalIdList
      .map(
        (id) => `<common:external-id>
        <common:external-id-type>${id.type}</common:external-id-type>
        <common:external-id-value>${this.escapeXml(id.value)}</common:external-id-value>
        <common:external-id-url>${this.escapeXml(id.url)}</common:external-id-url>
        <common:external-id-relationship>self</common:external-id-relationship>
      </common:external-id>`
      )
      .join('\n      ')
    
    const externalIds = `<common:external-ids>
      ${externalIdElements}
    </common:external-ids>`

    // Build URL
    const workUrl = `<common:url>${this.escapeXml(projectUrl)}</common:url>`

    // Build work type - default to "data-set" for MorphoBank projects
    const workType = '<work:type>data-set</work:type>'

    // Build short description from project description
    let shortDescription = ''
    if (project.description) {
      const desc = project.description.substring(0, 5000) // ORCID limit is 5000 chars
      shortDescription = `<work:short-description>${this.escapeXml(desc)}</work:short-description>`
    }

    // Assemble the work XML - order matters for ORCID!
    const workXml = `<?xml version="1.0" encoding="UTF-8"?>
<work:work xmlns:common="http://www.orcid.org/ns/common" xmlns:work="http://www.orcid.org/ns/work">
  <work:title>
    <common:title>${this.escapeXml(title)}</common:title>
  </work:title>
  ${project.journal_title ? `<work:journal-title>${this.escapeXml(project.journal_title)}</work:journal-title>` : ''}
  ${shortDescription}
  ${workType}
  ${publicationYear ? `<common:publication-date><common:year>${publicationYear}</common:year></common:publication-date>` : ''}
  ${externalIds}
  ${workUrl}
</work:work>`

    return workXml
  }

  /**
   * Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeXml(text) {
    if (!text) return ''
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Add a work to an ORCID record
   * @param {string} userOrcid - The user's ORCID ID
   * @param {string} accessToken - The user's ORCID access token
   * @param {Object} project - Project model instance
   * @param {Object} user - User model instance (for token refresh)
   * @returns {Promise<{success: boolean, putCode?: string, error?: string}>}
   */
  async addWork(userOrcid, accessToken, project, user = null) {
    try {
      const workXml = this.buildWorkPayload(project)
      const url = `${this.apiDomain}/v3.0/${userOrcid}/work`

      const headers = {
        'Content-Type': 'application/vnd.orcid+xml',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      }

      const response = await axios.post(url, workXml, { headers })

      if (response.status === 201) {
        // Extract put-code from Location header
        // ORCID API returns Location in format: {domain}/v3.0/{orcid}/work/{put-code}
        const location = response.headers.location
        const putCodeMatch = location?.match(/\/work\/(\d+)/)
        const putCode = putCodeMatch ? putCodeMatch[1] : null

        return {
          success: true,
          putCode: putCode,
        }
      } else {
        return {
          success: false,
          error: `Unexpected status code: ${response.status}`,
        }
      }
    } catch (error) {
      // Handle token expiration - try to refresh and retry once
      if (
        error.response?.status === 401 &&
        user?.orcid_refresh_token &&
        !error.config?._retried
      ) {
        try {
          const tokens = await this.refreshAccessToken(user.orcid_refresh_token)

          // Update user's tokens in database
          user.orcid_access_token = tokens.accessToken
          if (tokens.refreshToken !== user.orcid_refresh_token) {
            user.orcid_refresh_token = tokens.refreshToken
          }
          await user.save({ user: user })

          // Retry the request with new token
          const retryConfig = {
            ...error.config,
            headers: {
              ...error.config.headers,
              Authorization: `Bearer ${tokens.accessToken}`,
            },
            _retried: true,
          }

          const retryResponse = await axios.post(
            retryConfig.url,
            retryConfig.data,
            { headers: retryConfig.headers }
          )

          if (retryResponse.status === 201) {
            // ORCID API returns Location in format: {domain}/v3.0/{orcid}/work/{put-code}
            const location = retryResponse.headers.location
            const putCodeMatch = location?.match(/\/work\/(\d+)/)
            const putCode = putCodeMatch ? putCodeMatch[1] : null

            return {
              success: true,
              putCode: putCode,
            }
          }
        } catch (refreshError) {
          console.error(
            `Failed to refresh token for ${userOrcid}:`,
            refreshError.message
          )
          return {
            success: false,
            error: `Token refresh failed: ${refreshError.message}`,
          }
        }
      }

      // Log detailed error for debugging
      console.error('[ORCIDWorksService] Error adding work:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      })

      // Return error details
      const errorMessage =
        error.response?.data?.['developer-message'] ||
        error.response?.data?.['user-message'] ||
        error.response?.data?.message ||
        error.response?.data?.error_description ||
        (typeof error.response?.data === 'string' ? error.response.data : null) ||
        error.message ||
        'Unknown error'

      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

