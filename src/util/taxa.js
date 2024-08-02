import { capitalizeFirstLetter } from '../util/util.js'

export const TAXA_FIELD_NAMES = [
  'supraspecific_clade',
  'higher_taxon_kingdom',
  'higher_taxon_phylum',
  'higher_taxon_class',
  'higher_taxon_subclass',
  'higher_taxon_infraclass',
  'higher_taxon_cohort',
  'higher_taxon_superorder',
  'higher_taxon_order',
  'higher_taxon_suborder',
  'higher_taxon_infraorder',
  'higher_taxon_superfamily',
  'higher_taxon_family',
  'higher_taxon_subfamily',
  'higher_taxon_tribe',
  'higher_taxon_subtribe',
  'genus',
  'subgenus',
  'specific_epithet',
  'subspecific_epithet',
]

export function getTaxonNameForPublishedProject(record) {
  // set show author to true
  return getTaxonName(record, null, true, true, false)
}

export function getTaxonName(
  record,
  otu = null,
  showExtinctMarker = true,
  showAuthor = false,
  skipSubgenus = false
) {
  const names = []
  if (record.is_extinct && showExtinctMarker) {
    names.push('†')
  }

  if (
    !TAXA_FIELD_NAMES.includes(otu) ||
    otu == 'subgenus' ||
    otu == 'specific_epithet' ||
    otu == 'subspecific_epithet'
  ) {
    otu = 'genus'
  }

  let lastNameFound = ''
  let gotOtu = false
  for (const fieldName of TAXA_FIELD_NAMES) {
    if (skipSubgenus && fieldName == 'subgenus') {
      continue
    }

    if (fieldName == otu) {
      gotOtu = true
    }

    let name = record[fieldName]
    if (gotOtu && name) {
      switch (fieldName) {
        case 'genus':
          name = '<i>' + capitalizeFirstLetter(name) + '</i>'
          break
        case 'specific_epithet':
          name = '<i>' + name.toLowerCase() + '</i>'
          break
        default:
          break
      }
      names.push(name)
    }
    if (name) {
      lastNameFound = name
    }
  }
  if (names.length == 0) {
    names.push(lastNameFound)
  }

  if (showAuthor) {
    if (record.scientific_name_author || record.scientific_name_year) {
      let author = record.scientific_name_author
      if (record.scientific_name_year) {
        author += ', ' + record.scientific_name_year
      }
      if (record.use_parens_for_author) {
        names.push('(' + author + ')')
      } else {
        names.push(author)
      }
    }
  }

  return names.join(' ')
}

export const TAXA_SORT_FIELDS = [
  'higher_taxon_phylum',
  'higher_taxon_class',
  'higher_taxon_order',
  'higher_taxon_superfamily',
  'higher_taxon_family',
  'higher_taxon_subfamily',
  'genus',
  'specific_epithet',
]

export function getTaxaSortFieldValues(record) {
  let sortVals = {}
  for (const field of TAXA_SORT_FIELDS) {
    sortVals[field] = record[field]
  }
  return sortVals
}
