import sequelizeConn from '../util/db.js';

async function getPartitions(project_id) {
  const [rows, metadata] = await sequelizeConn.query(
    `select partition_id, name 
      from partitions where project_id=${project_id} order by name`
  )
  return rows
}

export {getPartitions}