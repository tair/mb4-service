import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ProjectDocument extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    document_id: {
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
    upload: {
      type: DataTypes.JSON,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    access: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    published: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    uploaded_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    folder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'project_document_folders',
        key: 'folder_id'
      }
    }
  }, {
    sequelize,
    tableName: 'project_documents',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "document_id" },
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
        name: "fk_project_documents_folder_id",
        using: "BTREE",
        fields: [
          { name: "folder_id" },
        ]
      },
      {
        name: "fk_project_documents_project_id",
        using: "BTREE",
        fields: [
          { name: "project_id" },
        ]
      },
    ]
  });
  }
}
