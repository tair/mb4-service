import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class AnnotationEvent extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        event_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        annotation_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'annotations',
            key: 'annotation_id',
          },
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        date_time: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
        },
        typecode: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          isIn: [[0]], // Opened.
        },
      },
      // TODO(kenzley): Consider adding a constraint on the annotation_id and
      //    user_id columns since duplicates are unnecessary.
      {
        sequelize,
        tableName: 'annotation_events',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'event_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'fk_annotation_events_annotation_id',
            using: 'BTREE',
            fields: [{ name: 'annotation_id' }],
          },
        ],
      }
    )
  }
}
