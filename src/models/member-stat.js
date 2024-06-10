import _sequelize from 'sequelize'
const { Model } = _sequelize

export default class MemberStat extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        project_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        member_name: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        fname_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        administrator: {
            type: DataTypes.TINYINT,
            allowNull: false,
        },
        membership_status: {
            type: DataTypes.TINYINT,
            allowNull: false,
        },
        member_email: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        membership_role: {
            type: DataTypes.TINYINT,
            allowNull: false,
        },
        last_access: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        taxa: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        specimens: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        media: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        media_notes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        characters: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        character_comments: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        character_notes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        character_media: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        character_media_labels: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_scorings: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_scorings_scored: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_scorings_npa: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_scoring_not: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_comments: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_notes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_media: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        cell_media_labels: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        rules: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        warnings: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'member_stats',
        timestamps: true,
        
      }
    )
  }
}
