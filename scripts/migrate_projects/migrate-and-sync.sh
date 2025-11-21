#!/bin/bash

# Migrate and Sync Project Data
# This script performs a complete migration and cleanup to ensure the target database
# is identical to the source database for a given project.

set -e  # Exit on error

# Parse command line arguments
PROJECT_ID=""
SOURCE_ENV=""
TARGET_ENV=""
DRY_RUN=""
VERBOSE=""
SKIP_S3=""
SKIP_DUMPS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --project-id=*)
      PROJECT_ID="${1#*=}"
      shift
      ;;
    --source-env=*)
      SOURCE_ENV="${1#*=}"
      shift
      ;;
    --target-env=*)
      TARGET_ENV="${1#*=}"
      shift
      ;;
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --verbose)
      VERBOSE="--verbose"
      shift
      ;;
    --skip-s3)
      SKIP_S3="--skip-s3"
      shift
      ;;
    --skip-dumps)
      SKIP_DUMPS="--skip-dumps"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --project-id=<id> --source-env=<file> --target-env=<file> [--dry-run] [--verbose] [--skip-s3] [--skip-dumps]"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$PROJECT_ID" ] || [ -z "$SOURCE_ENV" ] || [ -z "$TARGET_ENV" ]; then
  echo "Error: Missing required arguments"
  echo "Usage: $0 --project-id=<id> --source-env=<file> --target-env=<file> [--dry-run] [--verbose] [--skip-s3] [--skip-dumps]"
  exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo "  Project Migration & Sync Script"
echo "=========================================="
echo "Project ID:    $PROJECT_ID"
echo "Source Env:    $SOURCE_ENV"
echo "Target Env:    $TARGET_ENV"
echo "Dry Run:       ${DRY_RUN:-false}"
echo "Verbose:       ${VERBOSE:-false}"
echo "Skip S3:       ${SKIP_S3:-false}"
echo "Skip Dumps:    ${SKIP_DUMPS:-false}"
echo "=========================================="
echo ""

# Step 1: Migrate data
echo "📦 Step 1: Migrating project data..."
echo ""
node "$SCRIPT_DIR/migrate-project-data.js" \
  --project-id=$PROJECT_ID \
  --source-env=$SOURCE_ENV \
  --target-env=$TARGET_ENV \
  $DRY_RUN $VERBOSE $SKIP_S3 $SKIP_DUMPS

if [ $? -ne 0 ]; then
  echo "❌ Migration failed. Aborting cleanup."
  exit 1
fi

echo ""
echo "✅ Migration completed successfully!"
echo ""

# Step 2: Cleanup orphaned records
echo "🧹 Step 2: Cleaning up orphaned records..."
echo ""
node "$SCRIPT_DIR/cleanup-project-data.js" \
  --project-id=$PROJECT_ID \
  --source-env=$SOURCE_ENV \
  --target-env=$TARGET_ENV \
  $DRY_RUN $VERBOSE

if [ $? -ne 0 ]; then
  echo "❌ Cleanup failed."
  exit 1
fi

echo ""
echo "✅ Cleanup completed successfully!"
echo ""

# Summary
echo "=========================================="
echo "  ✨ SYNC COMPLETE"
echo "=========================================="
if [ -n "$DRY_RUN" ]; then
  echo "⚠️  DRY RUN - No changes were made"
  echo ""
  echo "Run without --dry-run to apply changes:"
  echo "$0 --project-id=$PROJECT_ID --source-env=$SOURCE_ENV --target-env=$TARGET_ENV $VERBOSE $SKIP_S3 $SKIP_DUMPS"
else
  echo "Target database is now identical to source for project $PROJECT_ID"
fi
echo "=========================================="

