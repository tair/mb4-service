import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class CipresRequest extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        request_id: {
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
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        last_updated_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        cipres_job_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        cipres_last_status: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        cipres_tool: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        input_file: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        output_file: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        cipres_settings: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        jobname: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'cipres_requests',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'request_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_cipres_job_id',
            using: 'BTREE',
            fields: [{ name: 'cipres_job_id' }],
          },
          {
            name: 'fk_cipres_requests_matrix_id',
            using: 'BTREE',
            fields: [{ name: 'matrix_id' }],
          },
        ],
      }
    )
  }
}
