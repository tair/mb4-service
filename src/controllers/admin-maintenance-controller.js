import { models } from '../models/init-models.js'

/**
 * Get current maintenance message settings
 * GET /admin/maintenance
 */
export async function getMaintenanceSettings(req, res) {
  try {
    // Use raw query since table has no primary key
    const [results] = await models.CaApplicationVar.sequelize.query(
      'SELECT vars FROM ca_application_vars LIMIT 1',
      { type: models.CaApplicationVar.sequelize.QueryTypes.SELECT }
    )

    let vars = {}
    if (results && results.vars) {
      try {
        vars =
          typeof results.vars === 'string'
            ? JSON.parse(results.vars)
            : results.vars
      } catch (e) {
        console.error('Error parsing vars JSON:', e)
      }
    }

    res.json({
      success: true,
      data: {
        enabled: vars.maintenance_mode === '1' || vars.maintenance_mode === 1,
        message: vars.maintenance_message || '',
      },
    })
  } catch (error) {
    console.error('Error fetching maintenance settings:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance settings',
    })
  }
}

/**
 * Update maintenance message settings
 * PUT /admin/maintenance
 */
export async function updateMaintenanceSettings(req, res) {
  try {
    const { enabled, message } = req.body

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean',
      })
    }

    if (typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'message must be a string',
      })
    }

    // Get existing vars using raw query (table has no primary key)
    const [results] = await models.CaApplicationVar.sequelize.query(
      'SELECT vars FROM ca_application_vars LIMIT 1',
      { type: models.CaApplicationVar.sequelize.QueryTypes.SELECT }
    )

    let vars = {}
    if (results && results.vars) {
      try {
        vars =
          typeof results.vars === 'string'
            ? JSON.parse(results.vars)
            : results.vars
      } catch (e) {
        console.error('Error parsing existing vars JSON:', e)
        vars = {}
      }
    }

    // Update maintenance settings
    vars.maintenance_mode = enabled ? '1' : '0'
    vars.maintenance_message = message
    vars.last_modified_on = Math.floor(Date.now() / 1000)

    const varsJson = JSON.stringify(vars)

    // Save to database using raw query
    if (results) {
      // Update existing record
      await models.CaApplicationVar.sequelize.query(
        'UPDATE ca_application_vars SET vars = ?',
        {
          replacements: [varsJson],
          type: models.CaApplicationVar.sequelize.QueryTypes.UPDATE,
        }
      )
    } else {
      // Create new record if none exists
      await models.CaApplicationVar.sequelize.query(
        'INSERT INTO ca_application_vars (vars) VALUES (?)',
        {
          replacements: [varsJson],
          type: models.CaApplicationVar.sequelize.QueryTypes.INSERT,
        }
      )
    }

    res.json({
      success: true,
      message: 'Maintenance settings updated successfully',
      data: {
        enabled,
        message,
      },
    })
  } catch (error) {
    console.error('Error updating maintenance settings:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update maintenance settings',
    })
  }
}
