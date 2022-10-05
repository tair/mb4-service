import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class InstitutionsXProject extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    link_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'project_id'
      }
    },
    institution_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'institutions',
        key: 'institution_id'
      }
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'institutions_x_projects',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "link_id" },
        ]
      },
      {
        name: "projects_x_institution_unique",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "project_id" },
          { name: "institution_id" },
        ]
      },
      {
        name: "institution_id",
        using: "BTREE",
        fields: [
          { name: "institution_id" },
        ]
      },
    ]
  });
  }
}
