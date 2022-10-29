import _sequelize from 'sequelize';
const { Model } = _sequelize;

export default class CuratorPotentialProject extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    potential_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'project_id'
      },
      unique: "fk_projects_project_id"
    },
    owner_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    owner_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    journal_title: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      defaultValue: ""
    },
    journal_url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    journal_volume: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    journal_number: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    journal_in_press: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    journal_year: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    article_title: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    article_authors: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    article_pp: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    article_doi: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    pages: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    publication_date: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    last_modified: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    approved_on: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    approved_by_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'ca_users',
        key: 'user_id'
      }
    },
    checklist_project_published: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_citation_listed: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_exemplar_entered: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_exemplar_affiliated: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_species_spelled_in_full: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_enough_media: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_extinct_taxa_present: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    checklist_project_tweeted: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ""
    },
    checklist_publication_is_url_listed: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'curator_potential_projects',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "potential_id" },
        ]
      },
      {
        name: "u_project_id",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "project_id" },
        ]
      },
      {
        name: "fk_projects_approved_by_id",
        using: "BTREE",
        fields: [
          { name: "approved_by_id" },
        ]
      },
      {
        name: "i_project_id",
        using: "BTREE",
        fields: [
          { name: "project_id" },
        ]
      },
      {
        name: "i_created_on",
        using: "BTREE",
        fields: [
          { name: "created_on" },
        ]
      },
      {
        name: "i_last_modified",
        using: "BTREE",
        fields: [
          { name: "last_modified" },
        ]
      },
      {
        name: "i_status",
        using: "BTREE",
        fields: [
          { name: "status" },
        ]
      },
    ]
  });
  }
}
