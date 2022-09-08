import sequelizeConn from '../util/db.js';

async function getSpecimenDetails(project_id) {
  const [rows, metadata] = await sequelizeConn.query(
    `select 
    s.reference_source, s.institution_code,s.user_id,
    s.collection_code, s.catalog_number, s.created_on,
    u.fname, u.lname,
    t.*
    from specimens s
    inner join taxa_x_specimens ts on s.specimen_id = ts.specimen_id
    inner join taxa t on t.taxon_id=ts.taxon_id
    inner join ca_users u on u.user_id = s.user_id
    and s.project_id=${project_id}`
  )
  return rows
}

export {getSpecimenDetails}