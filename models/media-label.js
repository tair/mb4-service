import _sequelize from 'sequelize'
const { Model, Sequelize } = _sequelize

export default class MediaLabel extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        label_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          references: {
            model: 'media_files',
            key: 'media_id',
          },
        },
        link_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        typecode: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        properties: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        table_num: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'media_labels',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'label_id' }],
          },
          {
            name: 'i_link_id',
            using: 'BTREE',
            fields: [{ name: 'link_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_table_num',
            using: 'BTREE',
            fields: [{ name: 'table_num' }],
          },
          {
            name: 'fk_media_labels_media_id',
            using: 'BTREE',
            fields: [{ name: 'media_id' }],
          },
        ],
      }
    )
  }
}
