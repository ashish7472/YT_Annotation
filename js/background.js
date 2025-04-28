// YouTube Notes Extension - Background Script
// Handles data storage and management

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.get(['notes'], (result) => {
    if (!result.notes) {
      chrome.storage.local.set({ notes: [] });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'saveNote':
      handleSaveNote(request.note, sendResponse);
      break;
    case 'getNotes':
      handleGetNotes(request.videoId, sendResponse);
      break;
    case 'updateNote':
      handleUpdateNote(request.noteId, request.content, sendResponse);
      break;
    case 'deleteNote':
      handleDeleteNote(request.noteId, sendResponse);
      break;
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Save a new note
function handleSaveNote(note, sendResponse) {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    notes.push(note);
    
    chrome.storage.local.set({ notes }, () => {
      // Notify content script that notes were updated
      notifyNotesUpdated(note.videoId);
      
      sendResponse({ success: true });
    });
  });
}

// Get notes for a specific video
function handleGetNotes(videoId, sendResponse) {
  chrome.storage.local.get(['notes'], (result) => {
    const allNotes = result.notes || [];
    const videoNotes = allNotes.filter(note => note.videoId === videoId);
    
    sendResponse({ notes: videoNotes });
  });
}

// Update an existing note
function handleUpdateNote(noteId, content, sendResponse) {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      const videoId = notes[noteIndex].videoId;
      notes[noteIndex].content = content;
      notes[noteIndex].updatedAt = new Date().toISOString();
      
      chrome.storage.local.set({ notes }, () => {
        // Notify content script that notes were updated
        notifyNotesUpdated(videoId);
        
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Note not found' });
    }
  });
}

// Delete a note
function handleDeleteNote(noteId, sendResponse) {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
      const videoId = notes[noteIndex].videoId;
      notes.splice(noteIndex, 1);
      
      chrome.storage.local.set({ notes }, () => {
        // Notify content script that notes were updated
        notifyNotesUpdated(videoId);
        
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Note not found' });
    }
  });
}

// Notify all tabs with this video open that notes were updated
function notifyNotesUpdated(videoId) {
  chrome.tabs.query({ url: '*://*.youtube.com/watch*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'notesUpdated',
        videoId: videoId
      });
    });
  });
}