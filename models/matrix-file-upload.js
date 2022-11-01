import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class MatrixFileUpload extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        upload_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        upload: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        comments: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        item_note: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        uploaded_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        matrix_note: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        otu: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        format: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'matrix_file_uploads',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'upload_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_matrix_file_uploads_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
        ],
      }
    )
  }
}
