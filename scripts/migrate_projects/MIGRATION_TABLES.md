# Project Migration Tables Reference

This document lists all tables that are migrated when transferring a project between databases, organized by category.

## Core Project Data
- `projects` - Main project record

## User and Permission Management
- `projects_x_users` - User permissions for the project
- `project_member_groups` - Member groups within the project
- `project_members_x_groups` - Group assignments for members
- `institutions_x_projects` - Institution links to the project

## Taxonomic Data
- `taxa` - Taxonomic units in the project
- `specimens` - Specimen records
- `taxa_x_bibliographic_references` - Taxa citations
- `taxa_x_media` - Media linked to taxa
- `taxa_x_partitions` - Taxa partition assignments
- `taxa_x_specimens` - Taxa-specimen relationships
- `taxa_x_resolved_taxonomy` - Resolved taxonomy links
- `specimens_x_bibliographic_references` - Specimen citations

## Character Data
- `characters` - Morphological characters
- `character_states` - Character state definitions
- `character_orderings` - Character ordering information
- `character_rules` - Character rules
- `character_rule_actions` - Actions for character rules
- `character_change_log` - Character modification history
- `characters_x_bibliographic_references` - Character citations
- `characters_x_media` - Media linked to characters
- `characters_x_partitions` - Character partition assignments

## Matrix Data (Cells)
- `cells` - Matrix cell data
- `cell_notes` - Annotations for cells
- `cell_batch_log` - Batch operation logs for matrices (linked via matrix_id)
- `cell_change_log` - Cell modification history
- `cells_x_bibliographic_references` - Cell citations
- `cells_x_media` - Media linked to cells

## Media Management
- `media_files` - Media file records
- `media_views` - Media view definitions
- `media_labels` - Labels for media files
- `media_files_x_bibliographic_references` - Media citations
- `media_files_x_documents` - Media linked to documents

## Documentation
- `folios` - Folio records
- `folios_x_media_files` - Media linked to folios
- `project_document_folders` - Document folder organization
- `project_documents` - Project documents

## Bibliography
- `bibliographic_references` - Reference entries
- `bibliographic_authors` - Authors of references

## Matrices
- `matrices` - Matrix definitions
- `matrix_file_uploads` - Matrix file upload records
- `matrix_character_order` - Character ordering within matrices
- `matrix_taxa_order` - Taxa ordering within matrices
- `matrix_additional_blocks` - Additional data blocks for matrices

## Analysis and Requests
- `cipres_requests` - CIPRES phylogenetic analysis requests
- `curation_requests` - Curation requests for the project
- `project_duplication_requests` - Project duplication requests

## Other
- `partitions` - Project data partitions
- `annotations` - Polymorphic annotations for various entities
- `annotation_events` - Annotation modification history

## Migration Order

Tables are migrated in dependency order to maintain referential integrity:

1. Core project data
2. User relationships and permissions
3. Taxonomic and specimen data
4. Characters and their relationships
5. Matrix cells and relationships
6. Media files and views
7. Documentation and bibliography
8. Cross-reference tables
9. Analysis requests
10. Annotations (last due to polymorphic nature)

## Notes

- All foreign key relationships are preserved during migration
- The migration uses transactions to ensure data consistency
- If any table fails to migrate, the entire operation is rolled back
- Tables are processed in batches to handle large datasets efficiently
