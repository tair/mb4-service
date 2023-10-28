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

    //TODO: getAllIdsInTable
    /**
	 * Returns all the associated files in a given table. This is used to complex values like matrices and media_files
	 * which are include getting their values several ways.
	 */
    async getAllIdsInTable(tableName) {
        if (!(tableName in this.cacheTableIds)) {
            switch(tableName) {
                case 'matrices':
                    const [rows] = await sequelizeConn.query(
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
                    const [rows] = await sequelizeConn.query(
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
        }
    }
}

