/**
 * Tests for shared utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  getRandomColor,
  getRandomAnonymousName,
  createUser,
  isValidCursorPosition,
  formatBytes,
  formatTimestamp,
  generateRoomId,
  debounce,
  throttle,
  deepClone,
  isBrowser,
  sleep,
} from '../src/shared/utils.js';
import { USER_COLORS, ANONYMOUS_NAMES } from '../src/shared/constants.js';

describe('Utility Functions', () => {
  describe('getRandomColor', () => {
    it('should return a color from the predefined palette', () => {
      const color = getRandomColor();
      expect(USER_COLORS).toContain(color);
    });

    it('should return different colors on multiple calls', () => {
      const colors = new Set<string>();
      for (let i = 0; i < 20; i++) {
        colors.add(getRandomColor());
      }
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('getRandomAnonymousName', () => {
    it('should return a name from the predefined list', () => {
      const name = getRandomAnonymousName();
      expect(ANONYMOUS_NAMES).toContain(name);
    });
  });

  describe('createUser', () => {
    it('should create a user with default values', () => {
      const user = createUser();

      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.color).toBeDefined();
      expect(user.lastActive).toBeLessThanOrEqual(Date.now());
    });

    it('should create a user with custom values', () => {
      const user = createUser('custom-id', 'Custom Name');

      expect(user.id).toBe('custom-id');
      expect(user.name).toBe('Custom Name');
    });

    it('should generate unique IDs', () => {
      const user1 = createUser();
      const user2 = createUser();

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('isValidCursorPosition', () => {
    it('should return true for valid cursor position', () => {
      expect(isValidCursorPosition({ index: 0 })).toBe(true);
      expect(isValidCursorPosition({ index: 10 })).toBe(true);
    });

    it('should return false for invalid cursor positions', () => {
      expect(isValidCursorPosition(null)).toBe(false);
      expect(isValidCursorPosition(undefined)).toBe(false);
      expect(isValidCursorPosition({})).toBe(false);
      expect(isValidCursorPosition({ index: -1 })).toBe(false);
      expect(isValidCursorPosition({ index: 'abc' })).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to time string', () => {
      const now = Date.now();
      const formatted = formatTimestamp(now);

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('generateRoomId', () => {
    it('should generate room ID from name', () => {
      const roomId = generateRoomId('My Room');

      expect(roomId).toMatch(/^my-room-[a-z0-9]+$/);
    });

    it('should sanitize special characters', () => {
      const roomId = generateRoomId('Test@Room#123!');

      expect(roomId).toMatch(/^test-room-123-[a-z0-9]+$/);
      expect(roomId).not.toContain('@');
      expect(roomId).not.toContain('#');
      expect(roomId).not.toContain('!');
    });

    it('should generate unique IDs', () => {
      const id1 = generateRoomId('room');
      const id2 = generateRoomId('room');

      expect(id1).not.toBe(id2);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      let callCount = 0;
      const fn = debounce(() => {
        callCount++;
      }, 50);

      fn();
      fn();
      fn();

      expect(callCount).toBe(0);

      await sleep(100);

      expect(callCount).toBe(1);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      let callCount = 0;
      const fn = throttle(() => {
        callCount++;
      }, 50);

      fn();
      fn();
      fn();

      expect(callCount).toBe(1);

      await sleep(100);

      fn();

      expect(callCount).toBe(2);
    });
  });

  describe('deepClone', () => {
    it('should deep clone an object', () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4, 5] },
      };

      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });
  });

  describe('isBrowser', () => {
    it('should return false in Node.js environment', () => {
      expect(isBrowser()).toBe(false);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });
});
