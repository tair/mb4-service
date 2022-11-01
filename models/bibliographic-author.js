import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

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
