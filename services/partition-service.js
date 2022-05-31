const sequelize = require('../util/db.js')

async function getPartitions(project_id) {
  const [rows, metadata] = await sequelize.query(
    `select partition_id, name 
      from partitions where project_id=${project_id} order by name`
  )
  return rows
}

module.exports = {
  getPartitions,
}
