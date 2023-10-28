import { Datamodel } from "./datamodel/datamodel";
import sequelizeConn from '../util/db.js'
import { UserError } from "./user-errors";


export class PartitionProjectPublisher {
    
    constructor(mainTableName, itemId, partitionId) {
        super(mainTableName, itemId);

        /** 
         * The partition to duplicate.
	    */
        this.partitionId = partitionId;

        /**
         * An array which is used an a cache for matrices and media ids.
         */
        this.cacheTableIds = [];
    }

    /**
	 * Returns all the associated files in a given table. This is used to complex values like matrices and media_files
	 * which are include getting their values several ways.
	 */
    async getAllIdsInTable(tableName) {
        if (!(tableName in this.cacheTableIds)) {
            switch(tableName) {
                case 'matrices':
                    [rows] = await sequelizeConn.query(
                        `SELECT matrixId AS id
						FROM matrix_character_order
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE characters_x_partitions.partition_id = ?
						UNION
						SELECT matrix_id AS id
						FROM matrix_taxa_order
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ?`,
                        { replacements: [this.partitionId, this.partitionId] }
                    );
                    break;
                case 'media_files':
                    [rows] = await sequelizeConn.query(
                        `-- Get all media which are affiliated with the taxa
						SELECT media_id AS id
						FROM media_files
						INNER JOIN taxa_x_specimens USING(specimen_id)
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ?
						-- Get all media that is used in the matrix as a taxa media
						UNION
						SELECT media_id AS id
						FROM media_files mf
						INNER JOIN taxa_x_media USING(media_id)
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ?
						-- Get all media that is used in the matrix as a character media
						UNION
						SELECT media_id AS id
						FROM media_files
						INNER JOIN characters_x_media USING(media_id)
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE characters_x_partitions.partition_id = ?
						-- GET all media associated with a bibliographic reference
						UNION
						SELECT media_id AS id
						FROM media_files
						INNER JOIN media_files_x_bibliographic_references USING(media_id)
						INNER JOIN bibliographic_references USING(reference_id)
						WHERE media_files.project_id = ?
						-- Get all media which are attached to documents
						UNION
						SELECT media_id AS id
						FROM media_files
						INNER JOIN media_files_x_documents USING(media_id)
						INNER JOIN project_documents USING(document_id)
						WHERE media_files.project_id = ?");
                        `,
                        { replacements: [this.partitionId, this.partitionId, this.partitionId, this.masterItemId, this.masterItemId]}
                    );
                    break;
                default:
                    throw new UserError("There is no defined query to get ids for " . tableName);
            }       
            // Default to a bad media_id so that the generated SQL queries can still work.
            this.cacheTableIds[tableName] = rows || [0];
        }
		return this.cacheTableIds[tableName];
    }

	/**
	 * The SQL queries are hard-coded because fetching the dependencies between all the tables with a subset of
	 * information requires an overhaul of the Graph and PATH classes so having the exact queries are much easier.
	 *
	 * @param string tableName The name of the table to create the SQL statement
	 * @return string The SQL string.
	 */
	async generateSQLStatementForTable(tableName) {
		switch (tableName) {
			case 'projects':
				return `SELECT projects.*
						FROM projects
						WHERE projects.project_id = ?`;
			case 'taxa':
				return `SELECT taxa.*
						FROM taxa
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ` + this.partitionId + ` AND taxa.project_id = ?`;
			case 'matrix_taxa_order':
			case 'taxa_x_media':
			case 'taxa_x_bibliographic_references':
				return `SELECT $ps_table_name.*
						FROM $ps_table_name
						INNER JOIN taxa USING(taxon_id)
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ` + this.partitionId + ` AND taxa.project_id = ?`;
			case 'characters':
				return `SELECT characters.*
						FROM characters
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE characters_x_partitions.partition_id = ` + this.partitionId + ` AND characters.project_id = ?`;
			case 'character_states':
			case 'character_rules':
			case 'characters_x_media':
			case 'characters_x_bibliographic_references':
				matrixIds = join(', ', this.getAllIdsInTable('matrices'));
				return `SELECT $ps_table_name.*
						FROM $ps_table_name
						INNER JOIN characters USING(character_id)
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE characters_x_partitions.partition_id = ` + this.partitionId + ` AND characters.project_id = ?`;
			case 'matrix_character_order':
				matrixIds = join(', ', this.getAllIdsInTable('matrices'));
				return `SELECT matrix_character_order.*
						FROM matrix_character_order
						INNER JOIN characters USING(character_id)
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE
							matrix_character_order.matrix_id IN ` + matrixIds + ` AND
							characters_x_partitions.partition_id = ` + this.partitionId + ` AND
							characters.project_id = ?`;
			case 'character_rule_actions':
				// This SQL ensures that both the mother and daugther rules are present in the partition.
				return `SELECT character_rule_actions.*
						FROM character_rule_actions
						INNER JOIN character_rules ON character_rule_actions.rule_id = character_rules.rule_id
						INNER JOIN characters ON character_rule_actions.character_id = characters.character_id
						INNER JOIN characters_x_partitions AS cxp_mother ON cxp_mother.character_id = character_rules.character_id
						INNER JOIN characters_x_partitions AS cxp_daugther ON cxp_daugther.character_id = character_rule_actions.character_id
						WHERE
							cxp_mother.partition_id = + ` + this.partitionId + ` AND
							cxp_daugther.partition_id = ` + this.partitionId + ` AND
							characters.project_id = ?`;
			case 'matrices':
				matrixIds = join(', ', this.getAllIdsInTable('matrices'));
				return `SELECT matrices.*
						FROM matrices
						WHERE project_id = ? AND matrix_id IN ` + matrxIds;
			case 'media_files':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT *
						FROM media_files
						WHERE media_id IN `+ mediaIds + ` AND project_id = ?`;
			case 'specimens':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT specimens.*
						FROM specimens
						INNER JOIN media_files USING(specimen_id)
						WHERE media_files.media_id IN ` + mediaIds + ` AND specimens.project_id = ?
						GROUP BY specimens.specimen_id`;
			case 'specimens_x_bibliographic_references':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT specimens_x_bibliographic_references.*
						FROM specimens_x_bibliographic_references
						INNER JOIN specimens USING(specimen_id)
						INNER JOIN media_files USING(specimen_id)
						WHERE media_files.media_id IN ` + mediaIds + ` AND specimens.project_id = ?
						GROUP BY specimens_x_bibliographic_references.link_id`;
			case 'media_views':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT media_views.*
						FROM media_views
						INNER JOIN media_files USING(view_id)
						WHERE media_files.media_id IN ` + mediaIds + ` AND media_views.project_id = ?
						GROUP BY media_views.view_id`;
			case 'taxa_x_specimens':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT taxa_x_specimens.*
						FROM taxa_x_specimens
						INNER JOIN taxa_x_partitions USING(taxon_id)
						INNER JOIN specimens USING(specimen_id)
						INNER JOIN media_files USING(specimen_id)
						WHERE
							taxa_x_partitions.partition_id = ` + this.partitionId + ` AND
							media_files.media_id IN ` + mediaIds + ` AND
							specimens.project_id = ?
						GROUP BY taxa_x_specimens.link_id`;
			case 'media_labels':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT media_labels.*
						FROM media_labels
						INNER JOIN media_files USING(media_id)
						WHERE media_labels.media_id IN ` + mediaIds + ` AND media_files.project_id = ?
						GROUP BY media_labels.label_id`;
			case 'media_files_x_documents':
			case 'media_files_x_bibliographic_references':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT $ps_table_name.*
						FROM $ps_table_name
						INNER JOIN media_files USING(media_id)
						WHERE media_id IN ` + mediaIds + ` AND media_files.project_id = ?`;
			case 'project_documents':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT project_documents.*
						FROM project_documents
						INNER JOIN media_files_x_documents USING(document_id)
						WHERE media_files_x_documents.media_id IN ` + mediaIds + ` AND project_documents.project_id = ?
						GROUP BY project_documents.document_id`;
			case 'project_document_folders':
				mediaIds = join(', ', this.getAllIdsInTable('media_files'));
				return `SELECT project_document_folders.*
						FROM project_document_folders
						INNER JOIN project_documents USING(folder_id)
						INNER JOIN media_files_x_documents USING(document_id)
						WHERE media_files_x_documents.media_id IN ` + mediaIds + ` AND project_documents.project_id = ?
						GROUP BY project_document_folders.folder_id`;
			case 'cells':
			case 'cell_notes':
			case 'cells_x_media':
			case 'cells_x_bibliographic_references':
				matrixIds = join(', ', this.getAllIdsInTable('matrices'));
				return `SELECT $ps_table_name.*
						FROM $ps_table_name
						INNER JOIN matrices USING(matrix_id)
						INNER JOIN taxa_x_partitions USING(taxon_id)
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE
							taxa_x_partitions.partition_id = ` + this.partitionId + ` AND
							characters_x_partitions.partition_id = ` + this.partitionId + ` AND
							$ps_table_name.matrix_id IN ` + matrixIds + ` AND
							matrices.project_id = ?`;
			case 'matrix_file_uploads':
			case 'matrix_additional_blocks':
			case 'character_orderings':
				matrixIds = join(', ', this.getAllIdsInTable('matrices'));
				return `SELECT $ps_table_name.*
						FROM $ps_table_name
						INNER JOIN matrices USING(matrix_id)
						WHERE matrix_id IN ` + matrixIds + ` AND matrices.project_id = ?`;
			case 'bibliographic_references':
			case 'bibliographic_authors':
				// These tables are copied in completeness
				return super.generateSQLStatementForTable($ps_table_name);
			default:
				throw new Exception("No generated SQL table for $ps_table_name");
		}
	}
}

