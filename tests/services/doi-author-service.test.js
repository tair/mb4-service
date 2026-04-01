import { describe, expect, test, jest, beforeAll } from '@jest/globals'

jest.unstable_mockModule('models/init-models.js', () => ({
  models: {
    User: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
    },
    ProjectsXUser: {
      findAll: jest.fn(),
    },
  },
}))

let buildAuthorsWithOrcid, models

beforeAll(async () => {
  const service = await import('services/doi-author-service.js')
  buildAuthorsWithOrcid = service.buildAuthorsWithOrcid

  const modelsModule = await import('models/init-models.js')
  models = modelsModule.models
})

describe('buildAuthorsWithOrcid', () => {
  function resetMocks() {
    models.User.findByPk.mockReset()
    models.User.findAll.mockReset()
    models.ProjectsXUser.findAll.mockReset()
  }

  test('returns project members with their ORCIDs', async () => {
    resetMocks()
    const project = { project_id: 100, user_id: 1 }

    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111' },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: '0000-0002-2222-2222' },
    ])

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'Jane Doe', orcid: '0000-0002-2222-2222' },
    ])
  })

  test('members without ORCID get name only', async () => {
    resetMocks()
    const project = { project_id: 200, user_id: 1 }

    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111' },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: null },
    ])

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'Jane Doe' },
    ])
  })

  test('falls back to project owner when no members', async () => {
    resetMocks()
    const project = { project_id: 300, user_id: 5 }

    models.ProjectsXUser.findAll.mockResolvedValue([])
    models.User.findByPk.mockResolvedValue({
      fname: 'Owner',
      lname: 'Person',
      orcid: '0000-0005-5555-5555',
    })

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'Owner Person', orcid: '0000-0005-5555-5555' },
    ])
  })

  test('fallback owner without ORCID gets name only', async () => {
    resetMocks()
    const project = { project_id: 400, user_id: 6 }

    models.ProjectsXUser.findAll.mockResolvedValue([])
    models.User.findByPk.mockResolvedValue({
      fname: 'No',
      lname: 'Orcid',
      orcid: null,
    })

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([{ name: 'No Orcid' }])
  })

  test('returns empty array when no members and no owner', async () => {
    resetMocks()
    const project = { project_id: 500, user_id: 99 }

    models.ProjectsXUser.findAll.mockResolvedValue([])
    models.User.findByPk.mockResolvedValue(null)

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([])
  })

  test('filters out members with empty names', async () => {
    resetMocks()
    const project = { project_id: 600, user_id: 1 }

    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111' },
      { user_id: 2, fname: '', lname: '', orcid: '0000-0002-2222-2222' },
    ])

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
    ])
  })

  test('respects user-level orcid_opt_out', async () => {
    resetMocks()
    const project = { project_id: 700, user_id: 1 }

    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1 },
      { user_id: 2 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111', orcid_opt_out: 0 },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: '0000-0002-2222-2222', orcid_opt_out: 1 },
    ])

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'Jane Doe' },
    ])
  })

  test('respects project-level orcid_publish_opt_out', async () => {
    resetMocks()
    const project = { project_id: 800, user_id: 1 }

    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1, orcid_publish_opt_out: 0 },
      { user_id: 2, orcid_publish_opt_out: 1 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111', orcid_opt_out: 0 },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: '0000-0002-2222-2222', orcid_opt_out: 0 },
    ])

    const result = await buildAuthorsWithOrcid(project)

    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'Jane Doe' },
    ])
  })
})
