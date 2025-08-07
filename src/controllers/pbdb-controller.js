import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as taxaService from '../services/taxa-service.js'
import { PbdbTaxonValidator } from '../lib/pbdb-taxon-validator.js'
import { time } from '../util/util.js'

export async function getPbdbInfo(req, res) {
  const projectId = req.params.projectId
  const pbdbInfo = await taxaService.getPbdbInfo(projectId)
  res.status(200).json({ 
    success: true,
    results: pbdbInfo.map((i) => convertPbdbInfo(i)) 
  })
}

export async function validateTaxa(req, res) {
  const projectId = req.params.projectId
  const userId = req.user.user_id
  const { taxon_ids } = req.body

  if (!Array.isArray(taxon_ids) || taxon_ids.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'taxon_ids must be a non-empty array' 
    })
  }

  if (taxon_ids.length > 100) {
    return res.status(400).json({ 
      success: false, 
      message: 'Maximum 100 taxa can be validated at once' 
    })
  }

  const transaction = await sequelizeConn.transaction()

  try {
    // Fetch the taxa from database
    const taxa = await models.Taxon.findAll({
      where: {
        taxon_id: taxon_ids,
        project_id: projectId,
      },
      transaction,
    })

    if (taxa.length === 0) {
      await transaction.rollback()
      return res.status(404).json({ 
        success: false, 
        message: 'No taxa found' 
      })
    }

    const validator = new PbdbTaxonValidator()
    const taxaInfo = {}

    for (const taxon of taxa) {
      try {
        const pbdbData = await validator.validateTaxonWithRanks(taxon)
        
        if (pbdbData && pbdbData.id) {
          // Found PBDB data
          taxaInfo[taxon.taxon_id] = {
            name: getPrimaryTaxonName(taxon),
            pbdb: {
              id: pbdbData.id,
              ranks: pbdbData.ranks || {}
            }
          }

          // Update the taxon with search timestamp but DON'T set pbdb_taxon_id yet
          // This keeps the taxon in "found but not imported" state until user imports
          taxon.pbdb_pulled_on = time()
          taxon.pbdb_taxon_id = null
          
          await taxon.save({
            user: req.user,
            transaction: transaction,
          })
        } else {
          // No PBDB results found
          taxaInfo[taxon.taxon_id] = {
            name: getPrimaryTaxonName(taxon),
            pbdb: null
          }

          // Update the taxon to record no results (set pbdb_taxon_id to 0)
          taxon.pbdb_pulled_on = time()
          taxon.pbdb_taxon_id = 0
          
          await taxon.save({
            user: req.user,
            transaction: transaction,
          })
        }
      } catch (error) {
        console.error(`Error validating taxon ${taxon.taxon_id}:`, error)
        
        // Still record that we attempted validation (treat as no results)
        taxon.pbdb_pulled_on = time()
        taxon.pbdb_taxon_id = 0
        
        await taxon.save({
          user: req.user,
          transaction: transaction,
        })

        taxaInfo[taxon.taxon_id] = {
          name: getPrimaryTaxonName(taxon),
          pbdb: null,
          error: error.message
        }
      }
    }

    await transaction.commit()
    
    res.status(200).json({ 
      success: true,
      taxa_info: taxaInfo 
    })
  } catch (error) {
    await transaction.rollback()
    console.error('Failed to validate taxa against PBDB', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}

export async function importTaxaInfo(req, res) {
  const projectId = req.params.projectId
  const userId = req.user.user_id
  const { taxa_info } = req.body

  if (!Array.isArray(taxa_info) || taxa_info.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'taxa_info must be a non-empty array' 
    })
  }

  const transaction = await sequelizeConn.transaction()

  try {
    const taxonIds = taxa_info.map(item => item.taxon_id)
    
    // Fetch the taxa from database
    const taxa = await models.Taxon.findAll({
      where: {
        taxon_id: taxonIds,
        project_id: projectId,
      },
      transaction,
    })

    const taxaMap = new Map()
    for (const taxon of taxa) {
      taxaMap.set(taxon.taxon_id, taxon)
    }

    for (const item of taxa_info) {
      const taxon = taxaMap.get(item.taxon_id)
      if (!taxon) {
        continue
      }

      // Update the taxon with selected PBDB rank data
      if (item.ranks) {
        for (const [column, value] of Object.entries(item.ranks)) {
          if (PbdbTaxonValidator.isValidRank(column) && value) {
            taxon[column] = value
          }
        }
      }

      // Set PBDB metadata
      taxon.pbdb_taxon_id = item.id
      taxon.pbdb_pulled_on = time()

      await taxon.save({
        user: req.user,
        transaction: transaction,
      })
    }

    await transaction.commit()
    
    res.status(200).json({ 
      success: true,
      message: `Successfully imported PBDB data for ${taxa_info.length} taxa`
    })
  } catch (error) {
    await transaction.rollback()
    console.error('Failed to import PBDB taxa info', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}

function convertPbdbInfo(pbdbInfo) {
  return {
    taxon_id: pbdbInfo.taxon_id,
    pbdb_pulled_on: pbdbInfo.pbdb_pulled_on || undefined,
    pbdb_taxon_id: pbdbInfo.pbdb_taxon_id, // Don't convert, preserve null/0/number as-is
  }
}

function getPrimaryTaxonName(taxon) {
  if (taxon.specific_epithet) {
    return `${taxon.genus || ''} ${taxon.specific_epithet}`.trim()
  }
  return taxon.genus || taxon.higher_taxon_family || taxon.higher_taxon_order || 'Unknown'
}