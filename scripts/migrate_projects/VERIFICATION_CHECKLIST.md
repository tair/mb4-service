# Migration Verification Checklist

Use this checklist to verify that all project data has been migrated correctly.

## Pre-Migration Checks

- [ ] Verify source project exists and is accessible
- [ ] Check target database connectivity
- [ ] Ensure sufficient disk space on target server
- [ ] Backup target database (if updating existing data)
- [ ] Note source project statistics (taxa, characters, cells, media files)

## Post-Migration Verification

### Core Data
- [ ] Project record exists with correct metadata
- [ ] Project name and description match source
- [ ] Journal metadata is preserved
- [ ] Project settings are correct

### Users and Permissions
- [ ] All project members are linked
- [ ] User permissions are preserved
- [ ] Member groups are created
- [ ] Group assignments are correct

### Taxonomic Data
- [ ] Taxa count matches source
- [ ] Specimen count matches source
- [ ] Taxa-specimen relationships preserved
- [ ] Resolved taxonomy links maintained

### Character Data
- [ ] Character count matches source
- [ ] Character states are complete
- [ ] Character ordering preserved
- [ ] Character rules functional

### Matrix Data
- [ ] Cell count matches source
- [ ] Cell values are correct
- [ ] Cell notes preserved
- [ ] Change logs maintained

### Media Files
- [ ] Media file count matches source
- [ ] Media metadata preserved
- [ ] S3 keys updated (if S3 migration enabled)
- [ ] Media views maintained
- [ ] Media labels preserved

### Documents and Folios
- [ ] Document count matches source
- [ ] Folder structure preserved
- [ ] Folio records complete
- [ ] Document-media links maintained

### Bibliography
- [ ] Reference count matches source
- [ ] Author information complete
- [ ] Citations properly linked

### Matrices
- [ ] Matrix definitions preserved
- [ ] Character/taxa ordering maintained
- [ ] Upload records preserved
- [ ] Additional blocks migrated

### S3 Migration (if enabled)
- [ ] Journal cover uploaded to S3
- [ ] Media files uploaded to S3
- [ ] Database updated with S3 keys
- [ ] Legacy URLs no longer referenced

### Data Dumps (if enabled)
- [ ] projects.json updated
- [ ] Project details JSON created
- [ ] Media files JSON created
- [ ] All files uploaded to S3

## Common Issues to Check

1. **Missing Cross-References**
   - Verify all _x_ tables have correct links
   - Check for orphaned records

2. **Character Encoding**
   - Ensure UTF-8 characters preserved
   - Check for mojibake in text fields

3. **JSON Fields**
   - Verify JSON data is valid
   - Check media JSON structure

4. **Timestamps**
   - Ensure created/modified dates preserved
   - Check for timezone issues

5. **User References**
   - Verify user_id fields are valid
   - Check for missing user links

## Rollback Procedure

If issues are found:
1. Note the specific problem
2. Check migration logs for errors
3. Restore target database from backup
4. Fix the issue in the migration script
5. Re-run migration with --dry-run first
6. Execute full migration after verification
