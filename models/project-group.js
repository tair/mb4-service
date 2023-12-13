import _sequelize from 'sequelize'
const { Model } = _sequelize

// TODO(kenzley: Delete this table since Project Groups was never fully
//     implemented and requires more work to support. Morphobank V3 only
//     supported sharing bibliographic references. However, only a few projects
//     are grouped and it's a few citations. We can just copy the citations
//     over and delete this concept from the database.
export default class ProjectGroup extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        group_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'project_groups',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'group_id' }],
          },
          {
            name: 'u_all',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'user_id' }, { name: 'name' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
        ],
      }
    )
  }
}
