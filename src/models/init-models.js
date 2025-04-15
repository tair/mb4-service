import _sequelize from 'sequelize'
const DataTypes = _sequelize.DataTypes
import _AnnotationEvent from './annotation-event.js'
import _Annotation from './annotation.js'
import _BibliographicAuthor from './bibliographic-author.js'
import _BibliographicReference from './bibliographic-reference.js'
import _CellBatchLog from './cell-batch-log.js'
import _CellNote from './cell-note.js'
import _Cell from './cell.js'
import _CellsXBibliographicReference from './cells-x-bibliographic-reference.js'
import _CellsXMedium from './cells-x-medium.js'
import _CharacterOrdering from './character-ordering.js'
import _CharacterRuleAction from './character-rule-action.js'
import _CharacterRule from './character-rule.js'
import _CharacterState from './character-state.js'
import _Character from './character.js'
import _CharactersXBibliographicReference from './characters-x-bibliographic-reference.js'
import _CharactersXMedium from './characters-x-medium.js'
import _CharactersXPartition from './characters-x-partition.js'
import _CipresRequest from './cipres-request.js'
import _CurationRequest from './curation-request.js'
import _CuratorPotentialProject from './curator-potential-project.js'
import _Folio from './folio.js'
import _FoliosXMediaFile from './folios-x-media-file.js'
import _Institution from './institution.js'
import _InstitutionsXProject from './institutions-x-project.js'
import _InstitutionsXUser from './institutions-x-user.js'
import _Matrix from './matrix.js'
import _MatrixAdditionalBlock from './matrix-additional-block.js'
import _MatrixCharacterOrder from './matrix-character-order.js'
import _MatrixFileUpload from './matrix-file-upload.js'
import _MatrixTaxaOrder from './matrix-taxa-order.js'
import _MediaFile from './media-file.js'
import _MediaFilesXBibliographicReference from './media-files-x-bibliographic-reference.js'
import _MediaFilesXDocument from './media-files-x-document.js'
import _MediaLabel from './media-label.js'
import _MediaView from './media-view.js'
import _Partition from './partition.js'
import _ProjectDocumentFolder from './project-document-folder.js'
import _ProjectDocument from './project-document.js'
import _ProjectDuplicationRequest from './project-duplication-request.js'
import _ProjectGroup from './project-group.js'
import _ProjectMemberGroup from './project-member-group.js'
import _ProjectMembersXGroup from './project-members-x-group.js'
import _Project from './project.js'
import _ProjectsXUser from './projects-x-user.js'
import _Specimen from './specimen.js'
import _SpecimensXBibliographicReference from './specimens-x-bibliographic-reference.js'
import _TaskQueue from './task-queue.js'
import _TaxaXBibliographicReference from './taxa-x-bibliographic-reference.js'
import _TaxaXMedium from './taxa-x-medium.js'
import _TaxaXPartition from './taxa-x-partition.js'
import _TaxaXSpecimen from './taxa-x-specimen.js'
import _Taxon from './taxon.js'
import _User from './user.js'
import _UserRole from './user-role.js'
import _UsersXRole from './users-x-role.js'
import _FeaturedProject from './featured-project.js'
import _MatrixImage from './matrix-image.js'
import _Announcement from './announcement.js'
import _Tool from './tool.js'
import _Press from './press.js'
import _ApplicationVar from './application-var.js'
import sequelizeConn from '../util/db.js'
import { logCellChange } from './hooks/cell-hooks.js'
import { logChange } from './hooks/changelog-hook.js'
import { logCharacterChange } from './hooks/character-hooks.js'
import { fileChanged, fileDeleted } from './hooks/file-hooks.js'

function initModels(sequelizeConn) {
  const AnnotationEvent = _AnnotationEvent.init(sequelizeConn, DataTypes)
  const Annotation = _Annotation.init(sequelizeConn, DataTypes)
  const BibliographicAuthor = _BibliographicAuthor.init(
    sequelizeConn,
    DataTypes
  )
  const BibliographicReference = _BibliographicReference.init(
    sequelizeConn,
    DataTypes
  )
  const CellBatchLog = _CellBatchLog.init(sequelizeConn, DataTypes)
  const CellNote = _CellNote.init(sequelizeConn, DataTypes)
  const Cell = _Cell.init(sequelizeConn, DataTypes)
  const CellsXBibliographicReference = _CellsXBibliographicReference.init(
    sequelizeConn,
    DataTypes
  )
  const CellsXMedium = _CellsXMedium.init(sequelizeConn, DataTypes)
  const CharacterOrdering = _CharacterOrdering.init(sequelizeConn, DataTypes)
  const CharacterRuleAction = _CharacterRuleAction.init(
    sequelizeConn,
    DataTypes
  )
  const CharacterRule = _CharacterRule.init(sequelizeConn, DataTypes)
  const CharacterState = _CharacterState.init(sequelizeConn, DataTypes)
  const Character = _Character.init(sequelizeConn, DataTypes)
  const CharactersXBibliographicReference =
    _CharactersXBibliographicReference.init(sequelizeConn, DataTypes)
  const CharactersXMedium = _CharactersXMedium.init(sequelizeConn, DataTypes)
  const CharactersXPartition = _CharactersXPartition.init(
    sequelizeConn,
    DataTypes
  )
  const CipresRequest = _CipresRequest.init(sequelizeConn, DataTypes)
  const CurationRequest = _CurationRequest.init(sequelizeConn, DataTypes)
  const CuratorPotentialProject = _CuratorPotentialProject.init(
    sequelizeConn,
    DataTypes
  )
  const Folio = _Folio.init(sequelizeConn, DataTypes)
  const FoliosXMediaFile = _FoliosXMediaFile.init(sequelizeConn, DataTypes)
  const Institution = _Institution.init(sequelizeConn, DataTypes)
  const InstitutionsXProject = _InstitutionsXProject.init(
    sequelizeConn,
    DataTypes
  )
  const InstitutionsXUser = _InstitutionsXUser.init(sequelizeConn, DataTypes)
  const Matrix = _Matrix.init(sequelizeConn, DataTypes)
  const MatrixAdditionalBlock = _MatrixAdditionalBlock.init(
    sequelizeConn,
    DataTypes
  )
  const MatrixCharacterOrder = _MatrixCharacterOrder.init(
    sequelizeConn,
    DataTypes
  )
  const MatrixFileUpload = _MatrixFileUpload.init(sequelizeConn, DataTypes)
  const MatrixTaxaOrder = _MatrixTaxaOrder.init(sequelizeConn, DataTypes)
  const MediaFile = _MediaFile.init(sequelizeConn, DataTypes)
  const MediaFilesXBibliographicReference =
    _MediaFilesXBibliographicReference.init(sequelizeConn, DataTypes)
  const MediaFilesXDocument = _MediaFilesXDocument.init(
    sequelizeConn,
    DataTypes
  )
  const MediaLabel = _MediaLabel.init(sequelizeConn, DataTypes)
  const MediaView = _MediaView.init(sequelizeConn, DataTypes)
  const Partition = _Partition.init(sequelizeConn, DataTypes)
  const ProjectDocumentFolder = _ProjectDocumentFolder.init(
    sequelizeConn,
    DataTypes
  )
  const ProjectDocument = _ProjectDocument.init(sequelizeConn, DataTypes)
  const ProjectDuplicationRequest = _ProjectDuplicationRequest.init(
    sequelizeConn,
    DataTypes
  )
  const ProjectGroup = _ProjectGroup.init(sequelizeConn, DataTypes)
  const ProjectMemberGroup = _ProjectMemberGroup.init(sequelizeConn, DataTypes)
  const ProjectMembersXGroup = _ProjectMembersXGroup.init(
    sequelizeConn,
    DataTypes
  )
  const Project = _Project.init(sequelizeConn, DataTypes)
  const ProjectsXUser = _ProjectsXUser.init(sequelizeConn, DataTypes)
  const Specimen = _Specimen.init(sequelizeConn, DataTypes)
  const SpecimensXBibliographicReference =
    _SpecimensXBibliographicReference.init(sequelizeConn, DataTypes)
  const TaskQueue = _TaskQueue.init(sequelizeConn, DataTypes)
  const TaxaXBibliographicReference = _TaxaXBibliographicReference.init(
    sequelizeConn,
    DataTypes
  )
  const TaxaXMedium = _TaxaXMedium.init(sequelizeConn, DataTypes)
  const TaxaXPartition = _TaxaXPartition.init(sequelizeConn, DataTypes)
  const TaxaXSpecimen = _TaxaXSpecimen.init(sequelizeConn, DataTypes)
  const Taxon = _Taxon.init(sequelizeConn, DataTypes)
  const User = _User.init(sequelizeConn, DataTypes)
  const UserRole = _UserRole.init(sequelizeConn, DataTypes)
  const UsersXRole = _UsersXRole.init(sequelizeConn, DataTypes)
  const FeaturedProject = _FeaturedProject.init(sequelizeConn, DataTypes)
  const MatrixImage = _MatrixImage.init(sequelizeConn, DataTypes)
  const Announcement = _Announcement.init(sequelizeConn, DataTypes)
  const Tool = _Tool.init(sequelizeConn, DataTypes)
  const Press = _Press.init(sequelizeConn, DataTypes)
  const ApplicationVar = _ApplicationVar.init(sequelizeConn, DataTypes)

  AnnotationEvent.belongsTo(Annotation, {
    as: 'annotation',
    foreignKey: 'annotation_id',
  })
  Annotation.hasMany(AnnotationEvent, {
    as: 'annotation_events',
    foreignKey: 'annotation_id',
  })
  BibliographicAuthor.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(BibliographicAuthor, {
    as: 'bibliographic_authors',
    foreignKey: 'reference_id',
  })
  CellsXBibliographicReference.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(CellsXBibliographicReference, {
    as: 'cells_x_bibliographic_references',
    foreignKey: 'reference_id',
  })
  CharactersXBibliographicReference.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(CharactersXBibliographicReference, {
    as: 'characters_x_bibliographic_references',
    foreignKey: 'reference_id',
  })
  MediaFilesXBibliographicReference.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(MediaFilesXBibliographicReference, {
    as: 'media_files_x_bibliographic_references',
    foreignKey: 'reference_id',
  })
  SpecimensXBibliographicReference.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(SpecimensXBibliographicReference, {
    as: 'specimens_x_bibliographic_references',
    foreignKey: 'reference_id',
  })
  TaxaXBibliographicReference.belongsTo(BibliographicReference, {
    as: 'reference',
    foreignKey: 'reference_id',
  })
  BibliographicReference.hasMany(TaxaXBibliographicReference, {
    as: 'taxa_x_bibliographic_references',
    foreignKey: 'reference_id',
  })
  UsersXRole.belongsTo(UserRole, { as: 'role', foreignKey: 'role_id' })
  UserRole.hasMany(UsersXRole, {
    as: 'ca_users_x_roles',
    foreignKey: 'role_id',
  })
  UsersXRole.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
  User.hasMany(UsersXRole, { as: 'ca_users_x_roles', foreignKey: 'user_id' })
  CuratorPotentialProject.belongsTo(User, {
    as: 'approved_by',
    foreignKey: 'approved_by_id',
  })
  User.hasMany(CuratorPotentialProject, {
    as: 'curator_potential_projects',
    foreignKey: 'approved_by_id',
  })
  InstitutionsXUser.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
  User.hasMany(InstitutionsXUser, {
    as: 'institutions_x_users',
    foreignKey: 'user_id',
  })
  User.belongsToMany(Institution, {
    through: InstitutionsXUser,
    foreignKey: 'user_id',
    otherKey: 'institution_id',
    as: 'institutions',
  })
  CharacterRuleAction.belongsTo(CharacterRule, {
    as: 'rule',
    foreignKey: 'rule_id',
  })
  CharacterRule.hasMany(CharacterRuleAction, {
    as: 'character_rule_actions',
    foreignKey: 'rule_id',
  })
  Cell.belongsTo(CharacterState, { as: 'state', foreignKey: 'state_id' })
  CharacterState.hasMany(Cell, { as: 'cells', foreignKey: 'state_id' })
  CharacterRuleAction.belongsTo(CharacterState, {
    as: 'state',
    foreignKey: 'state_id',
  })
  CharacterState.hasMany(CharacterRuleAction, {
    as: 'character_rule_actions',
    foreignKey: 'state_id',
  })
  CharacterRule.belongsTo(CharacterState, {
    as: 'state',
    foreignKey: 'state_id',
  })
  CharacterState.hasMany(CharacterRule, {
    as: 'character_rules',
    foreignKey: 'state_id',
  })
  CharactersXMedium.belongsTo(CharacterState, {
    as: 'state',
    foreignKey: 'state_id',
  })
  CharacterState.hasMany(CharactersXMedium, {
    as: 'characters_x_media',
    foreignKey: 'state_id',
  })
  CellNote.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CellNote, {
    as: 'cell_notes',
    foreignKey: 'character_id',
  })
  Cell.belongsTo(Character, { as: 'character', foreignKey: 'character_id' })
  Character.hasMany(Cell, { as: 'cells', foreignKey: 'character_id' })
  CellsXBibliographicReference.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CellsXBibliographicReference, {
    as: 'cells_x_bibliographic_references',
    foreignKey: 'character_id',
  })
  CellsXMedium.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CellsXMedium, {
    as: 'cells_x_media',
    foreignKey: 'character_id',
  })
  CharacterRuleAction.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharacterRuleAction, {
    as: 'character_rule_actions',
    foreignKey: 'character_id',
  })
  CharacterRule.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharacterRule, {
    as: 'character_rules',
    foreignKey: 'character_id',
  })
  CharacterState.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharacterState, {
    as: 'character_states',
    foreignKey: 'character_id',
  })
  CharactersXBibliographicReference.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharactersXBibliographicReference, {
    as: 'characters_x_bibliographic_references',
    foreignKey: 'character_id',
  })
  CharactersXMedium.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharactersXMedium, {
    as: 'characters_x_media',
    foreignKey: 'character_id',
  })
  CharactersXPartition.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(CharactersXPartition, {
    as: 'characters_x_partitions',
    foreignKey: 'character_id',
  })
  MatrixCharacterOrder.belongsTo(Character, {
    as: 'character',
    foreignKey: 'character_id',
  })
  Character.hasMany(MatrixCharacterOrder, {
    as: 'matrix_character_orders',
    foreignKey: 'character_id',
  })
  FoliosXMediaFile.belongsTo(Folio, { as: 'folio', foreignKey: 'folio_id' })
  Folio.hasMany(FoliosXMediaFile, {
    as: 'folios_x_media_files',
    foreignKey: 'folio_id',
  })
  InstitutionsXProject.belongsTo(Institution, {
    as: 'institution',
    foreignKey: 'institution_id',
  })
  Institution.hasMany(InstitutionsXProject, {
    as: 'institutions_x_projects',
    foreignKey: 'institution_id',
  })
  InstitutionsXUser.belongsTo(Institution, {
    as: 'institution',
    foreignKey: 'institution_id',
  })
  Institution.hasMany(InstitutionsXUser, {
    as: 'institutions_x_users',
    foreignKey: 'institution_id',
  })
  Institution.belongsToMany(User, {
    through: InstitutionsXUser,
    foreignKey: 'institution_id',
    otherKey: 'user_id',
    as: 'users',
  })
  CellNote.belongsTo(Matrix, { as: 'matrix', foreignKey: 'matrix_id' })
  Matrix.hasMany(CellNote, { as: 'cell_notes', foreignKey: 'matrix_id' })
  Cell.belongsTo(Matrix, { as: 'matrix', foreignKey: 'matrix_id' })
  Matrix.hasMany(Cell, { as: 'cells', foreignKey: 'matrix_id' })
  CellsXBibliographicReference.belongsTo(Matrix, {
    as: 'matrix',
    foreignKey: 'matrix_id',
  })
  Matrix.hasMany(CellsXBibliographicReference, {
    as: 'cells_x_bibliographic_references',
    foreignKey: 'matrix_id',
  })
  CellsXMedium.belongsTo(Matrix, { as: 'matrix', foreignKey: 'matrix_id' })
  Matrix.hasMany(CellsXMedium, {
    as: 'cells_x_media',
    foreignKey: 'matrix_id',
  })
  CharacterOrdering.belongsTo(Matrix, {
    as: 'matrix',
    foreignKey: 'matrix_id',
  })
  Matrix.hasMany(CharacterOrdering, {
    as: 'character_orderings',
    foreignKey: 'matrix_id',
  })
  CipresRequest.belongsTo(Matrix, { as: 'matrix', foreignKey: 'matrix_id' })
  Matrix.hasMany(CipresRequest, {
    as: 'cipres_requests',
    foreignKey: 'matrix_id',
  })
  MatrixAdditionalBlock.belongsTo(Matrix, {
    as: 'matrix',
    foreignKey: 'matrix_id',
  })
  Matrix.hasMany(MatrixAdditionalBlock, {
    as: 'matrix_additional_blocks',
    foreignKey: 'matrix_id',
  })
  MatrixCharacterOrder.belongsTo(Matrix, {
    as: 'matrix',
    foreignKey: 'matrix_id',
  })
  Matrix.hasMany(MatrixCharacterOrder, {
    as: 'matrix_character_orders',
    foreignKey: 'matrix_id',
  })
  MatrixFileUpload.belongsTo(Matrix, {
    as: 'matrix',
    foreignKey: 'matrix_id',
  })
  Matrix.hasMany(MatrixFileUpload, {
    as: 'matrix_file_uploads',
    foreignKey: 'matrix_id',
  })
  MatrixTaxaOrder.belongsTo(Matrix, { as: 'matrix', foreignKey: 'matrix_id' })
  Matrix.hasMany(MatrixTaxaOrder, {
    as: 'matrix_taxa_orders',
    foreignKey: 'matrix_id',
  })
  MatrixAdditionalBlock.belongsTo(MatrixFileUpload, {
    as: 'upload',
    foreignKey: 'upload_id',
  })
  MatrixFileUpload.hasMany(MatrixAdditionalBlock, {
    as: 'matrix_additional_blocks',
    foreignKey: 'upload_id',
  })
  CellsXMedium.belongsTo(MediaFile, { as: 'medium', foreignKey: 'media_id' })
  MediaFile.hasMany(CellsXMedium, {
    as: 'cells_x_media',
    foreignKey: 'media_id',
  })
  CharactersXMedium.belongsTo(MediaFile, {
    as: 'medium',
    foreignKey: 'media_id',
  })
  MediaFile.hasMany(CharactersXMedium, {
    as: 'characters_x_media',
    foreignKey: 'media_id',
  })
  FoliosXMediaFile.belongsTo(MediaFile, {
    as: 'medium',
    foreignKey: 'media_id',
  })
  MediaFile.hasMany(FoliosXMediaFile, {
    as: 'folios_x_media_files',
    foreignKey: 'media_id',
  })
  MediaFilesXBibliographicReference.belongsTo(MediaFile, {
    as: 'medium',
    foreignKey: 'media_id',
  })
  MediaFile.hasMany(MediaFilesXBibliographicReference, {
    as: 'media_files_x_bibliographic_references',
    foreignKey: 'media_id',
  })
  MediaFilesXDocument.belongsTo(MediaFile, {
    as: 'medium',
    foreignKey: 'media_id',
  })
  MediaFile.hasMany(MediaFilesXDocument, {
    as: 'media_files_x_documents',
    foreignKey: 'media_id',
  })
  MediaLabel.belongsTo(MediaFile, { as: 'medium', foreignKey: 'media_id' })
  MediaFile.hasMany(MediaLabel, {
    as: 'media_labels',
    foreignKey: 'media_id',
  })
  TaxaXMedium.belongsTo(MediaFile, { as: 'medium', foreignKey: 'media_id' })
  MediaFile.hasMany(TaxaXMedium, {
    as: 'taxa_x_media',
    foreignKey: 'media_id',
  })
  MediaFile.belongsTo(MediaView, { as: 'view', foreignKey: 'view_id' })
  MediaView.hasMany(MediaFile, { as: 'media_files', foreignKey: 'view_id' })
  CharactersXPartition.belongsTo(Partition, {
    as: 'partition',
    foreignKey: 'partition_id',
  })
  Partition.hasMany(CharactersXPartition, {
    as: 'characters_x_partitions',
    foreignKey: 'partition_id',
  })
  TaxaXPartition.belongsTo(Partition, {
    as: 'partition',
    foreignKey: 'partition_id',
  })
  Partition.hasMany(TaxaXPartition, {
    as: 'taxa_x_partitions',
    foreignKey: 'partition_id',
  })
  ProjectDocument.belongsTo(ProjectDocumentFolder, {
    as: 'folder',
    foreignKey: 'folder_id',
  })
  ProjectDocumentFolder.hasMany(ProjectDocument, {
    as: 'project_documents',
    foreignKey: 'folder_id',
  })
  MediaFilesXDocument.belongsTo(ProjectDocument, {
    as: 'document',
    foreignKey: 'document_id',
  })
  ProjectDocument.hasMany(MediaFilesXDocument, {
    as: 'media_files_x_documents',
    foreignKey: 'document_id',
  })
  Project.belongsTo(ProjectGroup, { as: 'group', foreignKey: 'group_id' })
  ProjectGroup.hasMany(Project, { as: 'projects', foreignKey: 'group_id' })
  ProjectMembersXGroup.belongsTo(ProjectMemberGroup, {
    as: 'group',
    foreignKey: 'group_id',
  })
  ProjectMemberGroup.hasMany(ProjectMembersXGroup, {
    as: 'project_members_x_groups',
    foreignKey: 'group_id',
  })
  BibliographicReference.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(BibliographicReference, {
    as: 'bibliographic_references',
    foreignKey: 'project_id',
  })
  Character.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Character, { as: 'characters', foreignKey: 'project_id' })
  CuratorPotentialProject.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasOne(CuratorPotentialProject, {
    as: 'curator_potential_project',
    foreignKey: 'project_id',
  })
  Folio.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Folio, { as: 'folios', foreignKey: 'project_id' })
  InstitutionsXProject.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(InstitutionsXProject, {
    as: 'institutions_x_projects',
    foreignKey: 'project_id',
  })
  Matrix.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Matrix, { as: 'matrices', foreignKey: 'project_id' })
  MediaFile.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(MediaFile, { as: 'media_files', foreignKey: 'project_id' })
  MediaView.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(MediaView, { as: 'media_views', foreignKey: 'project_id' })
  Partition.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Partition, { as: 'partitions', foreignKey: 'project_id' })
  ProjectDocumentFolder.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(ProjectDocumentFolder, {
    as: 'project_document_folders',
    foreignKey: 'project_id',
  })
  ProjectDocument.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(ProjectDocument, {
    as: 'project_documents',
    foreignKey: 'project_id',
  })
  ProjectDuplicationRequest.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(ProjectDuplicationRequest, {
    as: 'project_duplication_requests',
    foreignKey: 'project_id',
  })
  ProjectMemberGroup.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(ProjectMemberGroup, {
    as: 'project_member_groups',
    foreignKey: 'project_id',
  })
  ProjectsXUser.belongsTo(Project, {
    as: 'projects',
    foreignKey: 'project_id',
  })
  Project.hasMany(ProjectsXUser, {
    as: 'projects_x_users',
    foreignKey: 'project_id',
  })
  Specimen.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Specimen, { as: 'specimens', foreignKey: 'project_id' })
  Taxon.belongsTo(Project, { as: 'projects', foreignKey: 'project_id' })
  Project.hasMany(Taxon, { as: 'taxa', foreignKey: 'project_id' })
  ProjectMembersXGroup.belongsTo(ProjectsXUser, {
    as: 'membership',
    foreignKey: 'membership_id',
  })
  ProjectsXUser.hasMany(ProjectMembersXGroup, {
    as: 'project_members_x_groups',
    foreignKey: 'membership_id',
  })
  MediaFile.belongsTo(Specimen, { as: 'specimen', foreignKey: 'specimen_id' })
  Specimen.hasMany(MediaFile, {
    as: 'media_files',
    foreignKey: 'specimen_id',
  })
  SpecimensXBibliographicReference.belongsTo(Specimen, {
    as: 'specimen',
    foreignKey: 'specimen_id',
  })
  Specimen.hasMany(SpecimensXBibliographicReference, {
    as: 'specimens_x_bibliographic_references',
    foreignKey: 'specimen_id',
  })
  TaxaXSpecimen.belongsTo(Specimen, {
    as: 'specimen',
    foreignKey: 'specimen_id',
  })
  Specimen.hasMany(TaxaXSpecimen, {
    as: 'taxa_x_specimens',
    foreignKey: 'specimen_id',
  })
  CellNote.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(CellNote, { as: 'cell_notes', foreignKey: 'taxon_id' })
  Cell.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(Cell, { as: 'cells', foreignKey: 'taxon_id' })
  CellsXBibliographicReference.belongsTo(Taxon, {
    as: 'taxa',
    foreignKey: 'taxon_id',
  })
  Taxon.hasMany(CellsXBibliographicReference, {
    as: 'cells_x_bibliographic_references',
    foreignKey: 'taxon_id',
  })
  CellsXMedium.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(CellsXMedium, { as: 'cells_x_media', foreignKey: 'taxon_id' })
  MatrixTaxaOrder.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(MatrixTaxaOrder, {
    as: 'matrix_taxa_orders',
    foreignKey: 'taxon_id',
  })
  TaxaXBibliographicReference.belongsTo(Taxon, {
    as: 'taxa',
    foreignKey: 'taxon_id',
  })
  Taxon.hasMany(TaxaXBibliographicReference, {
    as: 'taxa_x_bibliographic_references',
    foreignKey: 'taxon_id',
  })
  TaxaXMedium.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(TaxaXMedium, { as: 'taxa_x_media', foreignKey: 'taxon_id' })
  TaxaXPartition.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(TaxaXPartition, {
    as: 'taxa_x_partitions',
    foreignKey: 'taxon_id',
  })
  TaxaXSpecimen.belongsTo(Taxon, { as: 'taxa', foreignKey: 'taxon_id' })
  Taxon.hasMany(TaxaXSpecimen, {
    as: 'taxa_x_specimens',
    foreignKey: 'taxon_id',
  })
  FeaturedProject.belongsTo(Project, {
    as: 'project',
    foreignKey: 'project_id'
  });

  MatrixImage.belongsTo(Project, {
    as: 'project',
    foreignKey: 'project_id'
  });

  const cellTables = [
    Cell,
    CellNote,
    CellsXBibliographicReference,
    CellsXMedium,
  ]
  cellTables.forEach((table) => {
    table.addHook('afterCreate', (model, options) =>
      logCellChange(model, 'I', options)
    )
    table.addHook('afterUpdate', (model, options) =>
      logCellChange(model, 'U', options)
    )
    table.addHook('afterDestroy', (model, options) =>
      logCellChange(model, 'D', options)
    )
  })

  const characterTables = [Character, CharacterState, CharactersXMedium]
  characterTables.forEach((table) => {
    const isCharacterTable = table == Character
    table.addHook('afterCreate', (model, options) =>
      logCharacterChange(model, isCharacterTable ? 'I' : 'U', options)
    )
    table.addHook('afterUpdate', (model, options) =>
      logCharacterChange(model, 'U', options)
    )
    table.addHook('afterDestroy', (model, options) =>
      logCharacterChange(model, isCharacterTable ? 'D' : 'I', options)
    )
  })

  // Changelog hooks
  sequelizeConn.addHook('afterCreate', (model, options) =>
    logChange(model, 'I', options)
  )
  sequelizeConn.addHook('afterUpdate', (model, options) =>
    logChange(model, 'U', options)
  )
  sequelizeConn.addHook('afterDestroy', (model, options) =>
    logChange(model, 'D', options)
  )

  // File deletion hooks
  sequelizeConn.addHook('afterUpdate', (model, options) =>
    fileChanged(model, options)
  )
  sequelizeConn.addHook('afterDestroy', (model, options) =>
    fileDeleted(model, options)
  )

  return {
    AnnotationEvent,
    Annotation,
    BibliographicAuthor,
    BibliographicReference,
    CellBatchLog,
    CellNote,
    Cell,
    CellsXBibliographicReference,
    CellsXMedium,
    CharacterOrdering,
    CharacterRuleAction,
    CharacterRule,
    CharacterState,
    Character,
    CharactersXBibliographicReference,
    CharactersXMedium,
    CharactersXPartition,
    CipresRequest,
    CurationRequest,
    CuratorPotentialProject,
    Folio,
    FoliosXMediaFile,
    Institution,
    InstitutionsXProject,
    InstitutionsXUser,
    Matrix,
    MatrixAdditionalBlock,
    MatrixCharacterOrder,
    MatrixFileUpload,
    MatrixTaxaOrder,
    MediaFile,
    MediaFilesXBibliographicReference,
    MediaFilesXDocument,
    MediaLabel,
    MediaView,
    Partition,
    ProjectDocumentFolder,
    ProjectDocument,
    ProjectDuplicationRequest,
    ProjectGroup,
    ProjectMemberGroup,
    ProjectMembersXGroup,
    Project,
    ProjectsXUser,
    Specimen,
    SpecimensXBibliographicReference,
    TaskQueue,
    TaxaXBibliographicReference,
    TaxaXMedium,
    TaxaXPartition,
    TaxaXSpecimen,
    Taxon,
    User,
    UserRole,
    UsersXRole,
    FeaturedProject,
    MatrixImage,
    Announcement,
    Tool,
    Press,
    ApplicationVar
  }
}

const models = initModels(sequelizeConn)

export { models }
