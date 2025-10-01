/**
 * Authentication and authorization middleware
 */

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
