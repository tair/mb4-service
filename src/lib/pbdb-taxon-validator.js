/**
 * PBDB (Paleobiology Database) Taxon Validator
 * 
 * This class provides validation and higher taxonomic rank fetching from the 
 * Paleobiology Database API v1.2
 */

import axios from 'axios'

export class PbdbTaxonValidator {
  constructor() {
    this.baseUrl = 'https://paleobiodb.org/data1.2'
    this.cache = new Map()
    
    // Mapping from database column names to PBDB API rank parameters
    this.columnToParameterRank = {
      'subspecific_epithet': 'subspecies',
      'specific_epithet': 'species',
      'subgenus': 'subgenus',
      'genus': 'genus',
      'higher_taxon_subtribe': 'subtribe',
      'higher_taxon_tribe': 'tribe',
      'higher_taxon_subfamily': 'subfamily',
      'higher_taxon_family': 'family',
      'higher_taxon_superfamily': 'superfamily',
      'higher_taxon_infraorder': 'infraorder',
      'higher_taxon_suborder': 'suborder',
      'higher_taxon_order': 'order',
      'higher_taxon_superorder': 'superorder',
      'higher_taxon_infraclass': 'infraclass',
      'higher_taxon_subclass': 'subclass',
      'higher_taxon_class': 'class',
      'higher_taxon_phylum': 'phylum',
      'higher_taxon_kingdom': 'kingdom'
    }

    // Mapping from PBDB API response rank codes to database column names
    this.returnedRankToColumnName = {
      'phl': 'higher_taxon_phylum',
      'cll': 'higher_taxon_class',
      'odl': 'higher_taxon_order',
      'fml': 'higher_taxon_family',
      'gnl': 'genus'
    }
  }

  /**
   * Validates a taxon against PBDB and fetches higher taxonomic ranks
   * @param {Object} taxon - The taxon record from the database
   * @returns {Object|null} PBDB data with id and ranks, or null if not found
   */
  async validateTaxonWithRanks(taxon) {
    const taxonName = this.getPrimaryTaxonName(taxon)
    
    
    if (!taxonName) {
      return null
    }

    // Check cache first
    const cacheKey = `validate_${taxonName.toLowerCase()}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      // First, try to find the taxon by name
      const searchUrl = `${this.baseUrl}/taxa/list.json`
      const searchParams = {
        name: taxonName,
        show: 'full,parent,attr',
        limit: 10
      }
      
      
      const searchResponse = await axios.get(searchUrl, {
        params: searchParams,
        timeout: 10000
      })

      if (!searchResponse.data || !searchResponse.data.records || searchResponse.data.records.length === 0) {
        this.cache.set(cacheKey, null)
        return null
      }

      // Find the best match (exact name match preferred)
      const exactMatch = searchResponse.data.records.find(record => 
        record.nam && record.nam.toLowerCase() === taxonName.toLowerCase()
      )
      
      const selectedRecord = exactMatch || searchResponse.data.records[0]
      

      if (!selectedRecord.oid) {
        this.cache.set(cacheKey, null)
        return null
      }

      // Fetch higher taxonomic ranks for this taxon
      const higherRanks = await this.fetchHigherRanks(selectedRecord)
      
      const result = {
        id: selectedRecord.oid.replace('txn:', ''),
        name: selectedRecord.nam,
        ranks: higherRanks || {}
      }

      this.cache.set(cacheKey, result)
      return result

    } catch (error) {
      this.cache.set(cacheKey, null)
      return null
    }
  }

  /**
   * Validate a single taxon name against the PBDB (simple validation)
   * @param {string} taxonName - The taxon name to validate
   * @returns {Promise<Array>} - Promise that resolves to an array of matching taxa with name and id
   */
  async validateTaxon(taxonName) {
    if (!taxonName || typeof taxonName !== 'string') {
      return []
    }

    const cacheKey = `simple_validate_${taxonName.toLowerCase()}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const url = `${this.baseUrl}/taxa/single.json`
      const params = {
        name: taxonName,
        show: 'attr'
      }
      
      const response = await axios.get(url, {
        params,
        timeout: 10000
      })
      
      if (!response.data || !response.data.records || response.data.records.length === 0) {
        this.cache.set(cacheKey, [])
        return []
      }
      
      const results = response.data.records.map(record => ({
        name: record.taxon_name || record.nam,
        id: record.taxon_no ? record.taxon_no.toString() : (record.oid ? record.oid.replace('txn:', '') : null)
      }))
      
      this.cache.set(cacheKey, results)
      return results
      
    } catch (error) {
      this.cache.set(cacheKey, [])
      return []
    }
  }

  /**
   * Fetch higher taxonomic ranks from the Paleobiology Database (updated version)
   * @param {Object} taxonRecord - An object containing taxon data with taxonomic rank fields
   * @returns {Promise<Object>} - Promise that resolves to an object with 'id' and 'ranks' properties
   */
  async fetchHigherRanksFromTaxonRecord(taxonRecord) {
    const taxaInfo = {
      id: null,
      ranks: {}
    }

    // Iterate through each possible taxonomic rank
    for (const [columnName, requestedRank] of Object.entries(this.columnToParameterRank)) {
      const taxonName = taxonRecord[columnName]
      if (!taxonName) {
        continue
      }

      try {
        const records = await this.fetchRank(taxonName, requestedRank)
        
        for (const record of records) {
          // Extract the PBDB taxon ID
          if (record.oid) {
            taxaInfo.id = record.oid.replace('txn:', '')
          } else if (record.taxon_no) {
            taxaInfo.id = record.taxon_no.toString()
          }

          // Map returned ranks to column names
          for (const [returnedRank, returnedColumnName] of Object.entries(this.returnedRankToColumnName)) {
            let rankName = record[returnedRank]
            
            // Preserve existing data if it differs from PBDB
            if (taxonRecord[returnedColumnName] && 
                rankName && 
                rankName !== taxonRecord[returnedColumnName]) {
              rankName = taxonRecord[returnedColumnName]
            }

            if (rankName) {
              taxaInfo.ranks[returnedColumnName] = rankName
            }
          }
        }
      } catch (error) {
        // Silently continue on error
      }
    }

    return taxaInfo
  }

  /**
   * Fetches higher taxonomic ranks from PBDB for a given PBDB taxon record (legacy method)
   * @param {Object} taxonRecord - The PBDB taxon record
   * @returns {Object} Mapping of column names to taxonomic values
   */
  async fetchHigherRanks(taxonRecord) {
    // If the record already contains rank codes (from search response), use them directly
    if (taxonRecord.phl || taxonRecord.cll || taxonRecord.odl || taxonRecord.fml || taxonRecord.gnl) {
      return this.extractRanksFromRecord(taxonRecord)
    }
    
    try {
      // Get the detailed taxonomy hierarchy
      const detailUrl = `${this.baseUrl}/taxa/single.json`
      const detailParams = {
        id: taxonRecord.oid || taxonRecord.taxon_no,
        show: 'full,parent,attr,class'
      }
      
      
      const detailResponse = await axios.get(detailUrl, {
        params: detailParams,
        timeout: 10000
      })

      if (!detailResponse.data || !detailResponse.data.records || detailResponse.data.records.length === 0) {
        return {}
      }

      const record = detailResponse.data.records[0]
      const ranks = {}

      // Map PBDB fields to MorphoBank database columns
      const fieldMapping = {
        'subspecies': 'subspecific_epithet',
        'species': 'specific_epithet', 
        'subgenus': 'subgenus',
        'genus': 'genus',
        'subtribe': 'higher_taxon_subtribe',
        'tribe': 'higher_taxon_tribe',
        'subfamily': 'higher_taxon_subfamily',
        'family': 'higher_taxon_family',
        'superfamily': 'higher_taxon_superfamily',
        'infraorder': 'higher_taxon_infraorder',
        'suborder': 'higher_taxon_suborder',
        'order': 'higher_taxon_order',
        'superorder': 'higher_taxon_superorder',
        'infraclass': 'higher_taxon_infraclass',
        'subclass': 'higher_taxon_subclass',
        'class': 'higher_taxon_class',
        'phylum': 'higher_taxon_phylum',
        'kingdom': 'higher_taxon_kingdom'
      }

      // Extract taxonomic ranks from the PBDB record
      const mappingResults = {}
      for (const [pbdbField, mbColumn] of Object.entries(fieldMapping)) {
        if (record[pbdbField] && record[pbdbField].trim()) {
          ranks[mbColumn] = record[pbdbField].trim()
          mappingResults[pbdbField] = record[pbdbField].trim()
        }
      }

      return this.extractRanksFromRecord(record)

    } catch (error) {
      return {}
    }
  }

  /**
   * Extract ranks from a PBDB record using the returnedRankToColumnName mapping
   * @param {Object} record - The PBDB record
   * @returns {Object} Mapping of column names to taxonomic values
   */
  extractRanksFromRecord(record) {
    const ranks = {}
    

    // Use the returnedRankToColumnName mapping to extract ranks
    for (const [rankCode, columnName] of Object.entries(this.returnedRankToColumnName)) {
      if (record[rankCode] && record[rankCode].trim()) {
        ranks[columnName] = record[rankCode].trim()
      }
    }
    
    return ranks
  }

  /**
   * Fetch rank data with caching (private method from previous implementation)
   * @private
   * @param {string} taxonName - The taxon name to search for
   * @param {string} requestedRank - The taxonomic rank to search for
   * @returns {Promise<Array>} - Promise that resolves to the records array
   */
  async fetchRank(taxonName, requestedRank) {
    const cacheKey = `fetchRank(${encodeURIComponent(taxonName)},${requestedRank})`
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    const url = `${this.baseUrl}/taxa/list.json`
    const params = {
      name: taxonName,
      rank: requestedRank,
      show: 'class'
    }
    
    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000
      })
      
      if (!response.data || !Array.isArray(response.data.records)) {
        throw new Error('Invalid response format: missing records array')
      }
      
      const records = response.data.records
      
      // Cache the result
      this.cache.set(cacheKey, records)
      
      return records
    } catch (error) {
      throw error
    }
  }

  /**
   * Check if a column name represents a valid taxonomic rank
   * @param {string} columnName - The column name to check
   * @returns {boolean} - True if the column name is a valid rank
   */
  isValidRank(columnName) {
    return Object.values(this.returnedRankToColumnName).includes(columnName)
  }

  /**
   * Validates if a column name is a valid taxonomic rank field (static version)
   * @param {string} columnName - The database column name
   * @returns {boolean} True if it's a valid rank column
   */
  static isValidRank(columnName) {
    const validRanks = new Set([
      'subspecific_epithet',
      'specific_epithet',
      'subgenus',
      'genus',
      'higher_taxon_subtribe',
      'higher_taxon_tribe',
      'higher_taxon_subfamily',
      'higher_taxon_family',
      'higher_taxon_superfamily',
      'higher_taxon_infraorder',
      'higher_taxon_suborder',
      'higher_taxon_order',
      'higher_taxon_superorder',
      'higher_taxon_infraclass',
      'higher_taxon_subclass',
      'higher_taxon_class',
      'higher_taxon_phylum',
      'higher_taxon_kingdom'
    ])

    return validRanks.has(columnName)
  }

  /**
   * Get all valid rank column names
   * @returns {Array<string>} - Array of valid column names
   */
  getValidRanks() {
    return Object.values(this.returnedRankToColumnName)
  }

  /**
   * Gets the primary taxonomic name for a taxon
   * @param {Object} taxon - The taxon record
   * @returns {string|null} The primary name
   */
  getPrimaryTaxonName(taxon) {
    if (taxon.specific_epithet) {
      return `${taxon.genus || ''} ${taxon.specific_epithet}`.trim()
    }
    return taxon.genus || taxon.higher_taxon_family || taxon.higher_taxon_order || null
  }

  /**
   * Clear the internal cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   * @returns {Object} - Object with cache size and keys
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

/**
 * Utility functions for batch operations and common use cases
 */
export class PBDBValidatorUtils {
  constructor(validator = null) {
    this.validator = validator || new PbdbTaxonValidator()
  }

  /**
   * Validate multiple taxa in batch
   * @param {Array<string>} taxonNames - Array of taxon names to validate
   * @param {Object} options - Options for batch processing
   * @param {number} options.concurrency - Maximum concurrent requests (default: 5)
   * @param {number} options.delay - Delay between batches in ms (default: 100)
   * @returns {Promise<Array>} - Promise that resolves to array of validation results
   */
  async validateTaxaBatch(taxonNames, options = {}) {
    const { concurrency = 5, delay = 100 } = options
    const results = []

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < taxonNames.length; i += concurrency) {
      const batch = taxonNames.slice(i, i + concurrency)
      const batchPromises = batch.map(name => 
        this.validator.validateTaxon(name).catch(error => {
          return { error: error.message, taxon: name }
        })
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to be respectful to the API
      if (i + concurrency < taxonNames.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return results
  }

  /**
   * Fetch higher ranks for multiple taxa in batch
   * @param {Array<Object>} taxonRecords - Array of taxon record objects
   * @param {Object} options - Options for batch processing
   * @returns {Promise<Array>} - Promise that resolves to array of higher rank results
   */
  async fetchHigherRanksBatch(taxonRecords, options = {}) {
    const { concurrency = 3, delay = 200 } = options
    const results = []

    for (let i = 0; i < taxonRecords.length; i += concurrency) {
      const batch = taxonRecords.slice(i, i + concurrency)
      const batchPromises = batch.map(record => 
        this.validator.fetchHigherRanksFromTaxonRecord(record).catch(error => {
          return { error: error.message, record }
        })
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      if (i + concurrency < taxonRecords.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return results
  }

  /**
   * Create a taxon record object from basic taxonomic information
   * @param {Object} basicInfo - Basic taxonomic information
   * @param {string} basicInfo.genus - Genus name
   * @param {string} basicInfo.species - Species epithet (optional)
   * @param {string} basicInfo.family - Family name (optional)
   * @param {Object} additionalRanks - Additional taxonomic ranks (optional)
   * @returns {Object} - Formatted taxon record
   */
  createTaxonRecord(basicInfo, additionalRanks = {}) {
    const record = {
      genus: basicInfo.genus || '',
      specific_epithet: basicInfo.species || '',
      higher_taxon_family: basicInfo.family || '',
      higher_taxon_order: basicInfo.order || '',
      higher_taxon_class: basicInfo.class || '',
      higher_taxon_phylum: basicInfo.phylum || '',
      higher_taxon_kingdom: basicInfo.kingdom || '',
      ...additionalRanks
    }

    return record
  }
}

/*
 * Example usage of the enhanced PBDB Taxon Validator:
 * 
 * // Basic usage
 * const validator = new PbdbTaxonValidator()
 * 
 * // Validate a single taxon (simple validation)
 * const results = await validator.validateTaxon('Tyrannosaurus rex')
 * console.log(results) // [{ name: 'Tyrannosaurus rex', id: '12345' }]
 * 
 * // Validate a taxon with higher ranks fetching (legacy method)
 * const taxonRecord = {
 *   genus: 'Tyrannosaurus',
 *   specific_epithet: 'rex',
 *   higher_taxon_family: 'Tyrannosauridae'
 * }
 * const validation = await validator.validateTaxonWithRanks(taxonRecord)
 * console.log(validation)
 * 
 * // Fetch higher ranks for a taxon record
 * const higherRanks = await validator.fetchHigherRanksFromTaxonRecord(taxonRecord)
 * console.log(higherRanks) // { id: '12345', ranks: { higher_taxon_order: 'Saurischia', ... } }
 * 
 * // Batch operations
 * const utils = new PBDBValidatorUtils(validator)
 * const taxonNames = ['Tyrannosaurus rex', 'Allosaurus fragilis', 'Stegosaurus stenops']
 * const batchResults = await utils.validateTaxaBatch(taxonNames)
 * console.log(batchResults)
 * 
 * // Create taxon record helper
 * const newRecord = utils.createTaxonRecord({
 *   genus: 'Tyrannosaurus',
 *   species: 'rex',
 *   family: 'Tyrannosauridae'
 * })
 * 
 * // Cache management
 * console.log(validator.getCacheStats())
 * validator.clearCache()
 */