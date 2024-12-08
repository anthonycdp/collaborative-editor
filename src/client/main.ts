/**
 * Main client entry point
 * Collaborative Real-Time Editor
 */

import Quill from 'quill';
import { CollaborationProvider } from './collaboration-provider.js';
import { OfflinePersistence } from './offline-persistence.js';
import { EditorBinding } from './editor-binding.js';
import type { ConnectionStatus, UserPresence } from '../shared/types.js';
import { formatBytes } from '../shared/utils.js';
import { STORAGE_KEYS } from '../shared/constants.js';

// DOM Elements
const roomBadge = document.getElementById('roomBadge')!;
const connectionStatus = document.getElementById('connectionStatus')!;
const userAvatar = document.getElementById('userAvatar')!;
const userName = document.getElementById('userName')!;
const userList = document.getElementById('userList')!;
const roomInput = document.getElementById('roomInput') as HTMLInputElement;
const joinRoomBtn = document.getElementById('joinRoomBtn')!;
const roomList = document.getElementById('roomList')!;
const docSize = document.getElementById('docSize')!;
const docChars = document.getElementById('docChars')!;
const docWords = document.getElementById('docWords')!;
const syncIndicator = document.getElementById('syncIndicator')!;
const syncText = document.getElementById('syncText')!;
const toastContainer = document.getElementById('toastContainer')!;
const editorEl = document.getElementById('editor')!;

// App State
let provider: CollaborationProvider | null = null;
let persistence: OfflinePersistence | null = null;
let binding: EditorBinding | null = null;
let quill: Quill | null = null;
let currentRoom = 'default';

// Configuration
const SERVER_URL = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_SERVER_URL?: string } }).env?.VITE_SERVER_URL)
  || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Get room from URL or use default
  const urlParams = new URLSearchParams(window.location.search);
  currentRoom = urlParams.get('room') || 'default';

  // Update UI
  roomBadge.textContent = `Room: ${currentRoom}`;
  roomInput.value = currentRoom;

  // Load user preferences
  const savedUser = loadUserPreferences();
  if (savedUser) {
    userAvatar.textContent = savedUser.name?.charAt(0).toUpperCase() || '?';
    userAvatar.style.backgroundColor = savedUser.color || '#888';
    userName.textContent = savedUser.name || 'Anonymous';
  }

  // Initialize Quill
  initQuill();

  // Connect to room
  await connectToRoom(currentRoom, savedUser ?? undefined);

  // Set up event listeners
  setupEventListeners();

  // Load recent rooms
  loadRecentRooms();
}

/**
 * Initialize Quill editor
 */
function initQuill(): void {
  quill = new Quill(editorEl, {
    theme: 'snow',
    placeholder: 'Start collaborating...',
    modules: {
      toolbar: '#toolbar',
      history: {
        userOnly: true,
      },
    },
  });
}

/**
 * Connect to a room
 */
async function connectToRoom(roomId: string, user?: Partial<UserPresence>): Promise<void> {
  // Clean up existing connection
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (persistence) {
    persistence.destroy();
    persistence = null;
  }
  if (binding) {
    binding.destroy();
    binding = null;
  }

  // Update URL
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  window.history.replaceState({}, '', url.toString());

  // Update UI
  currentRoom = roomId;
  roomBadge.textContent = `Room: ${roomId}`;

  // Create new provider
  provider = new CollaborationProvider({
    serverUrl: SERVER_URL,
    room: roomId,
    user: user,
    onConnectionChange: handleConnectionChange,
    onSyncChange: handleSyncChange,
    onAwarenessChange: handleAwarenessChange,
  });

  // Initialize offline persistence
  persistence = new OfflinePersistence(roomId, provider.doc);
  await persistence.initialize();

  // Create editor binding
  if (quill) {
    binding = new EditorBinding(
      provider.getText('content'),
      quill,
      provider.awareness
    );
  }

  // Update document stats periodically
  setInterval(updateDocumentStats, 5000);
}

/**
 * Handle connection status changes
 */
function handleConnectionChange(status: ConnectionStatus): void {
  const statusDot = connectionStatus.querySelector('.status-dot')!;
  const statusText = connectionStatus.querySelector('.status-text')!;

  statusDot.className = 'status-dot';

  switch (status) {
    case 'connected':
      statusDot.classList.add('status-connected');
      statusText.textContent = 'Connected';
      showToast('Connected to server', 'success');
      break;
    case 'connecting':
      statusDot.classList.add('status-connecting');
      statusText.textContent = 'Connecting...';
      break;
    case 'reconnecting':
      statusDot.classList.add('status-connecting');
      statusText.textContent = 'Reconnecting...';
      break;
    case 'disconnected':
      statusDot.classList.add('status-disconnected');
      statusText.textContent = 'Disconnected';
      showToast('Disconnected from server', 'warning');
      break;
  }

  // Update sync indicator
  syncIndicator.className = status === 'connected' ? 'sync-indicator' : 'sync-indicator offline';
  syncText.textContent = status === 'connected' ? 'Ready' : 'Offline';
}

/**
 * Handle sync status changes
 */
function handleSyncChange(synced: boolean): void {
  syncIndicator.className = synced ? 'sync-indicator' : 'sync-indicator syncing';
  syncText.textContent = synced ? 'Synced' : 'Syncing...';
}

/**
 * Handle awareness changes (presence updates)
 */
function handleAwarenessChange(states: Map<number, unknown>): void {
  const localClientID = provider?.awareness.doc?.clientID;
  const users: Array<{ name: string; color: string; clientID: number }> = [];

  states.forEach((state, clientID) => {
    const s = state as { user?: { name: string; color: string } };
    if (s.user) {
      users.push({
        name: s.user.name,
        color: s.user.color,
        clientID,
      });
    }
  });

  renderUserList(users, localClientID);

  // Update user info
  const localState = provider?.awareness.getLocalState() as { user?: UserPresence } | undefined;
  if (localState?.user) {
    userAvatar.textContent = localState.user.name.charAt(0).toUpperCase();
    userAvatar.style.backgroundColor = localState.user.color;
    userName.textContent = localState.user.name;
  }
}

/**
 * Render the user list
 */
function renderUserList(
  users: Array<{ name: string; color: string; clientID: number }>,
  localClientID?: number
): void {
  userList.innerHTML = users
    .map((user) => {
      const isLocal = user.clientID === localClientID;
      return `
        <li class="user-item">
          <div class="user-item-avatar" style="background-color: ${user.color}">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <span class="user-item-name">${user.name}</span>
          ${isLocal ? '<span class="user-item-status">You</span>' : ''}
        </li>
      `;
    })
    .join('');
}

/**
 * Update document statistics
 */
function updateDocumentStats(): void {
  if (!binding || !provider) return;

  const stats = binding.getStats();
  docChars.textContent = stats.characters.toString();
  docWords.textContent = stats.words.toString();

  // Estimate document size
  const update = provider.doc.store;
  const size = JSON.stringify(update).length;
  docSize.textContent = formatBytes(size);
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Join room
  joinRoomBtn.addEventListener('click', () => {
    const room = roomInput.value.trim();
    if (room) {
      joinRoom(room);
    }
  });

  roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const room = roomInput.value.trim();
      if (room) {
        joinRoom(room);
      }
    }
  });

  // Handle online/offline
  window.addEventListener('online', () => {
    showToast('Back online', 'success');
  });

  window.addEventListener('offline', () => {
    showToast('You are offline. Changes will be saved locally.', 'warning');
  });

  // Save preferences on unload
  window.addEventListener('beforeunload', () => {
    const localState = provider?.awareness.getLocalState() as { user?: UserPresence } | undefined;
    if (localState?.user) {
      saveUserPreferences(localState.user);
    }
    saveRecentRoom(currentRoom);
  });
}

/**
 * Join a room
 */
async function joinRoom(roomId: string): Promise<void> {
  await connectToRoom(roomId);
  saveRecentRoom(roomId);
  loadRecentRooms();
  showToast(`Joined room: ${roomId}`, 'success');
}

/**
 * Show a toast notification
 */
function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Load user preferences from localStorage
 */
function loadUserPreferences(): Partial<UserPresence> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Save user preferences to localStorage
 */
function saveUserPreferences(user: Partial<UserPresence>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Save a room to recent rooms
 */
function saveRecentRoom(roomId: string): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RECENT_ROOMS);
    const rooms: string[] = saved ? JSON.parse(saved) : [];

    // Remove if exists and add to front
    const index = rooms.indexOf(roomId);
    if (index > -1) {
      rooms.splice(index, 1);
    }
    rooms.unshift(roomId);

    // Keep only last 10
    const trimmed = rooms.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.RECENT_ROOMS, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load recent rooms
 */
function loadRecentRooms(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RECENT_ROOMS);
    const rooms: string[] = saved ? JSON.parse(saved) : [];

    roomList.innerHTML = rooms
      .map((room) => {
        const isActive = room === currentRoom;
        return `
          <li class="room-item ${isActive ? 'active' : ''}" data-room="${room}">
            ${room}
          </li>
        `;
      })
      .join('');

    // Add click handlers
    roomList.querySelectorAll('.room-item').forEach((el) => {
      el.addEventListener('click', () => {
        const roomId = (el as HTMLElement).dataset.room;
        if (roomId && roomId !== currentRoom) {
          joinRoom(roomId);
        }
      });
    });
  } catch {
    // Ignore storage errors
  }
}

// Initialize the app
init().catch(console.error);
