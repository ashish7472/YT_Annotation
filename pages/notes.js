// YouTube Notes Extension - Notes Manager

// DOM elements
let searchInput;
let exportButton;
let videoList;
let notesTitle;
let notesCount;
let notesList;

// State
let allNotes = [];
let filteredNotes = [];
let selectedVideoId = null;
let searchTerm = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  searchInput = document.getElementById('search-input');
  exportButton = document.getElementById('export-notes');
  videoList = document.getElementById('video-list');
  notesTitle = document.getElementById('notes-title');
  notesCount = document.getElementById('notes-count');
  notesList = document.getElementById('notes-list');
  
  // Add event listeners
  searchInput.addEventListener('input', handleSearch);
  exportButton.addEventListener('click', handleExportNotes);
  
  // Load all notes
  loadNotes();
});

// Load all notes from storage
function loadNotes() {
  chrome.storage.local.get(['notes'], (result) => {
    allNotes = result.notes || [];
    
    // Initialize filtered notes with all notes
    filteredNotes = [...allNotes];
    
    // Render the videos and notes
    renderVideos();
    renderNotes();
  });
}

// Handle search input
function handleSearch() {
  searchTerm = searchInput.value.toLowerCase().trim();
  
  // Clear selected video if searching
  if (searchTerm) {
    selectedVideoId = null;
  }
  
  // Filter notes based on search term
  if (searchTerm) {
    filteredNotes = allNotes.filter(note => 
      note.content.toLowerCase().includes(searchTerm)
    );
    notesTitle.textContent = `Search Results: "${searchTerm}"`;
  } else {
    // If no search term, show notes for selected video or all notes
    if (selectedVideoId) {
      filteredNotes = allNotes.filter(note => note.videoId === selectedVideoId);
    } else {
      filteredNotes = [...allNotes];
      notesTitle.textContent = 'All Notes';
    }
  }
  
  // Render updated notes
  renderNotes();
  
  // Update active video in list
  updateActiveVideo();
}

// Render the list of videos
function renderVideos() {
  if (allNotes.length === 0) {
    videoList.innerHTML = `
      <div class="empty-state">No videos with notes</div>
    `;
    return;
  }
  
  // Group notes by video
  const videoMap = new Map();
  
  allNotes.forEach(note => {
    if (!videoMap.has(note.videoId)) {
      videoMap.set(note.videoId, {
        videoId: note.videoId,
        notes: [],
        latestNote: null
      });
    }
    
    const videoData = videoMap.get(note.videoId);
    videoData.notes.push(note);
    
    // Track the latest note to get the most recent title
    if (!videoData.latestNote || new Date(note.createdAt) > new Date(videoData.latestNote.createdAt)) {
      videoData.latestNote = note;
    }
  });
  
  // Sort videos by most recent note
  const sortedVideos = Array.from(videoMap.values())
    .sort((a, b) => new Date(b.latestNote.createdAt) - new Date(a.latestNote.createdAt));
  
  // Clear the list
  videoList.innerHTML = '';
  
  // Add each video to the list
  sortedVideos.forEach(video => {
    const videoElement = document.createElement('div');
    videoElement.className = 'video-item';
    videoElement.dataset.videoId = video.videoId;
    
    // Get video title from the latest note (might have been updated)
    // This assumes you've stored video titles with notes
    // Fallback to video ID if no title
    let videoTitle = video.videoId;
    if (video.latestNote && video.latestNote.videoTitle) {
      videoTitle = video.latestNote.videoTitle;
    }
    
    videoElement.innerHTML = `
      <div class="video-title">${truncateText(videoTitle, 40)}</div>
      <div class="video-meta">
        <span>${video.notes.length} notes</span>
        <span>${formatDate(video.latestNote.createdAt)}</span>
      </div>
    `;
    
    // Add click handler to select this video
    videoElement.addEventListener('click', () => {
      selectedVideoId = video.videoId;
      searchInput.value = ''; // Clear search when selecting a video
      searchTerm = '';
      
      // Update filtered notes to show only this video's notes
      filteredNotes = allNotes.filter(note => note.videoId === selectedVideoId);
      
      // Update title
      notesTitle.textContent = `Notes for: ${truncateText(videoTitle, 30)}`;
      
      // Render notes for this video
      renderNotes();
      
      // Update active video styling
      updateActiveVideo();
    });
    
    videoList.appendChild(videoElement);
  });
  
  // Set initial active video if we have one selected
  updateActiveVideo();
}

// Update the active video styling
function updateActiveVideo() {
  // Remove active class from all videos
  const videoItems = document.querySelectorAll('.video-item');
  videoItems.forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to selected video
  if (selectedVideoId && !searchTerm) {
    const activeVideo = document.querySelector(`.video-item[data-video-id="${selectedVideoId}"]`);
    if (activeVideo) {
      activeVideo.classList.add('active');
    }
  }
}

// Render notes based on current filters
function renderNotes() {
  // Update notes count
  notesCount.textContent = `${filteredNotes.length} notes`;
  
  if (filteredNotes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">No notes found</div>
    `;
    return;
  }
  
  // Sort notes by timestamp
  filteredNotes.sort((a, b) => a.timestamp - b.timestamp);
  
  // Clear the list
  notesList.innerHTML = '';
  
  // Create a note card for each note
  filteredNotes.forEach(note => {
    const noteCard = document.createElement('div');
    noteCard.className = 'note-card';
    
    // Get video title if available, otherwise use video ID
    let videoTitle = note.videoId;
    if (note.videoTitle) {
      videoTitle = note.videoTitle;
    }
    
    noteCard.innerHTML = `
      <div class="note-header">
        <div class="note-timestamp">${note.formattedTime}</div>
        <div class="note-video-title">${videoTitle}</div>
      </div>
      <div class="note-content">${note.content}</div>
      <div class="note-actions">
        <button class="btn btn-secondary btn-icon view-video-btn" title="Open video at this timestamp">▶</button>
        <button class="btn btn-secondary btn-icon edit-note-btn" title="Edit note">✎</button>
        <button class="btn btn-secondary btn-icon delete-note-btn" title="Delete note">🗑</button>
      </div>
    `;
    
    // Add event listeners for buttons
    noteCard.querySelector('.view-video-btn').addEventListener('click', () => {
      openVideoAtTimestamp(note.videoId, note.timestamp);
    });
    
    noteCard.querySelector('.edit-note-btn').addEventListener('click', () => {
      editNote(note);
    });
    
    noteCard.querySelector('.delete-note-btn').addEventListener('click', () => {
      deleteNote(note.id);
    });
    
    notesList.appendChild(noteCard);
  });
}

// Open a video at a specific timestamp
function openVideoAtTimestamp(videoId, timestamp) {
  chrome.tabs.create({
    url: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`
  });
}

// Edit a note
function editNote(note) {
  // Create edit modal
  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  
  modal.innerHTML = `
    <div class="edit-modal-content">
      <div class="edit-modal-header">
        <h3>Edit Note at ${note.formattedTime}</h3>
        <button class="close-modal-btn">✕</button>
      </div>
      <textarea class="edit-textarea">${note.content}</textarea>
      <div class="edit-modal-footer">
        <button class="btn btn-secondary cancel-btn">Cancel</button>
        <button class="btn btn-accent save-btn">Save Changes</button>
      </div>
    </div>
  `;
  
  // Add the modal to the page
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = modal.querySelector('.close-modal-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const saveBtn = modal.querySelector('.save-btn');
  const textarea = modal.querySelector('.edit-textarea');
  
  // Close modal function
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  // Add event listeners
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  saveBtn.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    
    if (newContent) {
      // Update the note
      updateNote(note.id, newContent, () => {
        // Close the modal
        closeModal();
        
        // Reload notes to reflect changes
        loadNotes();
      });
    }
  });
  
  // Focus the textarea
  textarea.focus();
  
  // Add some basic styling for the modal
  const style = document.createElement('style');
  style.textContent = `
    .edit-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    
    .edit-modal-content {
      background: linear-gradient(135deg, #121212 0%, #4a0072 100%);
      border-radius: 8px;
      width: 500px;
      max-width: 90%;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    }
    
    .edit-modal-header {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .edit-modal-header h3 {
      margin: 0;
      color: #e91e63;
    }
    
    .close-modal-btn {
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }
    
    .edit-textarea {
      width: 100%;
      min-height: 150px;
      padding: 16px;
      background-color: rgba(0, 0, 0, 0.2);
      border: none;
      color: white;
      font-family: inherit;
      resize: vertical;
    }
    
    .edit-modal-footer {
      padding: 16px;
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
  
  document.head.appendChild(style);
}

// Update a note
function updateNote(noteId, content, callback) {
  chrome.runtime.sendMessage({
    action: 'updateNote',
    noteId: noteId,
    content: content
  }, (response) => {
    if (response && response.success) {
      if (callback) callback();
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
        // Reload notes to reflect changes
        loadNotes();
      }
    });
  }
}

// Handle exporting notes
function handleExportNotes() {
  // Get notes to export (either filtered or all)
  const notesToExport = searchTerm || selectedVideoId ? filteredNotes : allNotes;
  
  if (notesToExport.length === 0) {
    alert('No notes to export.');
    return;
  }
  
  // Format notes for export
  const exportData = JSON.stringify(notesToExport, null, 2);
  
  // Create a blob and download link
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create download element
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  
  // Set filename based on what's being exported
  let filename = 'youtube-notes-';
  if (selectedVideoId && !searchTerm) {
    filename += `video-${selectedVideoId}-`;
  } else if (searchTerm) {
    filename += `search-results-`;
  }
  filename += `${new Date().toISOString().slice(0, 10)}.json`;
  
  downloadLink.download = filename;
  
  // Trigger download
  document.body.appendChild(downloadLink);
  downloadLink.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }, 100);
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}