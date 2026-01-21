/**
 * Date Parser Utility
 * Parses natural language date ranges into Unix timestamps
 * Supports: "today", "yesterday", "last week", "April 2012", date ranges, etc.
 */

/**
 * Parse a date range string into start and end Unix timestamps
 * @param {string} input - Date range string (e.g., "today", "last week", "April 2012")
 * @returns {{start: number, end: number, displayText: string}} Date range object
 */
export function parseDateRange(input) {
  if (!input || typeof input !== 'string') {
    return getTodayRange()
  }
  
  const normalized = input.trim().toLowerCase()
  const now = new Date()
  
  // Handle special keywords
  switch (normalized) {
    case 'today':
      return getTodayRange()
    
    case 'yesterday':
      return getYesterdayRange()
    
    case 'last week':
      return getLastWeekRange()
    
    case 'last month':
      return getLastMonthRange()
    
    case 'this month':
      return getThisMonthRange()
    
    case 'this year':
      return getThisYearRange()
    
    case 'last year':
      return getLastYearRange()
  }
  
  // Handle month names (e.g., "April 2012")
  const monthYearMatch = input.match(/^(\w+)\s+(\d{4})$/i)
  if (monthYearMatch) {
    return parseMonthYear(monthYearMatch[1], monthYearMatch[2])
  }
  
  // Handle date ranges (e.g., "April 1 - April 30, 2012")
  const rangeMatch = input.match(/^(.+?)\s*-\s*(.+)$/i)
  if (rangeMatch) {
    return parseDateRangeString(rangeMatch[1].trim(), rangeMatch[2].trim())
  }
  
  // Try parsing as a single date
  const singleDate = parseSingleDate(input)
  if (singleDate) {
    return {
      start: singleDate.start,
      end: singleDate.end,
      displayText: input
    }
  }
  
  // Default to today if parsing fails
  console.warn(`Could not parse date range: "${input}", defaulting to today`)
  return getTodayRange()
}

/**
 * Get today's date range
 */
function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'today'
  }
}

/**
 * Get yesterday's date range
 */
function getYesterdayRange() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
  const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'yesterday'
  }
}

/**
 * Get last week's date range
 */
function getLastWeekRange() {
  const now = new Date()
  const lastWeek = new Date(now)
  lastWeek.setDate(now.getDate() - 7)
  
  // Get start of last week (Monday)
  const dayOfWeek = lastWeek.getDay()
  const diff = lastWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
  const startDate = new Date(lastWeek.setDate(diff))
  startDate.setHours(0, 0, 0, 0)
  
  // End of last week (Sunday)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  endDate.setHours(23, 59, 59, 999)
  
  return {
    start: Math.floor(startDate.getTime() / 1000),
    end: Math.floor(endDate.getTime() / 1000),
    displayText: 'last week'
  }
}

/**
 * Get last month's date range
 */
function getLastMonthRange() {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0)
  const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'last month'
  }
}

/**
 * Get this month's date range
 */
function getThisMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'this month'
  }
}

/**
 * Get this year's date range
 */
function getThisYearRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'this year'
  }
}

/**
 * Get last year's date range
 */
function getLastYearRange() {
  const now = new Date()
  const lastYear = now.getFullYear() - 1
  const start = new Date(lastYear, 0, 1, 0, 0, 0)
  const end = new Date(lastYear, 11, 31, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: 'last year'
  }
}

/**
 * Parse month and year (e.g., "April 2012")
 */
function parseMonthYear(monthName, year) {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  
  const monthIndex = monthNames.indexOf(monthName.toLowerCase())
  if (monthIndex === -1) {
    return getTodayRange()
  }
  
  const yearNum = parseInt(year, 10)
  if (isNaN(yearNum)) {
    return getTodayRange()
  }
  
  const start = new Date(yearNum, monthIndex, 1, 0, 0, 0)
  const end = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: `${monthName} ${year}`
  }
}

/**
 * Parse a date range string (e.g., "April 1 - April 30, 2012")
 */
function parseDateRangeString(startStr, endStr) {
  const startDate = parseSingleDateString(startStr)
  const endDate = parseSingleDateString(endStr)
  
  if (!startDate || !endDate) {
    return getTodayRange()
  }
  
  const start = new Date(startDate.year, startDate.month, startDate.day, 0, 0, 0)
  const end = new Date(endDate.year, endDate.month, endDate.day, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    displayText: `${startStr} - ${endStr}`
  }
}

/**
 * Parse a single date string
 */
function parseSingleDate(input) {
  const parsed = parseSingleDateString(input)
  if (!parsed) {
    return null
  }
  
  const start = new Date(parsed.year, parsed.month, parsed.day, 0, 0, 0)
  const end = new Date(parsed.year, parsed.month, parsed.day, 23, 59, 59)
  
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000)
  }
}

/**
 * Parse a single date string into components
 */
function parseSingleDateString(dateStr) {
  // Try various date formats
  const formats = [
    /^(\w+)\s+(\d+),\s*(\d{4})$/i, // "April 1, 2012"
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // "4/1/2012"
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // "2012-04-01"
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      if (format === formats[0]) {
        // Month name format
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ]
        const monthIndex = monthNames.indexOf(match[1].toLowerCase())
        if (monthIndex !== -1) {
          return {
            year: parseInt(match[3], 10),
            month: monthIndex,
            day: parseInt(match[2], 10)
          }
        }
      } else {
        // Numeric formats
        const parts = match.slice(1)
        if (format === formats[1]) {
          // MM/DD/YYYY
          return {
            year: parseInt(parts[2], 10),
            month: parseInt(parts[0], 10) - 1,
            day: parseInt(parts[1], 10)
          }
        } else {
          // YYYY-MM-DD
          return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10) - 1,
            day: parseInt(parts[2], 10)
          }
        }
      }
    }
  }
  
  // Try native Date parsing as fallback
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate()
    }
  }
  
  return null
}

