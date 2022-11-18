import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class Folio extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        folio_id: {
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
          allowNull: true,
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
        published: {
          type: DataTypes.TINYINT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'folios',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'folio_id' }],
          },
          {
            name: 'fk_folios_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
