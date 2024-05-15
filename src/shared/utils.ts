/**
 * Utility functions for the collaborative editor
 */

import { v4 as uuidv4 } from 'uuid';
import { USER_COLORS, ANONYMOUS_NAMES } from './constants.js';
import type { UserPresence, CursorPosition } from './types.js';

/**
 * Generate a random color from the predefined palette
 */
export function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

/**
 * Generate a random anonymous name
 */
export function getRandomAnonymousName(): string {
  return ANONYMOUS_NAMES[Math.floor(Math.random() * ANONYMOUS_NAMES.length)];
}

/**
 * Create a new user presence object
 */
export function createUser(id?: string, name?: string): UserPresence {
  return {
    id: id ?? uuidv4(),
    name: name ?? getRandomAnonymousName(),
    color: getRandomColor(),
    lastActive: Date.now(),
  };
}

/**
 * Check if a cursor position is valid
 */
export function isValidCursorPosition(cursor: unknown): cursor is CursorPosition {
  if (typeof cursor !== 'object' || cursor === null) return false;
  const c = cursor as Record<string, unknown>;
  return typeof c.index === 'number' && c.index >= 0;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Format a timestamp to a human-readable string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' &&
    typeof (globalThis as typeof globalThis & { window?: unknown }).window !== 'undefined' &&
    typeof (globalThis as typeof globalThis & { document?: unknown }).document !== 'undefined';
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return isBrowser() && 'indexedDB' in (globalThis as typeof globalThis & { indexedDB?: unknown });
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a room ID from a name
 */
export function generateRoomId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${sanitized}-${suffix}`;
}
