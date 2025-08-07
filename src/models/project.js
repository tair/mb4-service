import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class Project extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        project_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        published: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Unpublished
                1, // Published
              ],
            ],
          },
        },
        deleted: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        last_accessed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        journal_title: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        journal_url: {
          type: DataTypes.STRING(2048),
          allowNull: true,
        },
        journal_volume: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        journal_number: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        journal_cover: {
          type: DataTypes.JSON,
          allowNull: true,
          media: true,
        },
        journal_year: {
          type: DataTypes.STRING(80),
          allowNull: true,
        },
        article_authors: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        article_title: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        article_pp: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        allow_reviewer_login: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        reviewer_login_password: {
          type: DataTypes.STRING(60),
          allowNull: true,
        },
        // TODO(kenzley); Delete this field when we move over to V4.
        group_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'project_groups',
            key: 'group_id',
          },
        },
        publish_character_comments: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_cell_comments: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_change_logs: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_cell_notes: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_character_notes: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_media_notes: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        publish_inactive_members: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1,
        },
        exemplar_image: {
          type: DataTypes.JSON,
          allowNull: true,
          media: true,
        },
        exemplar_caption: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        published_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        featured: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        exemplar_media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        partition_published_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        partitioned_from_project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        ancestor_project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          ancestored: true,
        },
        publish_matrix_media_only: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        publish_cc0: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        article_doi: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        project_doi: {
          type: DataTypes.STRING(32),
          allowNull: true,
        },
        nsf_funded: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // No
                1, // Yes
              ],
            ],
          },
        },
        disk_usage: {
          type: DataTypes.BIGINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        disk_usage_limit: {
          type: DataTypes.BIGINT.UNSIGNED,
          allowNull: false,
          defaultValue: 5 * 1024 * 1024 * 1024,
        },
        journal_in_press: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Published
                1, // In Press
                2, // Article i prep or in review
              ],
            ],
          },
        },
        extinct_taxa_identified: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        eol_taxon_ids: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        idigbio_taxon_ids: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        no_personal_identifiable_info: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'projects',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
          {
            name: 'i_deleted',
            using: 'BTREE',
            fields: [{ name: 'deleted' }],
          },
          {
            name: 'fk_projects_group_id',
            using: 'BTREE',
            fields: [{ name: 'group_id' }],
          },
        ],
      }
    )
  }

  /**
   * Update both project-level and user-level last_accessed_on timestamps
   * Following the design specification from the original MorphoBank system
   * @param {number} userId - The user ID accessing the project
   * @param {boolean} isProjectOwner - Whether the user is the project owner
   * @param {Object} user - The user object for changelog hooks
   * @returns {Promise<boolean>} - Returns true on success, false on error
   */
  async setUserAccessTime(userId, isProjectOwner = false, user = null) {
    if (!this.project_id) {
      return false
    }

    const currentTime = Math.floor(Date.now() / 1000) // Unix timestamp in seconds

    // SMART THROTTLING: Only update if it's a different day (UTC)
    // Since UI only shows date (not time), multiple updates per day are wasteful
    // This reduces DB writes from ~500/min to ~5/min while maintaining perfect UX
    const lastAccessDate = new Date((this.last_accessed_on || 0) * 1000)
    const currentDate = new Date(currentTime * 1000)

    // Compare dates in UTC to avoid timezone issues
    const lastAccessDay = lastAccessDate.getUTCDate()
    const lastAccessMonth = lastAccessDate.getUTCMonth()
    const lastAccessYear = lastAccessDate.getUTCFullYear()

    const currentDay = currentDate.getUTCDate()
    const currentMonth = currentDate.getUTCMonth()
    const currentYear = currentDate.getUTCFullYear()

    const isSameDay =
      lastAccessYear === currentYear &&
      lastAccessMonth === currentMonth &&
      lastAccessDay === currentDay

    if (isSameDay && this.last_accessed_on > 0) {
      // Skip update - same day, return true to indicate "success"
      return true
    }

    const { models } = await import('./init-models.js')

    try {
      // Always update project-level access time
      this.last_accessed_on = currentTime

      // Save with user object for changelog hook, but disable logging for access time updates
      await this.save({
        user: user,
        shouldSkipLogChange: true,
      })

      // Find the project-user relationship
      const projectUser = await models.ProjectsXUser.findOne({
        where: {
          user_id: userId,
          project_id: this.project_id,
        },
      })

      // Update user-specific access time if they are a project member
      if (projectUser) {
        projectUser.last_accessed_on = currentTime
        await projectUser.save({
          user: user,
          shouldSkipLogChange: true,
        })
      } else if (isProjectOwner) {
        // If user is project owner but not in projects_x_users table,
        // this might be an inconsistency, but we still update project level
        console.warn(
          `Project owner ${userId} not found in projects_x_users for project ${this.project_id}`
        )
      }

      return true
    } catch (error) {
      console.error('Error updating user access time:', error)
      return false
    }
  }
}
