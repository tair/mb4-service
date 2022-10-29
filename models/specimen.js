import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class Specimen extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    specimen_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      references: {
        model: 'projects',
        key: 'project_id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    institution_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    collection_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    catalog_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    access: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    last_modified_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    reference_source: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    uuid: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    occurrence_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'specimens',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "specimen_id" },
        ]
      },
      {
        name: "i_cat_no",
        using: "BTREE",
        fields: [
          { name: "catalog_number" },
        ]
      },
      {
        name: "i_codes",
        using: "BTREE",
        fields: [
          { name: "institution_code" },
          { name: "collection_code" },
        ]
      },
      {
        name: "i_user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "i_project_id",
        using: "BTREE",
        fields: [
          { name: "project_id" },
        ]
      },
    ]
  });
  }
}
