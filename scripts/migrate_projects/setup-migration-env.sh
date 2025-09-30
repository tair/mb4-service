#!/bin/bash

# Setup script for project migration environment files

echo "Setting up environment files for project migration..."

# Create .env.source if it doesn't exist
if [ ! -f .env.source ]; then
    cat > .env.source << 'EOF'
# Source Database Configuration
# Fill in your actual database credentials

# Database host (e.g., localhost, 192.168.1.100, db.example.com)
DB_HOST=localhost

# Database user with read permissions on all project-related tables
DB_USER=your_source_username

# Database name/schema
DB_SCHEMA=morphobank

# Database password
DB_PASSWORD=your_source_password

# Optional: Database port (defaults to 3306 for MySQL/MariaDB)
# DB_PORT=3306

# AWS Configuration (optional - only needed if source has S3 data)
# AWS_REGION=us-west-2
# AWS_ACCESS_KEY_ID=your_access_key_id
# AWS_SECRET_ACCESS_KEY=your_secret_access_key
# AWS_S3_DEFAULT_BUCKET=mb4-data

# Application Configuration (optional)
# APP_FRONTEND_DOMAIN=https://morphobank.org
EOF
    echo "Created .env.source - Please edit with your source database credentials"
else
    echo ".env.source already exists"
fi

# Create .env.target if it doesn't exist
if [ ! -f .env.target ]; then
    cat > .env.target << 'EOF'
# Target Database Configuration
# Fill in your actual database credentials

# Database host (e.g., localhost, 192.168.1.100, db.example.com)
DB_HOST=localhost

# Database user with read/write permissions on all project-related tables
DB_USER=your_target_username

# Database name/schema
DB_SCHEMA=morphobank

# Database password
DB_PASSWORD=your_target_password

# Optional: Database port (defaults to 3306 for MySQL/MariaDB)
# DB_PORT=3306

# AWS Configuration (required for S3 migration and data dumps)
# Leave commented out to skip S3 operations
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_DEFAULT_BUCKET=mb4-data

# Application Configuration (required for data dumps)
APP_FRONTEND_DOMAIN=https://morphobank.org
EOF
    echo "Created .env.target - Please edit with your target database credentials"
else
    echo ".env.target already exists"
fi

# Add .env files to .gitignore if not already there
if [ -f ../../.gitignore ]; then
    if ! grep -q "scripts/migrate_projects/\.env\." ../../.gitignore; then
        echo -e "\n# Migration environment files\nscripts/migrate_projects/.env.source\nscripts/migrate_projects/.env.target" >> ../../.gitignore
        echo "Added .env files to .gitignore"
    fi
fi

echo ""
echo "Setup complete! Next steps:"
echo "1. Edit .env.source with your source database credentials"
echo "2. Edit .env.target with your target database credentials and AWS configuration"
echo "3. Test the connections:"
echo "   node test-migration-connection.js --project-id=YOUR_PROJECT_ID --source-env=.env.source --target-env=.env.target"
echo "4. Run the migration:"
echo "   node migrate-project-data.js --project-id=YOUR_PROJECT_ID --source-env=.env.source --target-env=.env.target"
echo ""
echo "Note: AWS credentials in .env.target are required for:"
echo "  - Migrating journal covers and media files to S3"
echo "  - Re-dumping project data after migration"
echo "  - You can skip these with --skip-s3 and --skip-dumps flags"
echo ""