import _sequelize from 'sequelize'
const { Model } = _sequelize

// TODO(kenzley): This table is no longer needed. This is a parsed values of the
//     columns authors, secondary_authors, editors in the table
//     bibliographic_references. An alternate solution would be to remove this table
//     and set columns as JSON OR delete those columns in favor of this table.
export default class BibliographicAuthor extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        author_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        forename: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        middlename: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        surname: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        institution: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        address: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        reference_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'bibliographic_references',
            key: 'reference_id',
          },
        },
        typecode: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          isIn: [
            [
              0, // Primary author
              1, // Secondary author
              2, // Editor
            ],
          ],
        },
      },
      {
        sequelize,
        tableName: 'bibliographic_authors',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'author_id' }],
          },
          {
            name: 'u_name',
            unique: true,
            using: 'BTREE',
            fields: [
              { name: 'surname' },
              { name: 'middlename' },
              { name: 'forename' },
              { name: 'reference_id' },
              { name: 'typecode' },
            ],
          },
          {
            name: 'fk_bibliographic_authors_reference_id',
            using: 'BTREE',
            fields: [{ name: 'reference_id' }],
          },
        ],
      }
    )
  }
}
