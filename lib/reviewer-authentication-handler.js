import { models } from '../models/init-models.js'

const PATTERNS = [/^Project[ ]*([\d]+)$/, /^P([\d]+)$/, /^([\d]+)$/]

/**
 * A class handles authentication for project reviewers. Each project can set up
 * login so that non-morphobank users can sign into the website soley to view
 * the specific project.
 */
export default class ReviewerAuthenticationHandler {
  canHandle(email) {
    return PATTERNS.some((pattern) => pattern.test(email))
  }

  async handle(email, password) {
    const projectId = getProjectId(email)
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      const error = new Error('Project is does not exist')
      error.statusCode = 401
      throw error
    }

    if (!project.allow_reviewer_login) {
      const error = new Error('Project does not allow anonymous reviewers')
      error.statusCode = 401
      throw error
    }

    const passwordMatch = await models.User.validatePassword(password, project.reviewer_login_password)
    if (!passwordMatch) {
      const error = new Error('Wrong password!')
      error.statusCode = 401
      throw error
    }

    return {
      name: `Project ${projectId}`,
      project_id: projectId,
      is_anonymous: true,
    }
  }
}

function getProjectId(userName) {
  for (const pattern of PATTERNS) {
    const matched = userName.match(pattern)
    if (matched) {
      return matched[1]
    }
  }
  return null
}
