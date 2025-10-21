import sequelizeConn from '../util/db.js'
import * as mediaService from './media-service.js'
import { getProjectStats } from './project-stats-service.js'
import config from '../config.js'
import s3Service from './s3-service.js'

/**
 * Get published project IDs without enrichment
 * Lightweight function for operations that only need project_id
 * @returns {Promise<Array>} Array of objects with project_id
 */
export async function getPublishedProjectIds() {
  const [rows] = await sequelizeConn.query(`
    SELECT project_id
    FROM projects
    WHERE published = 1 AND deleted = 0
    ORDER BY published_on DESC`)
  return rows
}

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
    row.image_props = await mediaService.getImageProps(projectId, 'thumbnail')
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
  // console.log('setting journal cover url for project', project.project_id)
  project.journal_cover_path = ''
  const pathByTitle = getCoverPathByJournalTitle(project.journal_title)
  delete project.journal_title
  const pathByCover = getCoverUrlPathJournalCover(project.journal_cover)
  delete project.journal_cover

  if (pathByTitle) {
    try {
      const exists = await s3Service.objectExists(
        config.aws.defaultBucket,
        pathByTitle
      )
      if (exists) {
        project.journal_cover_path = `/s3/${pathByTitle}`
        return
      }
    } catch (e) {
      console.log('error checking S3 object existence for urlByTitle', e)
      // do nothing
    }
  }

  if (pathByCover) {
    try {
      const exists = await s3Service.objectExists(
        config.aws.defaultBucket,
        pathByCover
      )
      if (exists) {
        project.journal_cover_path = `/s3/${pathByCover}`
        return
      }
    } catch (e) {
      console.log('error checking S3 object existence for urlByCover', e)
      // do nothing
    }
  }
}

function getCoverUrlPathJournalCover(journalCover) {
  if (journalCover) {
    // Check if it's the new migrated format
    if (journalCover.filename && journalCover.migrated) {
      const s3Key = `media_files/journal_covers/uploads/${journalCover.filename}`
      return s3Key
    }
  }
  return ''
}

function getCoverPathByJournalTitle(journalTitle) {
  if (journalTitle) {
    const cleanTitle = journalTitle
      .replace(/\s/g, '_')
      .replace(/:/g, '')
      .replace(/\./g, '')
      .replace(/&/g, 'and')
      .toLowerCase()
    const s3Key = `media_files/journal_covers/${cleanTitle}.jpg`
    return s3Key
  }
  return ''
}

export async function getProjectTitles() {
  const [rows] = await sequelizeConn.query(`
    SELECT project_id, name, article_authors, journal_year, journal_title, article_title
    FROM projects 
    WHERE published = 1 AND deleted = 0
    ORDER BY UPPER(COALESCE(NULLIF(TRIM(article_title), ''), name)) ASC`)
  return rows
}

export async function getInstitutionsWithProjects() {
  const [rows] = await sequelizeConn.query(`
    SELECT i.name as iname, p.project_id, p.name AS pname,
           p.article_authors, p.journal_year, p.journal_title, p.article_title
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
      article_authors: rows[i].article_authors,
      journal_year: rows[i].journal_year,
      journal_title: rows[i].journal_title,
      article_title: rows[i].article_title,
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
    SELECT fname, lname, p.project_id,  p.name, p.journal_title, p.journal_year, p.article_authors, p.article_title
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
      article_title: row.article_title,
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
      p.article_authors, p.journal_year, p.article_title, UPPER(TRIM(p.journal_title))
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
      article_authors: row.article_authors,
      journal_year: row.journal_year,
      journal_title: row.journal,
      article_title: row.article_title,
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

export async function getTitlesWithProjects() {
  const [rows] = await sequelizeConn.query(`
    SELECT
      p.project_id,
      p.name,
      p.article_authors,
      p.journal_year,
      TRIM(p.journal_title) as journal_title,
      p.article_title,
      COALESCE(NULLIF(TRIM(p.article_title), ''), p.name) as display_title
    FROM projects AS p
    WHERE p.published = 1 AND p.deleted = 0`)

  // Build array with sanitized sort keys
  const items = rows.map((row) => {
    const displayTitle = row.display_title || ''
    // Remove HTML tags, normalize and strip diacritics, then keep only alphanumerics
    const noTags = displayTitle.replace(/<[^>]*>/g, '')
    const nfd = noTags.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const alnumOnly = nfd.replace(/[^a-zA-Z0-9]/g, '')
    const upper = alnumOnly.toUpperCase()
    const sortKeyPrefixLen = 10
    const sortKey = upper.substring(0, sortKeyPrefixLen)

    return { row, displayTitle, sortKey }
  })

  // Sort by sanitized key, then by project_id to stabilize
  items.sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1
    if (a.sortKey > b.sortKey) return 1
    return a.row.project_id - b.row.project_id
  })

  const titles = {}
  const chars = []

  for (const item of items) {
    const row = item.row
    const displayTitle = item.displayTitle
    const firstChar = item.sortKey.charAt(0)

    if (/[A-Z0-9]/.test(firstChar) && !chars.includes(firstChar)) {
      chars.push(firstChar)
    }

    const project = {
      id: row.project_id,
      name: row.name,
      article_authors: row.article_authors,
      journal_year: row.journal_year,
      journal_title: row.journal_title,
      article_title: row.article_title,
    }

    if (!titles[displayTitle]) {
      titles[displayTitle] = [project]
    } else {
      titles[displayTitle].push(project)
    }
  }

  return {
    chars: chars,
    titles: titles,
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
