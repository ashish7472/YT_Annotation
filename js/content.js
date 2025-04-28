// YouTube Notes Extension - Content Script
// This script injects the note-taking interface into YouTube

let videoPlayer = null;
let videoId = null;
let noteContainer = null;
let isNotesVisible = false;
let allNotes = [];

// Initialize the extension once the page is fully loaded
window.addEventListener('load', () => {
  // Try to get the video player and ID
  initializeExtension();
  
  // Setup mutation observer to handle YouTube's dynamic navigation
  setupNavigationObserver();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerAddNote') {
    handleAddNote();
  }
  if (message.action === 'notesUpdated' && message.videoId === videoId) {
    loadNotes();
  }
  sendResponse({ received: true });
  return true;
});

// Initialize extension components
function initializeExtension() {
  // Get the video ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  videoId = urlParams.get('v');
  
  if (!videoId) return;
  
  // Get the video player element
  videoPlayer = document.querySelector('video');
  
  if (!videoPlayer) {
    // Retry after a short delay if player not found
    setTimeout(initializeExtension, 1000);
    return;
  }
  
  // Try to inject our UI
  injectNoteUI();
  
  // Load notes for this video
  loadNotes();
}

// Setup mutation observer to detect YouTube's SPA navigation
function setupNavigationObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const currentVideoId = new URLSearchParams(window.location.search).get('v');
        
        // If we're on a new video
        if (currentVideoId && currentVideoId !== videoId) {
          videoId = currentVideoId;
          
          // Clear UI if it exists
          if (noteContainer) {
            noteContainer.remove();
            noteContainer = null;
          }
          
          // Reinitialize
          setTimeout(initializeExtension, 1000);
        }
      }
    }
  });
  
  // Watch for URL/page changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Inject our notes UI into the YouTube player
function injectNoteUI() {
  // Find the YouTube right controls where we'll inject our buttons
  const rightControls = document.querySelector('.ytp-right-controls');
  
  if (!rightControls) {
    // Retry after a short delay if controls not found
    setTimeout(injectNoteUI, 1000);
    return;
  }
  
  // Check if our UI already exists
  if (document.querySelector('.yt-notes-container')) {
    return;
  }
  
  // Create the container for our buttons
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'yt-notes-buttons';
  
  // Create "Add Note" button
  const addNoteButton = document.createElement('button');
  addNoteButton.className = 'yt-notes-add-button';
  addNoteButton.innerHTML = '<span>+</span>';
  addNoteButton.title = 'Add a note at this timestamp';
  
  // Create "View Notes" button
  const viewNotesButton = document.createElement('button');
  viewNotesButton.className = 'yt-notes-view-button';
  viewNotesButton.innerHTML = '<span>Notes</span>';
  viewNotesButton.title = 'View all notes for this video';
  
  // Add event listeners
  addNoteButton.addEventListener('click', handleAddNote);
  viewNotesButton.addEventListener('click', toggleNotesPanel);
  
  // Add buttons to container
  buttonsContainer.appendChild(addNoteButton);
  buttonsContainer.appendChild(viewNotesButton);
  
  // Insert before the first child of right controls
  rightControls.insertBefore(buttonsContainer, rightControls.firstChild);
  
  // Create notes container
  noteContainer = document.createElement('div');
  noteContainer.className = 'yt-notes-container';
  noteContainer.style.display = 'none';
  
  // Create notes header
  const notesHeader = document.createElement('div');
  notesHeader.className = 'yt-notes-header';
  
  const notesTitle = document.createElement('h3');
  notesTitle.textContent = 'Video Notes';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'yt-notes-close-button';
  closeButton.innerHTML = '✕';
  closeButton.addEventListener('click', toggleNotesPanel);
  
  notesHeader.appendChild(notesTitle);
  notesHeader.appendChild(closeButton);
  
  // Create notes content
  const notesContent = document.createElement('div');
  notesContent.className = 'yt-notes-content';
  
  // Create empty state
  const emptyState = document.createElement('div');
  emptyState.className = 'yt-notes-empty-state';
  emptyState.textContent = 'No notes for this video yet. Click the + button to add one!';
  
  notesContent.appendChild(emptyState);
  
  // Add components to notes container
  noteContainer.appendChild(notesHeader);
  noteContainer.appendChild(notesContent);
  
  // Add notes container to page
  const ytpContainer = document.querySelector('.html5-video-container');
  if (ytpContainer && ytpContainer.parentNode) {
    ytpContainer.parentNode.appendChild(noteContainer);
  }
}

// Handle adding a new note
function handleAddNote() {
  if (!videoPlayer || !videoId) return;
  
  // Pause the video
  videoPlayer.pause();
  
  // Get current timestamp
  const currentTime = videoPlayer.currentTime;
  const formattedTime = formatTimestamp(currentTime);
  
  // Create note input UI
  const noteInput = document.createElement('div');
  noteInput.className = 'yt-notes-input';
  
  const noteHeader = document.createElement('div');
  noteHeader.className = 'yt-notes-input-header';
  
  const timestampDisplay = document.createElement('span');
  timestampDisplay.className = 'yt-notes-timestamp';
  timestampDisplay.textContent = `Note at ${formattedTime}`;
  
  const closeInputButton = document.createElement('button');
  closeInputButton.className = 'yt-notes-close-button';
  closeInputButton.innerHTML = '✕';
  closeInputButton.addEventListener('click', () => {
    noteInput.remove();
    videoPlayer.play();
  });
  
  noteHeader.appendChild(timestampDisplay);
  noteHeader.appendChild(closeInputButton);
  
  const textarea = document.createElement('textarea');
  textarea.className = 'yt-notes-textarea';
  textarea.placeholder = 'Enter your note here...';
  
  // Prevent YouTube shortcuts while typing
  textarea.addEventListener('keydown', (e) => {
    e.stopPropagation();
    
    // Submit on Ctrl+Enter
    if (e.key === 'Enter' && e.ctrlKey) {
      saveNote(currentTime, textarea.value);
      noteInput.remove();
      videoPlayer.play();
    }
  });
  
  // Also prevent keyup events from bubbling
  textarea.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });
  
  const buttonRow = document.createElement('div');
  buttonRow.className = 'yt-notes-button-row';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'yt-notes-button yt-notes-cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => {
    noteInput.remove();
    videoPlayer.play();
  });
  
  const saveButton = document.createElement('button');
  saveButton.className = 'yt-notes-button yt-notes-save-button';
  saveButton.textContent = 'Save Note';
  saveButton.addEventListener('click', () => {
    saveNote(currentTime, textarea.value);
    noteInput.remove();
    videoPlayer.play();
  });
  
  buttonRow.appendChild(cancelButton);
  buttonRow.appendChild(saveButton);
  
  noteInput.appendChild(noteHeader);
  noteInput.appendChild(textarea);
  noteInput.appendChild(buttonRow);
  
  // Add to page
  const ytpContainer = document.querySelector('.html5-video-container');
  if (ytpContainer && ytpContainer.parentNode) {
    ytpContainer.parentNode.appendChild(noteInput);
    textarea.focus();
  }
}

// Save a new note
function saveNote(timestamp, content) {
  if (!content.trim() || !videoId) return;
  
  const newNote = {
    id: Date.now(),
    videoId,
    timestamp,
    formattedTime: formatTimestamp(timestamp),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    videoTitle: document.title.replace(' - YouTube', '') // Add video title
  };
  
  // Send to background for storage
  chrome.runtime.sendMessage({
    action: 'saveNote',
    note: newNote
  }, (response) => {
    if (response && response.success) {
      // Refresh notes list
      loadNotes();
      
      // Show notes panel if not already visible
      if (!isNotesVisible) {
        toggleNotesPanel();
      }
    }
  });
}

// Toggle the notes panel visibility
function toggleNotesPanel() {
  if (!noteContainer) return;
  
  isNotesVisible = !isNotesVisible;
  noteContainer.style.display = isNotesVisible ? 'block' : 'none';
  
  // Refresh notes list when opening
  if (isNotesVisible) {
    loadNotes();
  }
}

// Load notes for the current video
function loadNotes() {
  if (!videoId) return;
  
  chrome.runtime.sendMessage({
    action: 'getNotes',
    videoId: videoId
  }, (response) => {
    if (response && response.notes) {
      allNotes = response.notes;
      renderNotes();
    }
  });
}

// Render notes in the panel
function renderNotes() {
  if (!noteContainer) return;
  
  const notesContent = noteContainer.querySelector('.yt-notes-content');
  if (!notesContent) return;
  
  // Clear existing content
  notesContent.innerHTML = '';
  
  if (allNotes.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'yt-notes-empty-state';
    emptyState.textContent = 'No notes for this video yet. Click the + button to add one!';
    notesContent.appendChild(emptyState);
    return;
  }
  
  // Sort notes by timestamp
  allNotes.sort((a, b) => a.timestamp - b.timestamp);
  
  // Create a note item for each note
  allNotes.forEach(note => {
    const noteItem = document.createElement('div');
    noteItem.className = 'yt-notes-item';
    noteItem.dataset.timestamp = note.timestamp;
    
    const noteTimestamp = document.createElement('div');
    noteTimestamp.className = 'yt-notes-item-timestamp';
    noteTimestamp.textContent = note.formattedTime;
    
    const noteContent = document.createElement('div');
    noteContent.className = 'yt-notes-item-content';
    noteContent.textContent = note.content;
    
    const noteActions = document.createElement('div');
    noteActions.className = 'yt-notes-item-actions';
    
    const jumpButton = document.createElement('button');
    jumpButton.className = 'yt-notes-jump-button';
    jumpButton.innerHTML = '⏱';
    jumpButton.title = 'Jump to this timestamp';
    jumpButton.addEventListener('click', () => {
      jumpToTimestamp(note.timestamp);
    });
    
    const editButton = document.createElement('button');
    editButton.className = 'yt-notes-edit-button';
    editButton.innerHTML = '✎';
    editButton.title = 'Edit this note';
    editButton.addEventListener('click', () => {
      editNote(note);
    });
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'yt-notes-delete-button';
    deleteButton.innerHTML = '🗑';
    deleteButton.title = 'Delete this note';
    deleteButton.addEventListener('click', () => {
      deleteNote(note.id);
    });
    
    noteActions.appendChild(jumpButton);
    noteActions.appendChild(editButton);
    noteActions.appendChild(deleteButton);
    
    noteItem.appendChild(noteTimestamp);
    noteItem.appendChild(noteContent);
    noteItem.appendChild(noteActions);
    
    notesContent.appendChild(noteItem);
  });
}

// Jump to a timestamp in the video
function jumpToTimestamp(timestamp) {
  if (!videoPlayer) return;
  
  videoPlayer.currentTime = timestamp;
  videoPlayer.play();
}

// Edit an existing note
function editNote(note) {
  if (!videoPlayer || !videoId) return;
  
  // Pause the video
  videoPlayer.pause();
  
  // Create note input UI (similar to add note but prefilled)
  const noteInput = document.createElement('div');
  noteInput.className = 'yt-notes-input';
  
  const noteHeader = document.createElement('div');
  noteHeader.className = 'yt-notes-input-header';
  
  const timestampDisplay = document.createElement('span');
  timestampDisplay.className = 'yt-notes-timestamp';
  timestampDisplay.textContent = `Edit note at ${note.formattedTime}`;
  
  const closeInputButton = document.createElement('button');
  closeInputButton.className = 'yt-notes-close-button';
  closeInputButton.innerHTML = '✕';
  closeInputButton.addEventListener('click', () => {
    noteInput.remove();
  });
  
  noteHeader.appendChild(timestampDisplay);
  noteHeader.appendChild(closeInputButton);
  
  const textarea = document.createElement('textarea');
  textarea.className = 'yt-notes-textarea';
  textarea.value = note.content;
  
  // Prevent YouTube shortcuts while editing
  textarea.addEventListener('keydown', (e) => {
    e.stopPropagation();
    
    // Submit on Ctrl+Enter
    if (e.key === 'Enter' && e.ctrlKey) {
      updateNote(note.id, textarea.value);
      noteInput.remove();
    }
  });
  
  // Also prevent keyup events from bubbling
  textarea.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });
  
  const buttonRow = document.createElement('div');
  buttonRow.className = 'yt-notes-button-row';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'yt-notes-button yt-notes-cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => {
    noteInput.remove();
  });
  
  const saveButton = document.createElement('button');
  saveButton.className = 'yt-notes-button yt-notes-save-button';
  saveButton.textContent = 'Update Note';
  saveButton.addEventListener('click', () => {
    updateNote(note.id, textarea.value);
    noteInput.remove();
  });
  
  buttonRow.appendChild(cancelButton);
  buttonRow.appendChild(saveButton);
  
  noteInput.appendChild(noteHeader);
  noteInput.appendChild(textarea);
  noteInput.appendChild(buttonRow);
  
  // Add to page
  const ytpContainer = document.querySelector('.html5-video-container');
  if (ytpContainer && ytpContainer.parentNode) {
    ytpContainer.parentNode.appendChild(noteInput);
    textarea.focus();
  }
}

// Update an existing note
function updateNote(noteId, content) {
  if (!content.trim() || !videoId) return;
  
  chrome.runtime.sendMessage({
    action: 'updateNote',
    noteId: noteId,
    content: content.trim()
  }, (response) => {
    if (response && response.success) {
      // Refresh notes list
      loadNotes();
    }
  });
}

// Delete a note
function deleteNote(noteId) {
  if (confirm('Are you sure you want to delete this note?')) {
    chrome.runtime.sendMessage({
      action: 'deleteNote',
      noteId: noteId
    }, (response) => {
      if (response && response.success) {
        // Refresh notes list
        loadNotes();
      }
    });
  }
}

// Format seconds to mm:ss or hh:mm:ss
function formatTimestamp(seconds) {
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds();
  
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }
  
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}