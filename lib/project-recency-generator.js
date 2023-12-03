import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'

export class ProjectRecencyStatisticsGenerator {
  async getOutdatedProjects() {
    const [projects] = await sequelizeConn.query(`
      SELECT p.project_id
      FROM projects p
      WHERE
        p.deleted = 0 AND
        p.published = 0 AND
        (SELECT MIN(pxu.project_id) FROM projects_x_users pxu WHERE pxu.project_id = p.project_id) IS NOT NULL AND
        (
          p.last_accessed_on > (SELECT MIN(generated_on) FROM stats_user_overview suo WHERE suo.project_id = p.project_id) OR
          (SELECT MIN(generated_on) FROM stats_user_overview suo WHERE suo.project_id = p.project_id) IS NULL
        )`)
    return projects
  }

  async generateStats(projectId) {
    const transaction = await sequelizeConn.transaction()
    const getAllTimes = async (sql) => {
      const [results] = await sequelizeConn.query(sql, {
        replacements: [projectId],
        transaction,
      })
      return results.map((result) => parseInt(result.time)).sort()
    }

    const taxaTimes = await getAllTimes(
      `SELECT last_modified_on AS time FROM taxa WHERE project_id = ?`
    )
    const specimensTimes = await getAllTimes(
      `SELECT last_modified_on AS time FROM specimens WHERE project_id = ?`
    )
    const mediaTimes = await getAllTimes(
      `SELECT last_modified_on AS time FROM media_files WHERE project_id = ?`
    )
    const charactersTimes = await getAllTimes(
      `SELECT last_modified_on AS time FROM characters WHERE project_id = ?`
    )
    const characterCommentsTimes = await getAllTimes(`
      SELECT a.created_on AS time
			FROM annotations a
			INNER JOIN characters AS c ON c.character_id = a.row_id
			WHERE c.project_id = ? AND a.table_num = 3`)
    const stateCommentsTimes = await getAllTimes(`
      SELECT a.created_on AS time
			FROM annotations a
			INNER JOIN character_states AS cs ON cs.state_id = a.row_id
			INNER JOIN characters AS c ON c.character_id = cs.character_id
			WHERE c.project_id = ? AND a.table_num = 4`)
    const characterNotesTimes = await getAllTimes(`
      SELECT last_modified_on AS time
			FROM characters
			WHERE project_id = ? AND description <> ''`)
    const characterMediaTimes = await getAllTimes(`
      SELECT cxm.created_on AS time
			FROM media_files mf
			INNER JOIN characters_x_media AS cxm ON mf.media_id = cxm.media_id
			INNER JOIN characters AS c ON c.character_id = cxm.character_id
			WHERE mf.project_id = ?`)
    const characterMediaLabelsTimes = await getAllTimes(`
      SELECT ml.created_on AS time
			FROM media_labels ml
			INNER JOIN characters_x_media AS cxm ON ml.link_id = cxm.link_id
			INNER JOIN characters AS c ON cxm.character_id = c.character_id
			WHERE c.project_id = ? AND ml.table_num = 16`)
    const cellScoresTimes = await getAllTimes(`
      SELECT MAX(c.last_modified_on) AS time
			FROM cells c
			INNER JOIN matrices AS m ON m.matrix_id = c.matrix_id
			WHERE m.project_id = ?
			GROUP BY c.character_id, c.taxon_id`)
    const cellCommentsTimes = await getAllTimes(`
      SELECT MAX(a.created_on) AS time
			FROM annotations a
			INNER JOIN matrices AS m ON a.row_id = m.matrix_id
			WHERE m.project_id = ? AND a.table_num = 5
			GROUP BY a.annotation_id`)
    const cellNotesTimes = await getAllTimes(`
      SELECT cn.last_modified_on AS time
			FROM cell_notes cn
			INNER JOIN matrices AS m ON cn.matrix_id = m.matrix_id
			WHERE m.project_id = ? AND cn.notes <> ''`)
    const characterRulesTimes = await getAllTimes(`
      SELECT cr.created_on AS time
			FROM character_rules cr
			INNER JOIN characters AS c ON cr.character_id = c.character_id
			WHERE c.project_id = ?`)
    const documentsTimes = await getAllTimes(`
      SELECT uploaded_on AS time
			FROM project_documents
			WHERE project_id = ?`)
    const referencesTimes = await getAllTimes(`
      SELECT created_on AS time
			FROM bibliographic_references
			WHERE project_id = ?`)

    const [users] = await sequelizeConn.query(
      `
      SELECT DISTINCT user_id, last_accessed_on
      FROM projects_x_users
      WHERE project_id = ?`,
      { replacements: [projectId], transaction }
    )

    const currentTime = time()
    const stats = []
    for (const user of users) {
      const userId = user.user_id
      const lastAccessedTime = user.last_accessed_on || 0
      for (const [temporalType, timeOffset] of Object.entries(WINDOWS)) {
        const fromTime = lastAccessedTime - timeOffset
        stats.push([
          projectId,
          userId,
          temporalType,
          lastAccessedTime,
          currentTime,
          getCount(taxaTimes, fromTime),
          getCount(specimensTimes, fromTime),
          getCount(mediaTimes, fromTime),
          getCount(charactersTimes, fromTime),
          getCount(characterCommentsTimes, fromTime) +
            getCount(stateCommentsTimes, fromTime),
          getCount(characterNotesTimes, fromTime),
          getCount(characterMediaTimes, fromTime),
          getCount(characterMediaLabelsTimes, fromTime),
          getCount(cellScoresTimes, fromTime),
          getCount(cellCommentsTimes, fromTime),
          getCount(cellNotesTimes, fromTime),
          getCount(characterRulesTimes, fromTime),
          getCount(documentsTimes, fromTime),
          getCount(referencesTimes, fromTime),
        ])
      }
    }

    if (stats.length == 0) {
      return
    }

    await sequelizeConn.query(
      `DELETE FROM stats_user_overview WHERE project_id = ?`,
      { replacements: [projectId], transaction }
    )

    await sequelizeConn.query(
      `
      INSERT INTO stats_user_overview (
			  project_id, user_id, temporal_type, last_accessed_on, generated_on,
        taxa, specimens, media, characters, character_comments, character_notes,
        character_media, character_media_labels, cell_scorings, cell_comments,
        cell_notes, rules, documents, citations)
			VALUES ?`,
      { replacements: [stats], transaction }
    )

    await transaction.commit()
  }
}

/**
 * The window of time since the last time the user logged out. The keys are the
 * temporal type which are integers and are stored in the database. The values
 * are days total seconds which should be subtracted from users' last logout
 * time.
 */
const WINDOWS = {
  1: 0, // Since last Logout
  2: 24 * 60 * 60, // Past 24 Hours
  3: 7 * 24 * 60 * 60, // Past Week
  4: 30 * 24 * 60 * 60, // Past Month
}

/**
 * This function finds the total number of values in the array which are greater than
 * the specified time.
 */
function getCount(times, fromTime) {
  let left = 0
  let right = times.length
  while (left + 1 < right) {
    let middle = (left + right) >> 1
    if (times[middle] <= fromTime) {
      left = middle
    } else {
      right = middle
    }
  }
  return times.length - right
}
