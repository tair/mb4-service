import sequelizeConn from '../util/db.js'

/**
 * Get role names for a user
 * @param {number} userId - The user ID
 * @returns {Promise<string[]>} Array of role names
 */
async function getRoles(userId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT r.name
    FROM ca_users_x_roles AS ur
    INNER JOIN ca_user_roles AS r ON ur.role_id = r.role_id
    WHERE ur.user_id = ?`,
    { replacements: [userId] }
  )
  return rows.map((row) => row.name)
}

export { getRoles }
