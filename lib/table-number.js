export const TABLE_NUMBERS = {
  media_files: 1,
  specimens: 2,
  characters: 3,
  character_states: 4,
  matrices: 5,
  cells: 6,
  cells_x_media: 7,
  media_labels: 8,
  annotations: 9,
  taxa: 10,
  taxa_x_specimens: 11,
  projects: 12,
  media_views: 13,
  projects_x_users: 14,
  characters_x_media: 16,
  matrix_taxa_order: 24,
  matrix_character_order: 25,
  folios: 26,
  folios_x_media_files: 27,
  cell_notes: 29,
  faq_categories: 30,
  faq_items: 31,
  matrix_file_uploads: 32,
  matrix_additional_blocks: 37,
  project_documents: 38,
  annotation_events: 39,
  bibliographic_references: 40,
  cells_x_bibliographic_references: 41,
  characters_x_bibliographic_references: 42,
  specimens_x_bibliographic_references: 43,
  media_files_x_bibliographic_references: 44,
  taxa_x_bibliographic_references: 45,
  bibliographic_authors: 47,
  project_groups: 48,
  project_member_groups: 50,
  project_members_x_groups: 52,
  taxa_x_media: 53,
  character_rules: 54,
  character_rule_actions: 55,
  ca_locales: 56,
  ca_users: 57,
  ca_task_queue: 58,
  partitions: 59,
  characters_x_partitions: 60,
  taxa_x_partitions: 61,
  ca_user_roles: 62,
  ca_users_x_roles: 63,
  media_files_x_documents: 64,
  project_document_folders: 65,
  project_duplication_requests: 66,
  cell_batch_log: 72,
  character_orderings: 78,
  hp_matrix_images: 80,
  hp_featured_projects: 81,
  hp_tools: 82,
  hp_announcements: 83,
  cipres_requests: 84,
  press: 85,
  ca_users_x_lockouts: 86,
  curator_potential_projects: 87,
  curator_communication_log: 88,
  resolved_taxonomy: 89,
  taxa_x_resolved_taxonomy: 91,
  inactive_deletion: 92,
  institutions: 93,
  institutions_x_users: 94,
  institutions_x_projects: 95,
  curation_requests: 96,
}

export function getTableNumber(model) {
  const tableName = model.constructor.tableName
  return TABLE_NUMBERS[tableName]
}

export function getTableNameByNumber(tableNumber) {
  for (const [name, number] of Object.entries(TABLE_NUMBERS)) {
    if (number == tableNumber) {
      return name
    }
  }
  return null
}
