#!/bin/bash

# Configuration
EMAIL=<your_email>
PASSWORD=<your_password>
BASE_URL="http://localhost:81/services"
LOG_FILE="/var/log/mb4-cipres-sync.log"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if service is running
check_service() {
    local url="$BASE_URL/scheduler/health"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" -eq 200 ]; then
        return 0
    else
        return 1
    fi
}

# Function to authenticate and get token
authenticate() {
    log "Authenticating with email: $EMAIL"
    
    local auth_response=$(curl -s "$BASE_URL/auth/login" \
        -d "email=$EMAIL&password=$PASSWORD" \
        -H "Content-Type: application/x-www-form-urlencoded")
    
    if [ $? -ne 0 ]; then
        log "ERROR: Failed to make authentication request"
        return 1
    fi
    
    # Extract token from response
    local token=$(echo "$auth_response" | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    
    if [ -z "$token" ]; then
        log "ERROR: Failed to extract authentication token"
        log "Auth response: $auth_response"
        return 1
    fi
    
    echo "$token"
    return 0
}

# Function to sync CIPRES jobs
sync_cipres_jobs() {
    local token=$1
    
    log "Starting CIPRES jobs sync..."
    
    local response=$(curl -s -w "\n%{http_code}" \
        --cookie "authorization=Bearer $token" \
        --request POST \
        "$BASE_URL/scheduler/sync-cipres-jobs")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        log "SUCCESS: CIPRES jobs sync completed"
        log "Response: $body"
        return 0
    else
        log "ERROR: CIPRES jobs sync failed with HTTP code: $http_code"
        log "Response: $body"
        return 1
    fi
}

# Main execution
main() {
    log "=== Starting MB4 CIPRES Sync ==="
    
    # Check if service is running
    if ! check_service; then
        log "ERROR: MB4 service is not running or not responding"
        exit 1
    fi
    
    log "MB4 service is running"
    
    # Authenticate
    token=$(authenticate)
    if [ $? -ne 0 ]; then
        log "ERROR: Authentication failed"
        exit 1
    fi
    
    log "Authentication successful"
    
    # Sync CIPRES jobs
    if sync_cipres_jobs "$token"; then
        log "=== CIPRES Sync Completed Successfully ==="
        exit 0
    else
        log "=== CIPRES Sync Failed ==="
        exit 1
    fi
}

# Run main function
main "$@" 