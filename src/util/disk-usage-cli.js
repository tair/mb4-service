#!/usr/bin/env node

/**
 * Disk Usage CLI Utility
 * Command-line tool for managing project disk usage
 */

import DiskUsageService from '../services/disk-usage-service.js'
import { models } from '../models/init-models.js'
import sequelizeConn from './db.js'

const COMMANDS = {
  'validate': 'Validate disk usage for projects',
  'recalculate': 'Recalculate disk usage for projects',
  'stats': 'Show disk usage statistics',
  'over-limit': 'Show projects over their disk limit',
  'top-usage': 'Show projects with highest disk usage',
  'set-limit': 'Set disk usage limit for a project',
  'help': 'Show this help message'
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help') {
    showHelp()
    process.exit(0)
  }

  try {
    // Initialize database connection
    await sequelizeConn.authenticate()
    console.log('Database connection established.')

    switch (command) {
      case 'validate':
        await handleValidate(args.slice(1))
        break
      case 'recalculate':
        await handleRecalculate(args.slice(1))
        break
      case 'stats':
        await handleStats()
        break
      case 'over-limit':
        await handleOverLimit()
        break
      case 'top-usage':
        await handleTopUsage(args.slice(1))
        break
      case 'set-limit':
        await handleSetLimit(args.slice(1))
        break
      default:
        console.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await sequelizeConn.close()
  }
}

function showHelp() {
  console.log('Disk Usage Management CLI')
  console.log('========================')
  console.log('')
  console.log('Usage: node disk-usage-cli.js <command> [options]')
  console.log('')
  console.log('Commands:')
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`)
  })
  console.log('')
  console.log('Examples:')
  console.log('  node disk-usage-cli.js stats')
  console.log('  node disk-usage-cli.js validate --project 123')
  console.log('  node disk-usage-cli.js validate --all')
  console.log('  node disk-usage-cli.js recalculate --project 123')
  console.log('  node disk-usage-cli.js recalculate --all')
  console.log('  node disk-usage-cli.js top-usage --limit 20')
  console.log('  node disk-usage-cli.js set-limit --project 123 --limit 10GB')
}

async function handleValidate(args) {
  const projectId = getProjectIdFromArgs(args)
  const all = args.includes('--all')

  if (!projectId && !all) {
    console.error('Please specify --project <id> or --all')
    process.exit(1)
  }

  if (projectId) {
    console.log(`Validating disk usage for project ${projectId}...`)
    const result = await DiskUsageService.validateProject(projectId)
    printValidationResult(result)
  } else {
    console.log('Validating disk usage for all projects...')
    const results = await DiskUsageService.validateAllProjects()
    
    const accurate = results.filter(r => !r.error && r.is_accurate)
    const inaccurate = results.filter(r => !r.error && !r.is_accurate)
    const errors = results.filter(r => r.error)

    console.log(`\nValidation Summary:`)
    console.log(`  Total projects: ${results.length}`)
    console.log(`  Accurate: ${accurate.length}`)
    console.log(`  Inaccurate: ${inaccurate.length}`)
    console.log(`  Errors: ${errors.length}`)

    if (inaccurate.length > 0) {
      console.log('\nInaccurate projects (will be auto-corrected):')
      inaccurate.forEach(result => {
        console.log(`  P${result.project_id} (${result.project_name || 'Unknown'}): ${result.discrepancy} bytes difference`)
      })
    }

    if (errors.length > 0) {
      console.log('\nProjects with errors:')
      errors.forEach(result => {
        console.log(`  P${result.project_id} (${result.project_name || 'Unknown'}): ${result.error}`)
      })
    }
  }
}

async function handleRecalculate(args) {
  const projectId = getProjectIdFromArgs(args)
  const all = args.includes('--all')

  if (!projectId && !all) {
    console.error('Please specify --project <id> or --all')
    process.exit(1)
  }

  if (projectId) {
    console.log(`Recalculating disk usage for project ${projectId}...`)
    const result = await DiskUsageService.recalculateProject(projectId)
    if (result) {
      printRecalculationResult(result)
    } else {
      console.log('Project not found')
    }
  } else {
    console.log('Recalculating disk usage for all projects...')
    const results = await DiskUsageService.recalculateAllProjects()
    
    const successful = results.filter(r => !r.error)
    const failed = results.filter(r => r.error)

    console.log(`\nRecalculation Summary:`)
    console.log(`  Total projects: ${results.length}`)
    console.log(`  Successful: ${successful.length}`)
    console.log(`  Failed: ${failed.length}`)

    if (successful.length > 0) {
      console.log('\nSuccessful recalculations:')
      successful.forEach(result => {
        const change = result.difference > 0 ? `+${result.difference}` : result.difference.toString()
        console.log(`  P${result.project_id} (${result.project_name}): ${result.old_mb}MB → ${result.new_mb}MB (${change} bytes)`)
      })
    }

    if (failed.length > 0) {
      console.log('\nFailed recalculations:')
      failed.forEach(result => {
        console.log(`  P${result.project_id} (${result.project_name || 'Unknown'}): ${result.error}`)
      })
    }
  }
}

async function handleStats() {
  console.log('Getting disk usage statistics...')
  const stats = await DiskUsageService.getUsageStatistics()
  
  console.log('\nDisk Usage Statistics:')
  console.log(`  Total projects: ${stats.total_projects}`)
  console.log(`  Projects over limit: ${stats.projects_over_limit}`)
  console.log(`  Total usage: ${stats.total_usage_gb} GB`)
  console.log(`  Total limit: ${stats.total_limit_gb} GB`)
  console.log(`  Average usage: ${stats.avg_usage_mb} MB`)
  console.log(`  Max usage: ${stats.max_usage_mb} MB`)
  console.log(`  Utilization: ${stats.utilization_percentage}%`)
}

async function handleOverLimit() {
  console.log('Getting projects over their disk limit...')
  const projects = await DiskUsageService.getProjectsOverLimit()
  
  if (projects.length === 0) {
    console.log('No projects are over their disk limit.')
    return
  }

  console.log(`\nProjects over limit (${projects.length}):`)
  projects.forEach(project => {
    console.log(`  P${project.project_id} (${project.project_name}):`)
    console.log(`    Usage: ${project.usage_mb} MB (${project.usage_percentage}%)`)
    console.log(`    Limit: ${project.limit_mb} MB`)
    console.log(`    Over by: ${project.over_limit_mb} MB`)
    if (project.owner) {
      console.log(`    Owner: ${project.owner.name} (${project.owner.email})`)
    }
    console.log('')
  })
}

async function handleTopUsage(args) {
  const limit = getLimitFromArgs(args) || 10
  console.log(`Getting top ${limit} projects by disk usage...`)
  
  const projects = await DiskUsageService.getTopUsageProjects(limit)
  
  if (projects.length === 0) {
    console.log('No projects found.')
    return
  }

  console.log(`\nTop ${projects.length} projects by disk usage:`)
  projects.forEach((project, index) => {
    console.log(`  ${(index + 1).toString().padStart(2)}. P${project.project_id} (${project.project_name}):`)
    console.log(`      Usage: ${project.usage_mb} MB (${project.usage_percentage}% of limit)`)
    if (project.owner) {
      console.log(`      Owner: ${project.owner.name} (${project.owner.email})`)
    }
  })
}

async function handleSetLimit(args) {
  const projectId = getProjectIdFromArgs(args)
  const limit = getLimitValueFromArgs(args)

  if (!projectId) {
    console.error('Please specify --project <id>')
    process.exit(1)
  }

  if (!limit) {
    console.error('Please specify --limit <size> (e.g., 5GB, 1024MB)')
    process.exit(1)
  }

  console.log(`Setting disk limit for project ${projectId} to ${limit}...`)
  
  try {
    const limitBytes = DiskUsageService.parseSize(limit)
    
    // Create a mock user for the update (CLI operations)
    const mockUser = { user_id: 0, fname: 'CLI', lname: 'Admin' }
    
    const result = await DiskUsageService.updateProjectLimit(projectId, limitBytes, mockUser)
    
    console.log(`\nLimit updated successfully:`)
    console.log(`  Project: P${result.project_id} (${result.project_name})`)
    console.log(`  Old limit: ${result.old_limit_mb} MB`)
    console.log(`  New limit: ${result.new_limit_mb} MB`)
    console.log(`  Current usage: ${result.current_usage_mb} MB`)
  } catch (error) {
    console.error(`Failed to set limit: ${error.message}`)
    process.exit(1)
  }
}

function getProjectIdFromArgs(args) {
  const projectIndex = args.indexOf('--project')
  if (projectIndex !== -1 && args[projectIndex + 1]) {
    const id = parseInt(args[projectIndex + 1])
    if (isNaN(id)) {
      console.error('Project ID must be a number')
      process.exit(1)
    }
    return id
  }
  return null
}

function getLimitFromArgs(args) {
  const limitIndex = args.indexOf('--limit')
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const limit = parseInt(args[limitIndex + 1])
    if (isNaN(limit)) {
      console.error('Limit must be a number')
      process.exit(1)
    }
    return limit
  }
  return null
}

function getLimitValueFromArgs(args) {
  const limitIndex = args.indexOf('--limit')
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    return args[limitIndex + 1]
  }
  return null
}

function printValidationResult(result) {
  console.log(`\nValidation Result for Project ${result.project_id}:`)
  console.log(`  Calculated usage: ${result.calculated_mb} MB`)
  console.log(`  Stored usage: ${result.stored_mb} MB`)
  console.log(`  Discrepancy: ${result.discrepancy} bytes`)
  console.log(`  Status: ${result.is_accurate ? 'ACCURATE' : 'INACCURATE'}`)
}

function printRecalculationResult(result) {
  console.log(`\nRecalculation Result for Project ${result.project_id}:`)
  console.log(`  Project: ${result.project_name}`)
  console.log(`  Old usage: ${result.old_mb} MB`)
  console.log(`  New usage: ${result.new_mb} MB`)
  console.log(`  Difference: ${result.difference > 0 ? '+' : ''}${result.difference} bytes`)
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
