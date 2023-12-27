import sequelizeConn from '../../util/db.js'
import { Handler } from './handler.js'
import { ProjectOverviewGenerator } from '../project-overview-generator.js'

/**
 * Handler that generates the project overview stats for a given set of
 * projects.
 */
export class ProjectOverviewGenerationHandler extends Handler {
  async process(parameters) {
    const projectIds = parameters.project_ids
    const [projects] = await sequelizeConn.query(
      `
      SELECT
        project_id, user_id, published, 
        publish_matrix_media_only, publish_inactive_members
      FROM projects
      WHERE project_id IN (?)`,
      {
        replacements: [projectIds],
      }
    )
    const overviewGenerator = new ProjectOverviewGenerator()

    for (const project of projects) {
      await overviewGenerator.generateStats(project)
    }

    return {
      result: {
        length: projects.length,
      },
    }
  }

  getName() {
    return 'ProjectOverview'
  }
}
