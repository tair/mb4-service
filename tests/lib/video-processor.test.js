import { VideoProcessor } from '../../src/lib/video-processor.js'

describe('VideoProcessor', () => {
  let processor

  beforeEach(() => {
    processor = new VideoProcessor()
  })

  describe('parseFrameRate', () => {
    test('should parse fraction format correctly', () => {
      expect(processor.parseFrameRate('30/1')).toBe(30)
      expect(processor.parseFrameRate('25/1')).toBe(25)
      expect(processor.parseFrameRate('23976/1000')).toBeCloseTo(23.976, 3)
    })

    test('should handle decimal format', () => {
      expect(processor.parseFrameRate('30')).toBe(30)
      expect(processor.parseFrameRate('25.5')).toBe(25.5)
    })

    test('should return default for invalid input', () => {
      expect(processor.parseFrameRate(null)).toBe(30)
      expect(processor.parseFrameRate(undefined)).toBe(30)
      expect(processor.parseFrameRate('')).toBe(30)
      expect(processor.parseFrameRate('invalid')).toBe(30)
    })

    test('should not execute malicious code (security test)', () => {
      // This would be dangerous with eval(), but should be safe now
      const maliciousInput = '1/1; console.log("hacked"); 30'
      expect(processor.parseFrameRate(maliciousInput)).toBe(30)
      
      // Another attempt to inject code
      const maliciousInput2 = '30/1); process.exit(); (1'
      expect(processor.parseFrameRate(maliciousInput2)).toBe(30)
    })

    test('should handle division by zero gracefully', () => {
      expect(processor.parseFrameRate('30/0')).toBe(30)
      expect(processor.parseFrameRate('0/0')).toBe(30)
    })
  })
})