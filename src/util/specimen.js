import { getTaxonName } from "./taxa.js";

export function getSpecimenNameForPublishedProject(record) {
  // set show author to true
    return getSpecimenName(record, null, true, true, false)
}

export function getSpecimenName(
    record,
    otu = null,
    showExtinctMarker = true,
    showAuthor = false,
    skipSubgenus = false
) {
    let name = getTaxonName(record, otu, showExtinctMarker, showAuthor, skipSubgenus)
    // set source label
    let referenceSource = record.reference_source
    let sourceLabel
    if (referenceSource == 0) {
      // institution code must exist when other two columns exist
      sourceLabel = record.institution_code
      if (record.collection_code) {
        sourceLabel += '/' + record.collection_code
      }
      if (record.catalog_number) {
        sourceLabel += ':' + record.catalog_number
      }
    } else if (referenceSource == 1) {
      sourceLabel = 'unvouchered'
    } else {
      return 'Unknown specimen reference type ' + referenceSource
    }
    if (sourceLabel) {
      sourceLabel = sourceLabel.trim()
      if (name) {
        name = name.trim()
        name += ' (' + sourceLabel + ')'
      } else {
        name = sourceLabel
      }
    }
    if (name) {
      name = name.replace(/[\n\r\t]+/g, ' ')
    }
    return name 
}