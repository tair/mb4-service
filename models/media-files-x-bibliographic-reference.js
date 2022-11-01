import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class MediaFilesXBibliographicReference extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        reference_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'bibliographic_references',
            key: 'reference_id',
          },
        },
        media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'media_files',
            key: 'media_id',
          },
        },
        pp: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'media_files_x_bibliographic_references',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'u_all',
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'media_id' },
              { name: 'reference_id' },
              { name: 'pp' },
            ],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_media_files_x_bibliographic_references_reference_id',
            using: 'BTREE',
            fields: [{ name: 'reference_id' }],
          },
        ],
      }
    )
  }
}
