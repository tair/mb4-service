import { describe, expect, test, jest, beforeAll } from '@jest/globals'

jest.unstable_mockModule('models/init-models.js', () => ({
  models: {
    User: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
    },
    ProjectsXUser: {
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
  },
}))

let buildAuthorsWithOrcid, DOI_PLACEHOLDER_CREATOR_NAME, isUserListedInArticleAuthors, models

beforeAll(async () => {
  const service = await import('services/doi-author-service.js')
  buildAuthorsWithOrcid = service.buildAuthorsWithOrcid
  DOI_PLACEHOLDER_CREATOR_NAME = service.DOI_PLACEHOLDER_CREATOR_NAME

  const eligibility = await import('util/article-authors-eligibility.js')
  isUserListedInArticleAuthors = eligibility.isUserListedInArticleAuthors

  const modelsModule = await import('models/init-models.js')
  models = modelsModule.models
})

describe('buildAuthorsWithOrcid', () => {
  function resetMocks() {
    models.User.findByPk.mockReset()
    models.User.findAll.mockReset()
    models.ProjectsXUser.findAll.mockReset()
    models.ProjectsXUser.findOne.mockReset()
  }

  test('when article_authors is missing, blank, or only whitespace, returns placeholder only', async () => {
    const p1 = await buildAuthorsWithOrcid({ project_id: 1, user_id: 1 })
    const p2 = await buildAuthorsWithOrcid({ project_id: 1, user_id: 1, article_authors: '' })
    const p3 = await buildAuthorsWithOrcid({ project_id: 1, user_id: 1, article_authors: '   ' })
    expect(p1).toEqual([{ name: DOI_PLACEHOLDER_CREATOR_NAME }])
    expect(p2).toEqual([{ name: 'No authors available' }])
    expect(p3).toEqual([{ name: 'No authors available' }])
  })

  test('with article_authors, matches members in segment order; ORCID when allowed', async () => {
    resetMocks()
    const project = {
      project_id: 100,
      user_id: 1,
      article_authors: 'John Smith; Jane Doe',
    }
    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1, orcid_publish_opt_out: 0 },
      { user_id: 2, orcid_publish_opt_out: 0 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111' },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: null, orcid_opt_out: 0 },
    ])
    const result = await buildAuthorsWithOrcid(project)
    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'Jane Doe' },
    ])
  })

  test('no memberships: only owner can match a segment', async () => {
    resetMocks()
    const project = {
      project_id: 300,
      user_id: 5,
      article_authors: 'Owner Person',
    }
    models.ProjectsXUser.findAll.mockResolvedValue([])
    models.ProjectsXUser.findOne.mockResolvedValue(null)
    models.User.findByPk.mockResolvedValue({
      user_id: 5,
      fname: 'Owner',
      lname: 'Person',
      orcid: '0000-0005-5555-5555',
    })
    const result = await buildAuthorsWithOrcid(project)
    expect(result).toEqual([{ name: 'Owner Person', orcid: '0000-0005-5555-5555' }])
  })

  test('external-only byline: citation names without member match', async () => {
    resetMocks()
    const project = { project_id: 901, user_id: 1, article_authors: 'Only External' }
    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1, orcid_publish_opt_out: 0 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111', orcid_opt_out: 0 },
    ])
    const result = await buildAuthorsWithOrcid(project)
    expect(result).toEqual([{ name: 'Only External' }])
  })

  test('John Smith and someone else: member + external segment', async () => {
    resetMocks()
    const project = { project_id: 900, user_id: 1, article_authors: 'John Smith and someone else' }
    models.ProjectsXUser.findAll.mockResolvedValue([
      { user_id: 1, orcid_publish_opt_out: 0 },
      { user_id: 2, orcid_publish_opt_out: 0 },
    ])
    models.User.findAll.mockResolvedValue([
      { user_id: 1, fname: 'John', lname: 'Smith', orcid: '0000-0001-1111-1111', orcid_opt_out: 0 },
      { user_id: 2, fname: 'Jane', lname: 'Doe', orcid: '0000-0002-2222-2222', orcid_opt_out: 0 },
    ])
    const result = await buildAuthorsWithOrcid(project)
    expect(result).toEqual([
      { name: 'John Smith', orcid: '0000-0001-1111-1111' },
      { name: 'someone else' },
    ])
  })

  test('isUserListedInArticleAuthors substring check', () => {
    const user = { fname: 'Jane', lname: 'Doe' }
    expect(isUserListedInArticleAuthors(user, 'Doe, J.; Smith')).toBe(true)
    expect(isUserListedInArticleAuthors(user, 'No match here')).toBe(false)
  })
})
