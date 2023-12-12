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
          type: DataTypes.JSON,
          allowNull: false,
        },
        editors: {
          type: DataTypes.JSON,
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
          type: DataTypes.JSON,
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

  static getCitationText(record, modelInstance) {
    let titles = {};
    let fields = [
      'article_title', 'journal_title', 'authors', 'secondary_authors',
      'editors', 'publisher', 'place_of_publication', 'vol', 'num', 'sect',
      'edition', 'collation'
    ];
    
    if (record) {
      fields.forEach(field => {
        if (field === 'authors' || field === 'secondary_authors' || field === 'editors') {
          record[field] = record[field] || [];
        } else {
          record[field] = record[field]?.trim();
          if (field === 'article_title' || field === 'journal_title') {
              if (record[field]) titles[field] = record[field];
          }
        }
      });
    } else if (modelInstance) {
      fields.forEach(field => {
        if (field === 'authors' || field === 'secondary_authors' || field === 'editors') {
          record[field] = modelInstance.get(field) || [];
      } else {
          record[field] = modelInstance.get(field)?.trim();
          if (field === 'article_title' || field === 'journal_title') {
              if (record[field]) titles[field] = record[field];
          }
        }
      });
    }

    let citation = '';
    let authors = BibliographicReference.formatAuthors([...record.authors, ...record.secondary_authors]);

    if (authors) {
        citation += authors + (authors.endsWith('.') ? ' ' : '. ');
    }
    if (record.pubyear) {
        citation += record.pubyear + '. ';
    }

    Object.keys(titles).forEach(type => {
        if (type === 'journal_title') {
            citation += ([5, 3, 2].includes(record.reference_type) ? 'In ' : '') + `<em>${titles[type]}</em>`;
        } else {
            citation += titles[type];
        }
        if (!titles[type].endsWith('.')) {
            citation += '.';
        }
        citation += ' ';
    });

    if (record.vol) {
        citation += 'Vol. ' + record.vol;
    }

    if (record.num) {
        citation += '(' + record.num + ')';
    }

    if (record.collation) {
        citation += (record.vol ? ', ' : ' ') + (/[,\-]/.test(record.collation) ? ' pp. ' : ' p. ') + record.collation;
    }

    const editors = BibliographicReference.formatAuthors(record.editors);
    if (editors) {
        citation += (record.collation ? ', ' : ' in ') + editors + ' <i>ed</i>. ';
    }

    if (record.sect) {
        citation += ' Section: ' + record.sect + '. ';
    }
    if (record.edition) {
        citation += ' Edition: ' + record.edition + '. ';
    }

    if (record.publisher) {
        citation += record.publisher;
    }
    if (record.place_of_publication) {
        citation += (record.publisher ? ',' : '') + ' ' + record.place_of_publication + '. ';
    } else {
        if (record.publisher) {
            citation += '. ';
        }
    }

    return citation;
  }

  static formatAuthors(authors) {
    let tmp = [];
    for (let author of authors) {
        let name = [];
        
        if (author.surname) {
            name.push(author.surname);
        }

        let forename = author.forename;
        let middlename = author.middlename;
        
        if (forename || middlename) {
            let startNames = [];
            
            if (forename) {
                startNames.push(forename.length === 1 ? `${forename}.` : forename);
            }
            
            if (middlename) {
                startNames.push(middlename.length === 1 ? `${middlename}.` : middlename);
            }
            
            name.push(startNames.join(' '));
        }

        tmp.push(name.join(', '));
    }

    let lastAuthor = tmp.pop();
    let formattedAuthors;
    if (tmp.length) {
      formattedAuthors = tmp.join(', ') + ' and ' + lastAuthor;
    } else {
      formattedAuthors = lastAuthor;
    }

    return formattedAuthors;
  }

// Usage:
// const citationText = await getCitationText(record, modelInstance);

}
