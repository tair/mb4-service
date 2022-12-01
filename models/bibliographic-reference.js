import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class BibliographicReference extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        reference_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        project_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
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
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        article_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        journal_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        monograph_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        authors: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        editors: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        vol: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        num: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        pubyear: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
          max: 3000,
        },
        publisher: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        abstract: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        collation: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        external_identifier: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        secondary_authors: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        article_secondary_title: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        urls: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        worktype: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        edition: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        sect: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        isbn: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        keywords: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        lang: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        electronic_resource_num: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        author_address: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        reference_type: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          isIn: [
            [
              0, // Generic
              1, // Journal Article
              2, // Book
              3, // Book Section
              4, // Manuscript
              5, // Edited Book
              6, // Magazine Artcile
              7, // Newspaper Article
              8, // Conference Proceedings
              9, // Thesis
              10, // Report
              11, // Personal Communication
              13, // Electronic Source
              14, // Audiovisual Material
              16, // Artwork
              17, // Map
            ],
          ],
        },
        place_of_publication: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        project_citation: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
          max: 1,
        },
      },
      {
        sequelize,
        tableName: 'bibliographic_references',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'reference_id' }],
          },
          {
            name: 'fk_bibliographic_references_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
      }
    )
  }
}
