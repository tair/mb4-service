import sequelizeConn from '../util/db.js'
import * as mediaService from './media-service.js'
import * as statsService from './stats-service.js'

async function getProjects() {
  let [rows] = await sequelizeConn.query(`
      SELECT p.project_id, journal_year, article_authors, article_title, published_on
      FROM projects p
      WHERE p.published = 1 AND p.deleted = 0
      ORDER BY p.published_on desc`)

  for (let i = 0; i < rows.length; i++) {
    const prj_stats = await statsService.getProjectStats(rows[i].project_id)

    const image_props = await mediaService.getImageProps(
      rows[i].project_id,
      'preview'
    )
    rows[i] = {
      image_props: image_props,
      project_stats: prj_stats,
      ...rows[i],
    }
  }

  return rows
}

async function getProjectTitles() {
  let [rows] = await sequelizeConn.query(`
  select project_id, name from projects 
 where published=1 and deleted=0
 order by name asc`)

  return rows
}

async function getInstitutionsWithProjects() {
  let [rows] = await sequelizeConn.query(`select i.name as iname, 
    p.project_id, 
    p.name as pname from 
    institutions_x_projects ip, projects p, institutions i 
    where ip.project_id=p.project_id and p.published=1 and p.deleted=0
    and ip.institution_id=i.institution_id
    order by i.name, p.project_id asc`)

  let institutionsDict = {}

  for (let i = 0; i < rows.length; i++) {
    let iname = rows[i].iname

    let project = {
      id: rows[i].project_id,
      name: rows[i].pname,
    }

    if (!institutionsDict[iname]) {
      institutionsDict[iname] = {"count": 1, "projects": [project]}
    } else {
      institutionsDict[iname]["count"] += 1
      institutionsDict[iname]["projects"].push(project)
    }
  }

  let institutions = []
  for (var iname in institutionsDict) {
    let institution = {
      name: iname,
      count: institutionsDict[iname]["count"],
      projects: institutionsDict[iname]["projects"]
    }
    institutions.push(institution)
  }
  return institutions
}

async function getAuthorsWithProjects() {
  let [rows] = await sequelizeConn.query(`select fname, 
    lname,
    p.project_id, 
    p.name
 from projects_x_users pu, ca_users u, projects p
 where pu.user_id = u.user_id and p.project_id=pu.project_id
 and p.published=1 and p.deleted=0
 order by UPPER(TRIM(u.lname))`)

  let authors = {}
  let chars = []

  for (let i = 0; i < rows.length; i++) {
    let lname = rows[i].lname

    // normalize the string (convert diacritics to ascii chars)
    const normalized = lname.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    lname = lname.charAt(0).toUpperCase() + lname.slice(1)
    let char = normalized.charAt(0).toUpperCase()
    if (!chars.includes(char)) {
      chars.push(char)
    }

    let author = rows[i].fname + '|' + lname
    let project = {
      id: rows[i].project_id,
      name: rows[i].name,
    }

    if (!authors[author]) {
      authors[author] = [project]
    } else {
      authors[author].push(project)
    }
  }

  return {
    chars: chars,
    authors: authors,
  }
}

async function getJournalsWithProjects() {
  let [rows] = await sequelizeConn.query(`select distinct p.project_id, p.name, 
    TRIM(b.journal_title) as journal,  UPPER(TRIM(b.journal_title))
    from bibliographic_references b, projects p
    where b.project_id=p.project_id and p.published=1 and p.deleted=0
    and b.journal_title != '' 
    order by UPPER(TRIM(b.journal_title)), p.project_id`)

  let journals = {}
  let chars = []

  for (let i = 0; i < rows.length; i++) {
    let journal = rows[i].journal
    let char = journal
      .charAt(0)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (/[a-zA-Z]/.test(char) && !chars.includes(char)) {
      chars.push(char)
    }

    let project = {
      id: rows[i].project_id,
      name: rows[i].name,
    }

    if (!journals[journal]) {
      journals[journal] = [project]
    } else {
      journals[journal].push(project)
    }
  }

  return {
    chars: chars,
    journals: journals,
  }
}

//////////////////////////////////////////////////
async function getAllTaxonomy() {
  let [all_taxon] = await sequelizeConn.query(`
  select taxon_id, parent_id, taxonomic_rank, name, published_specimen_count
  from resolved_taxonomy where parent_id is not null`)

  return all_taxon
}

function getRootTaxonany(all_taxon) {
  let root_rows = []
  for (let i = 0; i < all_taxon.length; i++) {
    if (all_taxon[i].taxonomic_rank == 'superkingdom')
      root_rows.push(all_taxon[i])
  }

  return root_rows
}

function getTaxonomyByParentId(all_taxon, parent_id) {
  let root_rows = []
  for (let i = 0; i < all_taxon.length; i++) {
    if (all_taxon[i].parent_id == parent_id) root_rows.push({ ...all_taxon[i] })
  }

  if (!root_rows || root_rows.length == 0) return

  let rows = []

  for (let i = 0; i < root_rows.length; i++) {
    let children = getTaxonomyByParentId(all_taxon, root_rows[i].taxon_id)
    rows.push({ ...root_rows[i], children: children })
  }

  return rows
}
//////////////////////////////////////

async function getProjectTaxonomy() {
  let all_taxon = await getAllTaxonomy()
  let root_rows = getRootTaxonany(all_taxon)

  let rows = []

  for (let i = 0; i < root_rows.length; i++) {
    let children = getTaxonomyByParentId(all_taxon, root_rows[i].taxon_id)
    rows.push({ ...root_rows[i], children: children })
  }

  return rows
}

export {
  getProjects,
  getProjectTitles,
  getAuthorsWithProjects,
  getJournalsWithProjects,
  getInstitutionsWithProjects,
  getProjectTaxonomy,
}
