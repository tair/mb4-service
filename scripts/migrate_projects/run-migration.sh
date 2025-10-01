#!/bin/bash

# Helper script to run the migration from the correct directory
# This ensures all relative paths and imports work correctly

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if all required arguments are provided
if [ $# -lt 3 ]; then
    echo "Usage: $0 <project-id> <source-env> <target-env> [additional-options]"
    echo ""
    echo "Example:"
    echo "  $0 123 .env.source .env.target"
    echo "  $0 123 .env.source .env.target --dry-run"
    echo "  $0 123 .env.source .env.target --verbose --skip-s3"
    echo ""
    exit 1
fi

PROJECT_ID=$1
SOURCE_ENV=$2
TARGET_ENV=$3
shift 3  # Remove first three arguments, keep the rest

# Change to the script directory
cd "$SCRIPT_DIR"

# Run the migration script with all arguments
echo "Running migration for project $PROJECT_ID..."
node migrate-project-data.js \
    --project-id=$PROJECT_ID \
    --source-env=$SOURCE_ENV \
    --target-env=$TARGET_ENV \
    "$@"
