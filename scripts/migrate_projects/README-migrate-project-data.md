# Project Data Migration Script

## Overview

This script migrates all data related to a specific project from one database to another, ensuring complete data consistency between both databases. It now includes advanced features for:
- Migrating journal covers to S3
- Migrating media files to S3
- Re-dumping project data to JSON and uploading to S3

## Features

- **Complete Project Migration**: Migrates all data associated with a project including:
  - Core project data
  - Users and permissions
  - Taxa and specimens
  - Characters and character states
  - Matrix data (cells)
  - Media files and views
  - Folios
  - Bibliographic references
  - Annotations
  - Partitions
  - Documents
  - And all related cross-reference tables

- **S3 Migration**: Automatically migrates legacy media to S3:
  - Journal covers are converted to the new standardized format
  - Media files are uploaded with proper S3 keys
  - Legacy URLs are downloaded and processed
  - Images are optimized during migration

- **Data Dumps**: After migration, automatically:
  - Updates the global projects.json list
  - Dumps project details to JSON
  - Dumps media file information
  - Uploads all dumps to S3

- **Transaction Safety**: Uses database transactions to ensure atomicity
- **Dry Run Mode**: Test the migration without making changes
- **Detailed Logging**: Comprehensive logging with optional verbose mode
- **Data Validation**: Validates project existence and data integrity
- **Incremental Updates**: Updates existing records and inserts new ones

## Prerequisites

- Node.js 16+ installed
- Access to both source and target MySQL/MariaDB databases
- AWS credentials for S3 operations (optional, but recommended)
- Proper database credentials for both databases

## Installation

1. Navigate to the scripts directory:
```bash
cd mb4-service/scripts/migrate_projects
```

2. Ensure all dependencies are installed:
```bash
npm install
```

## Configuration

1. Create environment files for your source and target databases:

```bash
# Create source database config
cp .env.source.template .env.source
# Edit .env.source with your source database credentials

# Create target database config  
cp .env.target.template .env.target
# Edit .env.target with your target database credentials
```

2. Example `.env` file structure:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_SCHEMA=morphobank
DB_PASSWORD=your_password

# AWS Configuration (required for S3 migration)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_DEFAULT_BUCKET=mb4-data
```

## Usage

### Basic Usage

```bash
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target
```

### Dry Run (Preview Only)

```bash
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --dry-run
```

### Skip S3 Migration

```bash
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --skip-s3
```

### Skip Data Dumps

```bash
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --skip-dumps
```

### Verbose Logging

```bash
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --verbose
```

### Combined Options

```bash
# Dry run with verbose logging
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --dry-run --verbose

# Skip S3 operations but keep dumps
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --skip-s3

# Full migration without dumps
node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --skip-dumps
```

## Cleanup Script

After migration, you may notice that records existing only in the target (beta) database but not in the source (prod) are not automatically removed. The `cleanup-project-data.js` script solves this by removing such orphaned records, ensuring the target is truly identical to the source.

### When to Use Cleanup

Use the cleanup script when:
- You've previously migrated a project and made changes in beta that shouldn't be kept
- You want to ensure beta is an exact copy of prod (not just a superset)
- You need to remove test data, deleted characters, or deprecated media from beta

### Cleanup Usage

```bash
# Preview what would be deleted (recommended first step)
node cleanup-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --dry-run

# Actually delete orphaned records
node cleanup-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target

# Verbose logging
node cleanup-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target --verbose
```

### How Cleanup Works

1. **Reverse Order Processing**: Processes tables in reverse order (children before parents) to respect foreign key constraints
2. **Safe Deletion**: For each table:
   - Identifies all records in target matching the project
   - Checks which ones don't exist in source
   - Deletes those orphaned records
3. **Transaction Safety**: All deletions are wrapped in a transaction (rollback on error)
4. **Detailed Reporting**: Shows exactly what was deleted from each table

### Cleanup Command Options

| Option | Required | Description |
|--------|----------|-------------|
| `--project-id` | Yes | The ID of the project to clean up |
| `--source-env` | Yes | Path to the source database .env file |
| `--target-env` | Yes | Path to the target database .env file |
| `--dry-run` | No | Preview deletions without actually deleting |
| `--verbose` | No | Show detailed debug logging |

### Typical Workflow

```bash
# 1. Migrate from prod to beta
node migrate-project-data.js --project-id=123 --source-env=.env.prod --target-env=.env.beta

# 2. Preview cleanup (what would be deleted)
node cleanup-project-data.js --project-id=123 --source-env=.env.prod --target-env=.env.beta --dry-run

# 3. Execute cleanup
node cleanup-project-data.js --project-id=123 --source-env=.env.prod --target-env=.env.beta
```

### All-in-One Sync Script

For convenience, use the `migrate-and-sync.sh` wrapper script that runs both migration and cleanup:

```bash
# Preview the complete sync (migration + cleanup)
./migrate-and-sync.sh --project-id=123 --source-env=.env.prod --target-env=.env.beta --dry-run

# Execute the complete sync
./migrate-and-sync.sh --project-id=123 --source-env=.env.prod --target-env=.env.beta

# With verbose logging
./migrate-and-sync.sh --project-id=123 --source-env=.env.prod --target-env=.env.beta --verbose

# Skip S3 migration but include cleanup
./migrate-and-sync.sh --project-id=123 --source-env=.env.prod --target-env=.env.beta --skip-s3
```

This wrapper script:
1. Runs the migration (adds/updates records from source to target)
2. Runs the cleanup (removes records in target not in source)
3. Ensures the target is truly identical to the source

## Command Line Options

| Option | Required | Description |
|--------|----------|-------------|
| `--project-id` | Yes | The ID of the project to migrate |
| `--source-env` | Yes | Path to the source database .env file |
| `--target-env` | Yes | Path to the target database .env file |
| `--dry-run` | No | Perform validation only without making changes |
| `--verbose` | No | Show detailed debug logging |
| `--skip-s3` | No | Skip S3 migration for journal covers and media files |
| `--skip-dumps` | No | Skip re-dumping project data after migration |

## Migration Process

The script performs migration in three phases:

### Phase 1: Database Migration
Migrates all project-related data maintaining referential integrity:
1. Core project data
2. User relationships and permissions
3. Taxonomic and specimen data
4. Character definitions and matrix data
5. Media records and references
6. All cross-reference tables

### Phase 2: S3 Migration (if enabled)
Migrates media assets to S3 storage:
1. **Journal Covers**:
   - Downloads legacy journal covers
   - Optimizes images (JPEG, 90% quality)
   - Uploads to standardized S3 path
   - Updates database with new format

2. **Media Files**:
   - Processes all media files for the project
   - Downloads legacy images from old URLs
   - Creates optimized variants (original, large, thumbnail)
   - Uploads to organized S3 structure
   - Updates database with S3 keys

### Phase 3: Data Dumps (if enabled)
Re-generates and uploads JSON dumps:
1. **Projects List**: Updates global projects.json
2. **Project Details**: Generates detailed project data
3. **Media Information**: Compiles media file metadata
4. All dumps are uploaded to S3 for API access

## S3 Structure

Media files are organized in S3 as follows:
```
mb4-data/
├── projects.json
├── prj_details/
│   └── prj_123.json
├── media_files/
│   ├── prj_123.json
│   ├── journal_covers/
│   │   └── uploads/
│   │       └── projects_journal_cover_123.jpg
│   └── images/
│       └── 123/
│           └── 456/
│               ├── 123_456_original.jpg
│               ├── 123_456_large.jpg
│               └── 123_456_thumbnail.jpg
└── prj_stats/
    └── prj_123.json
```

## Important Notes

### Data Integrity
- The script maintains all foreign key relationships
- Existing records in the target database are updated, not duplicated
- The migration is wrapped in a transaction - if any error occurs, all changes are rolled back
- S3 operations are performed after database migration succeeds

### Performance Considerations
- Large projects with thousands of specimens or characters may take several minutes
- S3 migration can be time-consuming for projects with many media files
- The script processes records in batches to avoid memory issues
- Database connection pools are used for efficiency

### AWS Costs
- S3 storage costs apply for uploaded files
- Data transfer costs may apply for downloading legacy media
- Consider AWS pricing when migrating large projects

### Safety Precautions
1. **Always backup your target database** before running the migration
2. **Test with dry-run first** to preview what will be migrated
3. **Verify the project ID** exists in the source database
4. **Check disk space** on the target database server
5. **Ensure AWS credentials** have proper S3 permissions
6. **Monitor S3 costs** for large migrations

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - The script uses 60-second connection timeouts
   - For very large databases, you may need to increase this in the script

2. **Foreign Key Violations**
   - Usually indicates corruption in source data
   - Check the error message for the specific table/constraint

3. **Duplicate Key Errors**
   - May occur if target has data not in source
   - Consider cleaning target data first

4. **S3 Access Denied**
   - Verify AWS credentials are correct
   - Check IAM permissions for S3 bucket access
   - Ensure bucket exists and is accessible

5. **Legacy Media Not Found**
   - Some legacy URLs may no longer be accessible
   - Script will log warnings but continue with other files

### Debug Mode

Use `--verbose` to see:
- Detailed progress for each table
- SQL queries being executed
- S3 upload operations
- Individual media file processing
- Record counts for validation

## Example Output

```
[2024-01-15T10:30:00.000Z] [INFO] Starting project migration for project ID: 123
[2024-01-15T10:30:00.100Z] [INFO] Source: .env.source
[2024-01-15T10:30:00.101Z] [INFO] Target: .env.target
[2024-01-15T10:30:00.102Z] [INFO] Mode: LIVE
----------------------------------------
[2024-01-15T10:30:00.200Z] [INFO] Testing database connections...
[2024-01-15T10:30:00.500Z] [INFO] Validating project 123...
[2024-01-15T10:30:00.600Z] [INFO] Found project: My Research Project (ID: 123)
[2024-01-15T10:30:00.700Z] [INFO] Analyzing data to migrate...
[2024-01-15T10:30:01.000Z] [INFO] Total records to migrate: 5432
[2024-01-15T10:30:01.100Z] [INFO] Starting data migration...
[2024-01-15T10:30:01.200Z] [INFO]   projects: 0 inserted, 1 updated
[2024-01-15T10:30:01.300Z] [INFO]   taxa: 45 inserted, 10 updated
[2024-01-15T10:30:01.500Z] [INFO]   characters: 120 inserted, 30 updated
...
[2024-01-15T10:30:15.000Z] [INFO] Committing transaction...
[2024-01-15T10:30:15.500Z] [INFO] Migration completed successfully!

[2024-01-15T10:30:15.600Z] [INFO] Starting S3 migration...
[2024-01-15T10:30:16.000Z] [INFO] Migrated journal cover to S3 for project 123
[2024-01-15T10:30:16.100Z] [INFO] Migrating media files to S3...
[2024-01-15T10:30:45.000Z] [INFO]   Media files: 156 migrated, 2 failed

[2024-01-15T10:30:45.100Z] [INFO] Re-dumping project data...
[2024-01-15T10:30:46.000Z] [INFO] Dump results:
[2024-01-15T10:30:46.001Z] [INFO]   Projects list: uploaded to S3
[2024-01-15T10:30:46.002Z] [INFO]   Project details: uploaded to S3
[2024-01-15T10:30:46.003Z] [INFO]   Media files: uploaded to S3

Migration Summary:
  Project: My Research Project (ID: 123)
  Duration: 46.50 seconds
  Total records processed: 5432
  Total: 4932 records inserted, 500 records updated
```

## Advanced Usage

### Migrating Multiple Projects

Create a bash script to migrate multiple projects:
```bash
#!/bin/bash
PROJECT_IDS=(123 456 789)

for id in "${PROJECT_IDS[@]}"; do
  echo "Migrating project $id..."
  node migrate-project-data.js \
    --project-id=$id \
    --source-env=.env.source \
    --target-env=.env.target
  echo "Completed project $id"
  echo "---"
done
```

### Monitoring Progress

For long-running migrations, use `--verbose` and redirect output:
```bash
node migrate-project-data.js \
  --project-id=123 \
  --source-env=.env.source \
  --target-env=.env.target \
  --verbose \
  2>&1 | tee migration_123.log
```

## Support

For issues or questions:
1. Check the error logs with `--verbose`
2. Verify database connectivity
3. Ensure proper AWS permissions
4. Check available disk space
5. Review the troubleshooting section

## License

This script is part of the MorphoBank project and follows the same licensing terms.