import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CellBatchLog extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        log_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        matrix_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        started_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        finished_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        batch_type: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Media View Automation
                1, // Media Batch Add
                2, // Media Batch Delete
                3, // Media batch Set Score
                4, // Add Cell Citation
                5, // Cell Batch Notes
                6, // Copy Scores
              ],
            ],
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        reverted: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        reverted_user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'cell_batch_log',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'log_id' }],
          },
          {
            name: 'i_batch_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }, { name: 'user_id' }],
          },
        ],
      }
    )
  }
}
