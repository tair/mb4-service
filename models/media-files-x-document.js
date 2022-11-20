import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class MediaFilesXDocument extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        link_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        document_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'project_documents',
            key: 'document_id',
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
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'media_files_x_documents',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'NoDoubleDocument',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'media_id' }, { name: 'document_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_media_files_x_documents_document_id',
            using: 'BTREE',
            fields: [{ name: 'document_id' }],
          },
        ],
      }
    )
  }
}
