export function getCitationText(record) {
  const articleTitle = record.article_title ? record.article_title.trim() : ''
  const journalTitle = record.journal_title ? record.journal_title.trim() : ''

  const publicationYear = record.pubyear
  const publisher = record.title ? record.publisher.trim() : ''
  const placeOfPublication = record.place_of_publication
    ? record.place_of_publication.trim()
    : ''
  const volume = record.vol ? record.vol.trim() : ''
  const number = record.num ? record.num.trim() : ''
  const section = record.sect ? record.sect.trim() : ''
  const edition = record.edition ? record.edition.trim() : ''
  const collation = record.collation ? record.collation.trim() : ''
  const referenceType = record.reference_type
    ? parseInt(record.reference_type)
    : ''

  let citation = ''

  const authors = []
  if (record.authors && record.authors.length) {
    authors.push(...record.authors)
  }
  if (authors) {
    const authorNames = getAuthors(authors)
    citation += authorNames + '. '
  }

  if (publicationYear) {
    citation += publicationYear
  }

  if (!citation.endsWith('.')) {
    citation += '. '
  }

  if (articleTitle) {
    citation += articleTitle
  }

  if (!citation.endsWith('.')) {
    citation += '. '
  }

  if (journalTitle) {
    citation +=
      referenceType == 5 || referenceType == 3 || referenceType == 5
        ? 'In '
        : ''
    citation += journalTitle
  }

  if (!citation.endsWith('.')) {
    citation += '. '
  }

  if (volume) {
    citation += 'Vol. ' + volume
  }
  if (number) {
    citation += `(${number})`
  }

  if (collation) {
    citation += number ? ', ' : ' '
    citation +=
      collation.includes('-') || collation.include(',') ? ' pp. ' : ' p. '
    citation += collation
  }

  const editors = []
  if (record.editors && record.editors.length) {
    editors.push(...record.editors)
  }
  if (editors) {
    const editorNames = getAuthors(editors)
    citation += (collation ? ', ' : ' in ') + editorNames + ' <i>ed</i>'
  }
  if (volume || number || collation || editors) {
    citation += '. '
  }

  if (section) {
    citation += ' Section: ' + section + '. '
  }
  if (edition) {
    citation += ' Edition: ' + edition + '. '
  }

  if (publisher) {
    citation += publisher
  }
  if (placeOfPublication) {
    if (publisher) {
      citation += ','
    }
    citation += ' ' + placeOfPublication + '. '
  } else {
    if (publisher) {
      citation += '. '
    }
  }

  return citation.trim()
}

function getAuthors(authors) {
  const names = []
  for (const author of authors) {
    const name = []
    if (author.surname) {
      names.push(author.surname)
    }
    if (author.forename) {
      names.push(author.forename)
    }
    if (author.middlename) {
      names.push(author.middlename)
    }
    names.push(name.join(', '))
  }

  if (names.length == 0) {
    return ''
  }
  if (names.length == 1) {
    return names[0]
  }

  const lastAuthor = names.pop()
  return names.join(', ') + ' and ' + lastAuthor
}
