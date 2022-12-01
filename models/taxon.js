import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class Taxon extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        taxon_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        genus: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        color: {
          type: DataTypes.STRING(6),
          allowNull: false,
          defaultValue: '',
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
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
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        specific_epithet: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        subspecific_epithet: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        scientific_name_author: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        scientific_name_year: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: true,
        },
        supraspecific_clade: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_kingdom: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_phylum: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_class: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_order: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_family: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_superfamily: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_subfamily: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        is_extinct: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        use_parens_for_author: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        higher_taxon_subclass: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        access: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Anyone can edit this taxa
                1, // Only the owner may edit this taxa
              ],
            ],
          },
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        otu: {
          type: DataTypes.STRING(30),
          allowNull: true,
          validate: {
            isIn: [
              [
                'supraspecific_clade',
                'higher_taxon_class',
                'higher_taxon_subclass',
                'higher_taxon_order',
                'higher_taxon_superfamily',
                'higher_taxon_family',
                'higher_taxon_subfamily',
                'genus',
                'specific_epithet',
                'subspecific_epithet',
              ],
            ],
          },
        },
        higher_taxon_suborder: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        source_info: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        tmp_media_url: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        tmp_media_copyright_license: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        tmp_media_copyright_permission: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
        },
        tmp_media_copyright_info: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        eol_pulled_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        eol_set_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        tmp_more_info_link: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        higher_taxon_subtribe: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_tribe: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_infraorder: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_superorder: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_cohort: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        higher_taxon_infraclass: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        subgenus: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        taxon_hash: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        tmp_eol_data: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        source: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: '',
        },
        eol_no_results_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        lookup_failed_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        pbdb_taxon_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        pbdb_pulled_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        idigbio_pulled_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        idigbio_set_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        idigbio_no_results_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        tmp_idigbio_data: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'taxa',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'taxon_id' }],
          },
          {
            name: 'u_all',
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'project_id' },
              { name: 'taxon_hash', length: 16 },
            ],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_higher_taxon_family',
            using: 'BTREE',
            fields: [{ name: 'higher_taxon_family' }],
          },
          {
            name: 'i_higher_taxon_superfamily',
            using: 'BTREE',
            fields: [{ name: 'higher_taxon_superfamily' }],
          },
          {
            name: 'i_subclass',
            using: 'BTREE',
            fields: [{ name: 'higher_taxon_subclass' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
        ],
      }
    )
  }
}
