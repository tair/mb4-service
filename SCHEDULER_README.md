# MB4 Scheduler Service

The MB4 Scheduler Service provides automated task scheduling for the MorphoBank application, including CIPRES job synchronization.

## Features

- **Automated CIPRES Sync**: Runs every 5 minutes to sync job status from CIPRES
- **RESTful API**: Manage scheduler via HTTP endpoints
- **Logging**: Comprehensive logging with timestamps
- **Error Handling**: Robust error handling and recovery
- **Extensible**: Easy to add new scheduled tasks

## Installation

1. Install the required dependency:
```bash
npm install node-cron
```

2. The scheduler will start automatically when the application starts (unless disabled via environment variable).

## API Endpoints

### Health Check
```
GET /scheduler/health
```
Returns scheduler health status and basic information.

### Scheduler Management
```
GET /scheduler/status
```
Get detailed scheduler status including running jobs.

```
POST /scheduler/start
```
Start the scheduler service.

```
POST /scheduler/stop
```
Stop the scheduler service.

### Job Management
```
POST /scheduler/sync-cipres-jobs
```
Manually trigger CIPRES job synchronization.

```
POST /scheduler/trigger/:jobName
```
Manually trigger a specific job by name.

Available job names:
- `cipres-sync`: Sync CIPRES jobs
- `daily-cleanup`: Daily cleanup task (example)

## Configuration

### Environment Variables

- **SCHEDULER_ENABLED**: Set to `'false'` to disable the internal cron scheduler (default: `true`)

### Scheduled Tasks

The scheduler runs the following tasks:

- **CIPRES Sync**: Every 5 minutes (`*/5 * * * *`)
- **Daily Cleanup**: Every day at 2 AM UTC (`0 2 * * *`) - commented out by default

## Shell Scripts

### Basic Script
`sync_mb4_cipres.sh` - Simple script for manual sync (updated for new endpoint)

### Improved Script
`sync_mb4_cipres_improved.sh` - Enhanced script with:
- Better error handling
- Logging to file
- Service health checks
- Proper authentication handling

Usage:
```bash
# Make executable
chmod +x sync_mb4_cipres_improved.sh

# Configure email and password
vim sync_mb4_cipres_improved.sh

# Run
./sync_mb4_cipres_improved.sh
```

## Enabling/Disabling the Scheduler

### Via Environment Variable
```bash
# Disable the scheduler
export SCHEDULER_ENABLED=false
npm start

# Enable the scheduler (default)
export SCHEDULER_ENABLED=true
npm start
```

### Via API (Runtime Control)
```bash
# Stop the scheduler
curl -X POST http://localhost:81/services/scheduler/stop

# Start the scheduler
curl -X POST http://localhost:81/services/scheduler/start

# Check status
curl http://localhost:81/services/scheduler/status
```

## Systemd Integration (Optional)

For production environments, you can use systemd instead of the built-in scheduler:

1. Copy service files:
```bash
sudo cp systemd/mb4-cipres-sync.service /etc/systemd/system/
sudo cp systemd/mb4-cipres-sync.timer /etc/systemd/system/
```

2. Update paths in service file:
```bash
sudo vim /etc/systemd/system/mb4-cipres-sync.service
```

3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mb4-cipres-sync.timer
sudo systemctl start mb4-cipres-sync.timer
```

4. Check status:
```bash
sudo systemctl status mb4-cipres-sync.timer
sudo systemctl list-timers mb4-cipres-sync.timer
```

## Monitoring

### Application Logs
The scheduler logs to the application console with timestamps:
```
[2024-01-15T10:30:00.000Z] Starting CIPRES sync...
[2024-01-15T10:30:01.234Z] CIPRES sync completed successfully in 1234ms
```

### Script Logs
The improved shell script logs to `/var/log/mb4-cipres-sync.log`:
```bash
tail -f /var/log/mb4-cipres-sync.log
```

### Health Monitoring
Use the health endpoint to monitor scheduler status:
```bash
curl http://localhost:81/services/scheduler/health
```

## Adding New Scheduled Tasks

1. Add the cron schedule in `SchedulerService.start()`:
```javascript
const newJob = cron.schedule('0 0 * * *', async () => {
  await this.newTask()
}, {
  scheduled: true,
  timezone: 'UTC'
})
this.jobs.set('new-task', newJob)
```

2. Implement the task method:
```javascript
async newTask() {
  console.log('Running new task...')
  // Task implementation
}
```

3. Add to the trigger method:
```javascript
case 'new-task':
  await this.newTask()
  break
```

## Troubleshooting

### Scheduler Not Starting
- Check application logs for error messages
- Verify `node-cron` dependency is installed
- Ensure no port conflicts

### CIPRES Sync Failing
- Check CIPRES service configuration
- Verify database connectivity
- Check authentication credentials

### High Resource Usage
- Monitor job execution times
- Consider reducing sync frequency
- Check for memory leaks in long-running tasks

## Development

### Testing
```bash
# Test manual sync
curl -X POST http://localhost:81/services/scheduler/sync-cipres-jobs

# Test job trigger
curl -X POST http://localhost:81/services/scheduler/trigger/cipres-sync

# Check status
curl http://localhost:81/services/scheduler/status
```

### Debugging
Enable debug logging by setting environment variable:
```bash
DEBUG=scheduler npm run dev
``` 