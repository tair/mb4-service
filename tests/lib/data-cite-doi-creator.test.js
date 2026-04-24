import { describe, expect, test, beforeAll } from '@jest/globals'

// Mock config before importing the class
let DataCiteDOICreator

beforeAll(async () => {
  // Dynamically import after jest has set up module mocking
  // We need to mock config to avoid missing env var errors
  const mod = await import('lib/data-cite-doi-creator.js')
  DataCiteDOICreator = mod.DataCiteDOICreator
})

// We can't instantiate DataCiteDOICreator without config, so test
// generateJSON by extracting and calling it with a known shoulder.
function createTestInstance() {
  // Bypass constructor validation by creating a raw object with the method
  const instance = Object.create(DataCiteDOICreator.prototype)
  instance.shoulder = '10.7934'
  instance.hostname = 'api.test.datacite.org'
  instance.urlPath = '/dois'
  instance.authorizationToken = 'Basic dGVzdDp0ZXN0'
  return instance
}

describe('DataCiteDOICreator.generateJSON', () => {
  test('plain string authors produce creators with name only', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P100',
        title: 'Test Project',
        resource: 'https://morphobank.org/project/100',
        authors: ['Smith, John', 'Doe, Jane'],
      })
    )

    const creators = result.data.attributes.creators
    expect(creators).toHaveLength(2)
    expect(creators[0]).toEqual({ name: 'Smith, John' })
    expect(creators[1]).toEqual({ name: 'Doe, Jane' })
    // No nameIdentifiers when authors are plain strings
    expect(creators[0].nameIdentifiers).toBeUndefined()
    expect(creators[1].nameIdentifiers).toBeUndefined()
  })

  test('author objects with orcid produce nameIdentifiers', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P200',
        title: 'ORCID Test',
        resource: 'https://morphobank.org/project/200',
        authors: [
          { name: 'Smith, John', orcid: '0000-0001-5727-2427' },
          { name: 'Doe, Jane' },
        ],
      })
    )

    const creators = result.data.attributes.creators
    expect(creators).toHaveLength(2)

    // First author has ORCID
    expect(creators[0].name).toBe('Smith, John')
    expect(creators[0].nameIdentifiers).toEqual([
      {
        nameIdentifier: 'https://orcid.org/0000-0001-5727-2427',
        nameIdentifierScheme: 'ORCID',
        schemeUri: 'https://orcid.org',
      },
    ])

    // Second author has no ORCID
    expect(creators[1].name).toBe('Doe, Jane')
    expect(creators[1].nameIdentifiers).toBeUndefined()
  })

  test('mixed string and object authors both work', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P300',
        title: 'Mixed Test',
        resource: 'https://morphobank.org/project/300',
        authors: [
          'Plain Author',
          { name: 'Object Author', orcid: '0000-0002-1234-5678' },
        ],
      })
    )

    const creators = result.data.attributes.creators
    expect(creators[0]).toEqual({ name: 'Plain Author' })
    expect(creators[1].name).toBe('Object Author')
    expect(creators[1].nameIdentifiers).toHaveLength(1)
  })

  test('author object without orcid produces no nameIdentifiers', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P400',
        title: 'No ORCID',
        resource: 'https://morphobank.org/project/400',
        authors: [{ name: 'No Orcid Author' }],
      })
    )

    const creators = result.data.attributes.creators
    expect(creators[0]).toEqual({ name: 'No Orcid Author' })
    expect(creators[0].nameIdentifiers).toBeUndefined()
  })

  test('empty authors array produces no creators', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P500',
        title: 'No Authors',
        resource: 'https://morphobank.org/project/500',
        authors: [],
      })
    )

    expect(result.data.attributes.creators).toBeUndefined()
  })

  test('DOI and metadata fields are correct', () => {
    const instance = createTestInstance()
    const result = JSON.parse(
      instance.generateJSON({
        id: 'P100',
        title: 'My Project (project)',
        resource: 'https://morphobank.org/project/100/overview',
        authors: [{ name: 'Smith, J.', orcid: '0000-0001-0000-0001' }],
      })
    )

    expect(result.data.id).toBe('10.7934/P100')
    expect(result.data.type).toBe('dois')
    expect(result.data.attributes.doi).toBe('10.7934/P100')
    expect(result.data.attributes.publisher).toBe('MorphoBank')
    expect(result.data.attributes.titles[0].title).toBe('My Project (project)')
    expect(result.data.attributes.url).toBe(
      'https://morphobank.org/project/100/overview'
    )
    expect(result.data.attributes.schemaVersion).toBe(
      'http://datacite.org/schema/kernel-4'
    )
  })

  test('generateJSON uses event "publish" for create; omits event on update (DataCite has no "update" event)', () => {
    const instance = createTestInstance()
    const created = JSON.parse(
      instance.generateJSON(
        { id: 'P1', title: 'T', resource: 'u', authors: [] },
        { isUpdate: false }
      )
    )
    const updated = JSON.parse(
      instance.generateJSON(
        { id: 'P1', title: 'T2', resource: 'u2', authors: [] },
        { isUpdate: true }
      )
    )
    expect(created.data.attributes.event).toBe('publish')
    expect(updated.data.attributes.event).toBeUndefined()
  })
})
