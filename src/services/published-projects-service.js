import sequelizeConn from '../util/db.js'
import axios from 'axios'
import * as mediaService from './media-service.js'
import { getProjectStats } from './project-stats-service.js'

export async function getProjects() {
  const start = new Date().getTime()
  const [rows] = await sequelizeConn.query(`
    SELECT
      p.project_id, TRIM(journal_title) as journal_title, journal_cover,
      journal_year, journal_in_press, article_authors, article_title,
      published_on, 0 as has_continuous_char
    FROM projects p
    WHERE p.published = 1 AND p.deleted = 0
    ORDER BY p.published_on DESC`)

  const charDict = await getContinuousCharDict()
  for (const row of rows) {
    const projectId = row.project_id
    if (charDict[projectId]) {
      row.has_continuous_char = 1
    }

    row.project_stats = await getProjectStats(projectId)
    row.image_props = await mediaService.getImageProps(projectId, 'preview')
    await setJournalCoverUrl(row)
  }

  const end = new Date().getTime()
  console.log('Spent ' + (end - start) / 1000 + 's to complete')

  return rows
}

async function getContinuousCharDict() {
  const [continuousChars] = await sequelizeConn.query(`
      SELECT distinct p.project_id
      FROM characters c JOIN projects p ON c.project_id = p.project_id
      WHERE c.type = 1 AND p.published = 1`)
  const charDict = {}
  for (const continuousChar of continuousChars) {
    charDict[continuousChar.project_id] = 1
  }
  return charDict
}

async function setJournalCoverUrl(project) {
  project.journal_cover_url = ''
  const urlByTitle = getCoverUrlByJournalTitle(project.journal_title)
  delete project.journal_title
  const urlByCover = getCoverUrlByJournalCover(project.journal_cover)
  delete project.journal_cover

  if (urlByTitle) {
    try {
      await axios.get(urlByTitle)
      project.journal_cover_url = urlByTitle
      return
    } catch (e) {
      // do nothing
    }
  }

  if (urlByCover) {
    try {
      await axios.get(urlByCover)
      project.journal_cover_url = urlByCover
      return
    } catch (e) {
      // do nothing
    }
  }
}

function getCoverUrlByJournalCover(journalCover) {
  if (journalCover) {
    const preview = journalCover.preview
    const urlByCover = `https://morphobank.org/media/morphobank3/images/${preview.HASH}/${preview.MAGIC}_${preview.FILENAME}`
    return urlByCover
  }
  return ''
}

function getCoverUrlByJournalTitle(journalTitle) {
  if (journalTitle) {
    const cleanTitle = journalTitle
      .replace(/\s/g, '_')
      .replace(/:/g, '')
      .replace(/\./g, '')
      .replace(/&/g, 'and')
      .toLowerCase()
    const urlByTitle = `https://morphobank.org/themes/default/graphics/journalIcons/${cleanTitle}.jpg`
    return urlByTitle
  }
  return ''
}

export async function getProjectTitles() {
  const [rows] = await sequelizeConn.query(`
    SELECT project_id, name
    FROM projects 
    WHERE published = 1 AND deleted = 0
    ORDER BY name ASC`)
  return rows
}

export async function getInstitutionsWithProjects() {
  const [rows] = await sequelizeConn.query(`
    SELECT i.name as iname, p.project_id, p.name AS pname
    FROM institutions_x_projects ip, projects p, institutions i 
    WHERE
      ip.project_id = p.project_id AND
      p.published = 1 AND
      p.deleted = 0 AND
      ip.institution_id = i.institution_id
    ORDER BY i.name, p.project_id ASC`)

  const institutionsDict = {}
  for (let i = 0; i < rows.length; i++) {
    const iname = rows[i].iname
    const project = {
      id: rows[i].project_id,
      name: rows[i].pname,
    }

    if (!institutionsDict[iname]) {
      institutionsDict[iname] = { count: 1, projects: [project] }
    } else {
      institutionsDict[iname]['count'] += 1
      institutionsDict[iname]['projects'].push(project)
    }
  }

  const institutions = []
  for (const iname in institutionsDict) {
    const institution = {
      name: iname,
      count: institutionsDict[iname]['count'],
      projects: institutionsDict[iname]['projects'],
    }
    institutions.push(institution)
  }
  return institutions
}

export async function getAuthorsWithProjects() {
  const [rows] = await sequelizeConn.query(`
    SELECT fname, lname, p.project_id,  p.name, p.journal_title, p.journal_year, p.article_authors
    FROM projects_x_users pu, ca_users u, projects p
    WHERE pu.user_id = u.user_id and p.project_id=pu.project_id
    AND p.published=1 and p.deleted=0
    order by UPPER(TRIM(u.lname))`)

  const authors = {}
  const chars = []

  for (const row of rows) {
    let lname = row.lname

    // normalize the string (convert diacritics to ascii chars)
    const normalized = lname.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    lname = lname.charAt(0).toUpperCase() + lname.slice(1)
    const char = normalized.charAt(0).toUpperCase()
    if (!chars.includes(char)) {
      chars.push(char)
    }

    const author = row.fname + '|' + lname
    const project = {
      id: row.project_id,
      name: row.name,
      journal_title: row.journal_title,
      journal_year: row.journal_year,
      article_authors: row.article_authors,
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

export async function getJournalsWithProjects() {
  const [rows] = await sequelizeConn.query(`
    SELECT
      DISTINCT p.project_id, p.name, TRIM(p.journal_title) as journal,
      UPPER(TRIM(p.journal_title))
    FROM projects AS p
    WHERE p.published = 1 AND p.deleted = 0
    ORDER BY UPPER(TRIM(p.journal_title)), p.project_id;`)

  const journals = {}
  const chars = []

  for (const row of rows) {
    const journal = row.journal
    const char = journal
      .charAt(0)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (/[a-zA-Z]/.test(char) && !chars.includes(char)) {
      chars.push(char)
    }

    const project = {
      id: row.project_id,
      name: row.name,
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
  const [allTaxa] = await sequelizeConn.query(`
    SELECT taxon_id, parent_id, taxonomic_rank, name, published_specimen_count
    FROM resolved_taxonomy
    WHERE parent_id IS NOT NULL`)
  return allTaxa
}

function getRootTaxonany(taxa) {
  const rootRows = []
  for (const taxon of taxa) {
    if (taxon.taxonomic_rank == 'superkingdom') {
      rootRows.push(taxon)
    }
  }
  return rootRows
}

function getTaxonomyByParentId(allTaxa, parentId) {
  const rootRows = []
  for (const taxon of allTaxa) {
    if (taxon.parent_id == parentId) {
      rootRows.push(taxon)
    }
  }

  const rows = []
  for (const row of rootRows) {
    const children = getTaxonomyByParentId(allTaxa, row.taxon_id)
    rows.push({ ...row, children: children })
  }
  return rows
}

export async function getProjectTaxonomy() {
  const allTaxa = await getAllTaxonomy()
  const rootRows = getRootTaxonany(allTaxa)

  const rows = []
  for (const row of rootRows) {
    let children = getTaxonomyByParentId(allTaxa, row.taxon_id)
    rows.push({ ...row, children: children })
  }
  return rows
}
