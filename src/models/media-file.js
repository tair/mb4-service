import _sequelize from 'sequelize'
import { time } from '../util/util.js'
const { Model } = _sequelize

export default class MediaFile extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        media_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
        },
        specimen_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'specimens',
            key: 'specimen_id',
          },
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
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        media: {
          type: DataTypes.JSON,
          allowNull: true,
          media: true,
          volume: 'media',
          shouldLog: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          // TODO(kenzley): Make this field nullable
          defaultValue: '',
        },
        published: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Publish when project is published
                1, // Never publish to project
              ],
            ],
          },
        },
        view_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'media_views',
            key: 'view_id',
          },
        },
        is_copyrighted: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        is_sided: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Not applicable
                1, // Left side
                2, // Right side
              ],
            ],
          },
        },
        copyright_permission: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                0, // Copyright permission not set
                // Person loading media owns copyright and grants permission for
                // use of media on MorphoBank
                1,
                // Permission to use media on MorphoBank granted by copyright
                // holder
                2,
                3, // Permission pending
                4, // Copyright expired or work otherwise in public domain
                5, // Copyright permission not yet requested
              ],
            ],
          },
        },
        copyright_info: {
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
                0, // Anyone may edit this media item
                1, // Only the owner may edit this media item
              ],
            ],
          },
        },
        last_modified_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        created_on: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: time,
          shouldLog: false,
        },
        url: {
          type: DataTypes.TEXT,
          allowNull: false,
          // TODO(kenzley): Make this field nullable
          defaultValue: '',
        },
        url_description: {
          type: DataTypes.TEXT,
          allowNull: false,
          // TODO(kenzley): Make this field nullable
          defaultValue: '',
        },
        copyright_license: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                // Media reuse policy not set
                0,
                // CC0 - relinquish copyright
                1,
                // Attribution CC BY - reuse with attribution
                2,
                // Attribution-NonCommercial CC BY-NC - reuse but noncommercial
                3,
                // Attribution - ShareAlike CC BY - SA - reuse here and applied to
                // future uses
                4,
                // Attribution- CC BY-NC-SA - reuse here and applied to future
                // uses but noncommercial
                5,
                // Attribution-NoDerivs CC BY-ND - reuse but no changes
                6,
                // Attribution-NonCommercial-NoDerivs CC BY-NC-ND - reuse
                // noncommerical no changes
                7,
                // Media released for onetime use, no reuse without permission
                8,
                // Unknown - Will set before project publication
                20,
              ],
            ],
          },
        },
        ancestor_media_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          ancestored: true,
        },
        in_use_in_matrix: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: true,
        },
        cataloguing_status: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          validate: {
            isIn: [
              [
                // Available in main search
                0,
                // Recently uploaded batch - needs to be curated before being
                // released to general media pool
                1,
              ],
            ],
          },
        },
        eol_id: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        // TODO(kenzley): Remove this column. We can determine the type from the mime type.
        media_type: {
          type: DataTypes.STRING(40),
          allowNull: false,
          validate: {
            isIn: [['audio', 'video', 'image', '3d']],
          },
        },
        uuid: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'media_files',
        timestamps: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'media_id' }],
          },
          {
            name: 'i_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }],
          },
          {
            name: 'i_created_on',
            using: 'BTREE',
            fields: [{ name: 'created_on' }],
          },
          {
            name: 'fk_media_files_specimen_id',
            using: 'BTREE',
            fields: [{ name: 'specimen_id' }],
          },
          {
            name: 'fk_media_files_view_id',
            using: 'BTREE',
            fields: [{ name: 'view_id' }],
          },
          {
            name: 'fk_media_files_project_id',
            using: 'BTREE',
            fields: [{ name: 'project_id' }],
          },
        ],
        hooks: {
          beforeUpdate: (mediaFile) => {
            mediaFile.last_modified_on = time()
          },
        },
      }
    )
  }

  static getSideRepresentation(isSided) {
    const valueMap = ['not applicable', 'left side', 'right side', 'not entered']
    return valueMap[isSided]
  }

  static getCopyrightPermission(permission) {
    const valueMap = [
      'Copyright permission not set',
      'Person loading media owns copyright and grants permission for use of media on MorphoBank',
      'Permission to use media on MorphoBank granted by copyright holder',
      'Permission pending',
      'Copyright expired or work otherwise in public domain',
      'Copyright permission not yet requested',
    ]
    return valueMap[permission]
  }

  static getLicenseImage(isCopyrighted, permission, license) {
    let response = {
      isOneTimeUse: false,
      image: null,
    }
    const licenseMap = {
      1: 'CC-0.png',
      2: 'CC-BY.png',
      3: 'CC-BY-NC.png',
      4: 'CC-BY-SA.png',
      5: 'CC-BY-NC-SA.png',
      6: 'CC-BY-ND.png',
      7: 'CC-BY-NC-ND.png',
    }

    if (isCopyrighted) {
      if (permission == 4) {
        response.image = 'PDM.png'
      } else if (license > 0 && license < 8) {
        response.image = licenseMap[license]
      } else if (license == 8) {
        response.isOneTimeUse = true
      }
    } else {
      response.image = 'CC-0.png'
    }
    return response
  }
}
