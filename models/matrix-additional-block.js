import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class MatrixAdditionalBlock extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        block_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'matrices',
            key: 'matrix_id',
          },
        },
        upload_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'matrix_file_uploads',
            key: 'upload_id',
          },
        },
        name: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'matrix_additional_blocks',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'block_id' }],
          },
          {
            name: 'fk_matrix_additional_blocks_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
          {
            name: 'fk_matrix_additional_blocks_upload_id',
            using: 'BTREE',
            fields: [{ name: 'upload_id' }],
          },
        ],
      }
    )
  }
}
