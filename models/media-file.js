import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class MediaFile extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        media_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        specimen_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'specimens',
            key: 'specimen_id',
          },
        },
        project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'projects',
            key: 'project_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        media: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        published: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        view_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'media_views',
            key: 'view_id',
          },
        },
        is_copyrighted: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        is_sided: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        copyright_permission: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        copyright_info: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        needs_attention: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        access: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        url: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        url_description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        citation_article_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        citation_journal_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        citation_authors: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        citation_year: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
        },
        citation_volume: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
        },
        citation_number: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
        },
        citation_collation: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        citation_journal_editors: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        citation_publisher: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        copyright_license: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        old_media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        ancestor_media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        in_use_in_matrix: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        cataloguing_status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        eol_id: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        media_type: {
          type: DataTypes.STRING(40),
          allowNull: false,
        },
        uuid: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'media_files',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'media_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_old_media_id',
            using: 'BTREE',
            fields: [{ name: 'old_media_id' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
          {
            name: 'fk_media_files_specimen_id',
            using: 'BTREE',
            fields: [{ name: 'specimen_id' }],
          },
          {
            name: 'fk_media_files_view_id',
            using: 'BTREE',
            fields: [{ name: 'view_id' }],
          },
          {
            name: 'fk_media_files_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
