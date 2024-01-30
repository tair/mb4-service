import { Datamodel } from "./datamodel/datamodel";
import sequelizeConn from '../util/db.js'
import { UserError } from "./user-errors";
import { BaseModelDuplicator } from "./base-model-duplicator";


export class PartitionProjectPublisher extends BaseModelDuplicator {
    
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
		let [rows] = [];
        if (!(tableName in this.cacheTableIds)) {
            switch(tableName) {
                case 'matrices':
                    [rows] = await sequelizeConn.query(
                        `SELECT matrix_id AS id
						FROM matrix_character_order
						INNER JOIN characters_x_partitions USING(character_id)
						WHERE characters_x_partitions.partition_id = ?
						UNION
						SELECT matrix_id AS id
						FROM matrix_taxa_order
						INNER JOIN taxa_x_partitions USING(taxon_id)
						WHERE taxa_x_partitions.partition_id = ?;`,
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

	static async clonePartitionAsNewProject(options = null) {
		const transaction = await sequelizeConn.transaction();
		transaction.start();

		let duplicatedTables = [
			'projects',
			'specimens',
			'media_views',
			'media_files',
			'matrices',
			'character_orderings',
			'characters',
			'taxa',
			'project_document_folders',
			'project_documents',
			'bibliographic_references',
			'cells_x_media',
			'character_states',
			'characters_x_media',
			'media_files_x_bibliographic_references',
			'taxa_x_media',
			'media_files_x_documents',
			'taxa_x_specimens',
			'specimens_x_bibliographic_references',
			'cells',
			'matrix_character_order',
			'cell_notes',
			'cells_x_bibliographic_references',
			'characters_x_bibliographic_references',
			'character_rules',
			'character_rule_actions',
			'matrix_taxa_order',
			'taxa_x_bibliographic_references',
			'matrix_file_uploads',
			'matrix_additional_blocks',
			'bibliographic_authors',
			'media_labels',
		];

		let ignoredTables = [
			'folios',
			'folios_x_media_files',
			'partitions',
			'taxa_x_partitions',
			'characters_x_partitions',
			'ca_users',
			'projects_x_users',
			'project_member_groups',
			'project_groups',
			'project_duplication_requests',
			'curator_potential_projects',
			'curator_communication_log',
			'hp_matrix_images',
			'hp_featured_projects',
			'resolved_taxonomy',
			'taxa_x_resolved_taxonomy',
			'cipres_requests',
			'institutions',
			'institutions_x_users',
			'institutions_x_projects'
		];

		//TODO: Ensure that making this an object doesn't mess anything up
		let numberedTables = {
			'media_labels' : 'link_id',
		};

		// Sets the current user as defined in options.
		let userId = options['user_id'];

		let projectId = options['project_id'];
		let partitionId = options['partition_id'];

		console.log("[INFO] Starting duplication of Project P{projectId}\n");

		let modelDuplicator = new PartitionProjectPublisher('projects', projectId, partitionId);
		modelDuplicator.setTransaction(transaction);
		modelDuplicator.setDuplicatedTables(duplicatedTables);
		modelDuplicator.setIgnoredTables(ignoredTables);
		modelDuplicator.setNumberedTables(numberedTables);
		modelDuplicator.setOverriddenFieldNames({'user_id' : userId}); //TODO: Check to ensure that changing this to object doesn't mess it up
		modelDuplicator.setDebugMode(TRUE);

		// The timer is used to determine how long the duplication process took.
		console.time()

		let clonedProjectId = modelDuplicator.duplicate();

		if (!clonedProjectId) {
			transaction.rollbackTransaction();
			console.log("[ERROR] Error duplicating project P{projectId} (" + console.timeEnd() + "s)\n.");
			return null;
		}

		// We'll need to update the partition_published_on
		const project = new projects(projectId);
		let diskLimit = max(project.get('disk_usage_limit'), (5 * 1024 * 1024 * 1024));

		// Let's update the project id records with the correct values.
		clonedProject = new projects(clonedProjectId);
		clonedProject.setMode(ACCESS_WRITE);
		clonedProject.setTransaction(transaction);
		clonedProject.set('name', project.get('name')+" (from P".project.get('project_id')+")");
		clonedProject.set('user_id', userId);
		clonedProject.set('partition_published_on', null);
		clonedProject.set('disk_usage_limit', diskLimit);
		clonedProject.set('partitioned_from_project_id', projectId);
		clonedProject.set('ancestor_project_id', projectId);
		clonedProject.set('created_on', Date.now());
		clonedProject.set('last_accessed_on', Date.now());
		clonedProject.set('published', 0);
		clonedProject.set('published_on', null);
		clonedProject.set('group_id', NULL);
		if ((exemplarMediaId = clonedProject.get('exemplar_media_id'))) {
			exemplarMediaId = modelDuplicator.getDuplicateRecordId('media_files', exemplarMediaId, false);
			if (exemplarMediaId) {
				clonedProject.set('exemplar_media_id', exemplarMediaId);
			}
		}
		clonedProject.update();

		// Link only the project admin whose user_id has been passed to this script
		projectsXUsers = new projects_x_users();
		projectsXUsers.setMode(ACCESS_WRITE);
		projectsXUsers.setTransaction(transaction);
		projectsXUsers.set('created_on', Date.now());
		projectsXUsers.set('user_id', userId);
		projectsXUsers.set('project_id', clonedProjectId);
		projectsXUsers.set('membership_type', 0);
		projectsXUsers.insert();

		// Since only a subset of matrix characters and matrix taxa was added. We have to update their ranks.
		queriedMatrices = db.query("SELECT matrix_id FROM matrices WHERE project_id = ?", clonedProjectId);
		while (queriedMatrices.nextRow()) {
			matrix = new matrices(queriedMatrices.get('matrix_id'));
			projectsXUsers.setMode(ACCESS_WRITE);
			projectsXUsers.setTransaction(transaction);
			// We pass in an array of zero to ensure that all characters and taxa are renumbered.
			matrix.reorderCharacters([0], 0);
			matrix.reorderTaxa([0], 0);
		}

		console.log("[INFO] Copied P{projectId} to P{clonedProjectId}, done in " + console.timeEnd() + "s\n");
		transaction.commit();

		return clonedProject;
	}
}

