# Journal Cover Migration Guide

This guide explains how to migrate journal cover images from the old MorphoBank URLs to your S3 bucket.

## Overview

The migration process consists of two main steps:

1. **File Migration** (`migrate-journal-covers.js`): Downloads journal cover images from MorphoBank and uploads them to your S3 bucket
2. **Database Update** (`update-journal-covers-db.js`): Updates the database records to point to the new S3 locations

## Prerequisites

- Node.js environment with access to your database
- AWS S3 credentials configured in your environment
- Network access to download files from `morphobank.org`

## File Structure

After migration, journal covers will be stored in S3 with the following structure:
```
s3://your-bucket/media_files/journal_covers/uploads/
├── projects_journal_cover_123.jpg
├── projects_journal_cover_456.png
└── projects_journal_cover_789.gif
```

Where the filename format is: `projects_journal_cover_{project_id}.{extension}`

## Step 1: File Migration

### Basic Usage

```bash
# Dry run to see what would be migrated
node migrate-journal-covers.js --dry-run

# Migrate all journal covers
node migrate-journal-covers.js

# Migrate with verbose logging
node migrate-journal-covers.js --verbose
```

### Advanced Options

```bash
# Test with a limited number of records
node migrate-journal-covers.js --limit=10

# Migrate a specific project
node migrate-journal-covers.js --project-id=123

# Combine options
node migrate-journal-covers.js --limit=5 --verbose --dry-run
```

### Command Line Options

- `--dry-run`: Show what would be migrated without actually doing it
- `--limit=N`: Process only N records (useful for testing)
- `--project-id=N`: Process only a specific project ID
- `--verbose`: Show detailed logging information

### Example Output

```
[2024-01-15T10:30:00.000Z] [INFO] Starting journal cover migration...
[2024-01-15T10:30:00.001Z] [INFO] Configuration:
[2024-01-15T10:30:00.002Z] [INFO]   Dry run: false
[2024-01-15T10:30:00.003Z] [INFO]   Limit: none
[2024-01-15T10:30:00.004Z] [INFO]   Project ID: all
[2024-01-15T10:30:00.005Z] [INFO]   S3 Bucket: your-bucket
[2024-01-15T10:30:00.006Z] [INFO]   S3 Path: media_files/journal_covers/uploads
[2024-01-15T10:30:00.007Z] [INFO] Found 45 projects with journal covers
[2024-01-15T10:30:01.000Z] [INFO] Processing batch 1/5 (10 projects)
[2024-01-15T10:30:05.000Z] [INFO] Project 123: Successfully migrated journal cover
[2024-01-15T10:30:10.000Z] [INFO] Progress: 10/45 (22%)

=== Migration Complete ===
Total projects: 45
Processed: 45
Successful: 42
Skipped: 2
Failed: 1
```

## Step 2: Database Update

After successfully migrating the files, update the database records:

### Basic Usage

```bash
# Dry run to see what would be updated
node update-journal-covers-db.js --dry-run

# Update all database records
node update-journal-covers-db.js

# Update with verbose logging
node update-journal-covers-db.js --verbose
```

### Advanced Options

```bash
# Test with a limited number of records
node update-journal-covers-db.js --limit=10

# Update a specific project
node update-journal-covers-db.js --project-id=123
```

## Database Schema Changes

### Before Migration

The `journal_cover` field contains:
```json
{
  "preview": {
    "HASH": "abc123",
    "MAGIC": "def456",
    "FILENAME": "journal_cover.jpg"
  }
}
```

### After Migration

The `journal_cover` field will contain:
```json
{
  "filename": "projects_journal_cover_123.jpg",
  "ORIGINAL_FILENAME": "journal_cover.jpg",
  "migrated": true,
  "migrated_at": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

### Common Issues

1. **Network Timeouts**: The script includes retry logic for network issues
2. **File Not Found**: Files that don't exist on MorphoBank will be skipped
3. **S3 Upload Failures**: Check your AWS credentials and bucket permissions
4. **Database Connection**: Ensure your database connection is properly configured

### Error Recovery

If the migration fails partway through:

1. Check the error logs to identify the issue
2. Fix the underlying problem (network, credentials, etc.)
3. Re-run the migration - it will skip files that already exist in S3
4. Use `--project-id` to retry specific failed projects

## Monitoring and Logging

### Log Levels

- `INFO`: General progress and status updates
- `WARN`: Non-critical issues (files already exist, etc.)
- `ERROR`: Critical failures that need attention
- `DEBUG`: Detailed information (only shown with `--verbose`)

### Statistics

The scripts provide detailed statistics:
- Total projects found
- Successfully processed
- Skipped (already migrated or no data)
- Failed with error details

## Testing

### Recommended Testing Approach

1. **Start with a dry run**:
   ```bash
   node migrate-journal-covers.js --dry-run --limit=5
   ```

2. **Test with a small batch**:
   ```bash
   node migrate-journal-covers.js --limit=5 --verbose
   ```

3. **Test database update**:
   ```bash
   node update-journal-covers-db.js --dry-run --limit=5
   ```

4. **Run full migration**:
   ```bash
   node migrate-journal-covers.js
   node update-journal-covers-db.js
   ```

## Rollback

If you need to rollback the migration:

1. **Database rollback**: The old `journal_cover` data is preserved in the `preview` field, so you can restore it
2. **File cleanup**: Remove files from S3 if needed (they're stored in `media_files/journal_covers/uploads/`)

## Performance Considerations

- The migration processes files in batches of 10 to avoid overwhelming the system
- Network timeouts are set to 30 seconds per file
- Retry logic includes exponential backoff
- Temporary files are cleaned up automatically

## Security Notes

- The script uses temporary files in `/tmp/` - ensure this directory is secure
- AWS credentials should be properly configured via environment variables
- The script includes a User-Agent header for MorphoBank requests

## Support

If you encounter issues:

1. Check the error logs for specific error messages
2. Verify your AWS S3 configuration
3. Test network connectivity to MorphoBank
4. Ensure database permissions are correct
5. Try with `--limit=1` to isolate issues

## Example Complete Migration

```bash
# Step 1: Test with dry run
node migrate-journal-covers.js --dry-run --limit=5

# Step 2: Test actual migration with small batch
node migrate-journal-covers.js --limit=5 --verbose

# Step 3: Test database update
node update-journal-covers-db.js --dry-run --limit=5

# Step 4: Run full migration
node migrate-journal-covers.js --verbose
node update-journal-covers-db.js --verbose

# Step 5: Verify results
node migrate-journal-covers.js --dry-run  # Should show 0 projects to migrate
```
