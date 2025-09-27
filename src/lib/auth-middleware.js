/**
 * Authentication and authorization middleware
 */

import { MembershipType } from '../models/projects-x-user.js'

/**
 * Require admin privileges
 * Should be used after authenticateToken and authorizeUser middleware
 */
export function requireAdmin(req, res, next) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    })
  }

  // Check if user has admin role
  if (!req.user.roles || !req.user.roles.includes('admin')) {
    return res.status(403).json({ 
      message: 'Admin privileges required' 
    })
  }

  next()
}

/**
 * Require project admin privileges
 * Should be used after authenticateToken, authorizeUser, and authorizeProject middleware
 */
export function requireProjectAdmin(req, res, next) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    })
  }

  // Check if project is authorized
  if (!req.project) {
    return res.status(404).json({ 
      message: 'Project not found or access denied' 
    })
  }

  // Check if user is project owner or has admin role
  const isProjectOwner = req.project.user_id === req.user.user_id
  const isAdmin = req.user.roles && req.user.roles.includes('admin')
  
  if (!isProjectOwner && !isAdmin) {
    return res.status(403).json({ 
      message: 'Project admin privileges required' 
    })
  }

  next()
}

/**
 * Require user to be authenticated
 * Should be used after authenticateToken and authorizeUser middleware
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    })
  }
  next()
}

/**
 * Entity types for permission checking
 */
const EntityType = {
  MATRIX: 'matrix',
  BIBLIOGRAPHY: 'bibliography',
  SPECIMEN: 'specimen',
  MEDIA: 'media',
  MEDIA_VIEW: 'media_view',
  FOLIO: 'folio',
  DOCUMENT: 'document',
}

/**
 * Check if user can edit specific entity type based on membership
 * Should be used after authenticateToken, authorizeUser, and authorizeProject middleware
 */
export function requireEntityEditPermission(entityType) {
  return function(req, res, next) {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required' 
      })
    }

    // Check if project is authorized
    if (!req.project) {
      return res.status(404).json({ 
        message: 'Project not found or access denied' 
      })
    }

    // Allow system admins and project owners
    const isProjectOwner = req.project.user_id === req.user.user_id
    const isAdmin = req.user.roles && req.user.roles.includes('admin')
    const isCurator = req.user.roles && req.user.roles.includes('curator')
    
    if (isProjectOwner || isAdmin || isCurator) {
      return next()
    }

    // Check project membership
    const projectUser = req.project.user
    if (!projectUser) {
      return res.status(403).json({ 
        message: 'User is not a member of this project' 
      })
    }

    // Check membership-based permissions
    switch (projectUser.membership_type) {
      case MembershipType.ADMIN:
        // Full members can edit everything
        return next()
      
      case MembershipType.CHARACTER_ANNOTATOR:
        // Character annotators can only edit matrix content
        if (entityType === EntityType.MATRIX) {
          return next()
        }
        return res.status(403).json({ 
          message: 'Character annotators can only edit matrix and character content. Other content is view-only.' 
        })
      
      case MembershipType.BIBLIOGRAPHY_MAINTAINER:
        // Bibliography maintainers can only edit bibliography content
        if (entityType === EntityType.BIBLIOGRAPHY) {
          return next()
        }
        return res.status(403).json({ 
          message: 'Bibliography maintainers can only edit bibliography content. Other content is view-only.' 
        })
      
      case MembershipType.OBSERVER:
        // Observers cannot edit anything
        return res.status(403).json({ 
          message: 'Observers have view-only access and cannot edit content' 
        })
      
      default:
        return res.status(403).json({ 
          message: 'Unknown membership type' 
        })
    }
  }
}

// Export entity types for use in routes
export { EntityType }
