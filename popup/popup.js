// YouTube Notes Extension - Popup Script

// DOM elements
let currentVideoElement;
let totalNotesElement;
let videoCountElement;
let recentNotesListElement;
let viewAllNotesButton;
let exportNotesButton;

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  currentVideoElement = document.getElementById('current-video');
  totalNotesElement = document.getElementById('total-notes');
  videoCountElement = document.getElementById('video-count');
  recentNotesListElement = document.getElementById('recent-notes-list');
  viewAllNotesButton = document.getElementById('view-all-notes');
  exportNotesButton = document.getElementById('export-notes');
  
  // Add event listeners
  viewAllNotesButton.addEventListener('click', handleViewAllNotes);
  exportNotesButton.addEventListener('click', handleExportNotes);
  
  // Get current tab info
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  // Check if we're on a YouTube video page
  if (currentTab.url && currentTab.url.includes('youtube.com/watch')) {
    const videoId = new URL(currentTab.url).searchParams.get('v');
    
    if (videoId) {
      // We're on a YouTube video page, get video details
      updateCurrentVideoInfo(currentTab, videoId);
    }
  } else {
    // Not on a YouTube video page
    currentVideoElement.innerHTML = `
      <div class="status-message">
        Not a YouTube video page.
        <br>
        Open a YouTube video to add notes.
      </div>
    `;
  }
  
  // Load notes statistics and recent notes
  loadNotesData();
});

// Update current video info
function updateCurrentVideoInfo(tab, videoId) {
  // Get the video title from the tab title (removes " - YouTube" suffix)
  const videoTitle = tab.title.replace(' - YouTube', '');
  
  // Check if there are notes for this video
  chrome.runtime.sendMessage({
    action: 'getNotes',
    videoId: videoId
  }, (response) => {
    const noteCount = response && response.notes ? response.notes.length : 0;
    
    currentVideoElement.innerHTML = `
      <div class="current-video-info">
        <h3 class="video-title">${videoTitle}</h3>
        <div class="video-stats">
          <span class="video-note-count">${noteCount} notes for this video</span>
        </div>
        <button id="add-note-button" class="btn btn-accent">Add Note Now</button>
      </div>
    `;
    
    // Add event listener to the add note button
    document.getElementById('add-note-button').addEventListener('click', () => {
      // Send message to content script to trigger add note
      chrome.tabs.sendMessage(tab.id, { action: 'triggerAddNote' });
      // Close the popup
      window.close();
    });
  });
}

// Load notes statistics and recent notes
function loadNotesData() {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    
    // Update stats
    const totalNotes = notes.length;
    
    // Count unique video IDs
    const uniqueVideos = new Set();
    notes.forEach(note => uniqueVideos.add(note.videoId));
    const videoCount = uniqueVideos.size;
    
    // Update UI
    totalNotesElement.textContent = totalNotes;
    videoCountElement.textContent = videoCount;
    
    // Show recent notes (last 5)
    if (notes.length > 0) {
      const recentNotes = [...notes]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      
      displayRecentNotes(recentNotes);
    } else {
      recentNotesListElement.innerHTML = `
        <div class="empty-state">No notes yet</div>
      `;
    }
  });
}

// Display recent notes
function displayRecentNotes(notes) {
  recentNotesListElement.innerHTML = '';
  
  notes.forEach(note => {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    
    // Truncate content if too long
    const truncatedContent = note.content.length > 60 
      ? note.content.substring(0, 60) + '...' 
      : note.content;
    
    noteElement.innerHTML = `
      <div class="note-timestamp">${note.formattedTime}</div>
      <div class="note-content">${truncatedContent}</div>
    `;
    
    // Add click handler to open the video at this timestamp
    noteElement.addEventListener('click', () => {
      chrome.tabs.create({
        url: `https://www.youtube.com/watch?v=${note.videoId}&t=${Math.floor(note.timestamp)}s`
      });
    });
    
    recentNotesListElement.appendChild(noteElement);
  });
}

// Handle "View All Notes" button click
function handleViewAllNotes() {
  // Create a new tab with the notes manager page
  chrome.tabs.create({
    url: chrome.runtime.getURL('pages/notes.html')
  });
}

// Handle "Export Notes" button click
function handleExportNotes() {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    
    if (notes.length === 0) {
      alert('No notes to export.');
      return;
    }
    
    // Format notes for export
    const exportData = JSON.stringify(notes, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download element
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `youtube-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 100);
  });
}