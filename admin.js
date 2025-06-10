// Global variables
let currentImages = [];
let refreshInterval = null;
let isRefreshing = false;
let isInitialized = false;

// Notification system
function notify(message, type = "success") {
  const el = document.getElementById("notification");
  el.textContent = message;
  el.className = "notification";
  if (type === "error") el.classList.add("error");
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 4000);
}

// Update stats display
function updateStats() {
  const statsEl = document.getElementById("stats");
  statsEl.textContent = `📊 Total Images: ${currentImages.length}`;
}

// Update connection status
function updateStatus(online) {
  const statusEl = document.getElementById("statusIndicator");
  if (online) {
    statusEl.textContent = "🟢 Server Online";
    statusEl.className = "status-indicator status-online";
  } else {
    statusEl.textContent = "🔴 Server Offline";
    statusEl.className = "status-indicator status-offline";
  }
}

// Cloudinary upload widget configuration
function initializeCloudinaryWidget() {
  return cloudinary.createUploadWidget({
    cloudName: 'dfv9u6nih',
    uploadPreset: 'Gallery',
    folder: 'gallery',
    maxFileSize: 10000000,
    clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    theme: 'purple',
    showAdvancedOptions: true,
    cropping: true,
    multiple: true,
    defaultSource: 'local'
  }, (err, result) => {
    if (!err && result && result.event === "success") {
      notify(`✅ Upload successful: ${result.info.original_filename}`);
      // Refresh the gallery after successful upload
      setTimeout(() => {
        fetchAndRenderGallery();
      }, 1500);
    } else if (err) {
      console.error("Upload Error:", err);
      notify("❌ Upload failed: " + err.message, "error");
    }
  });
}

// Delete image function
async function deleteImage(public_id, filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

  const deleteBtn = event.target;
  const originalText = deleteBtn.textContent;
  deleteBtn.textContent = "Deleting...";
  deleteBtn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("https://tenkasidic-backend.onrender.com/delete-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
    if (result.success) {
      notify(`🗑️ Image "${filename}" deleted successfully!`);
      fetchAndRenderGallery(); // Refresh gallery
    } else {
      notify("❌ Delete failed: " + result.message, "error");
      deleteBtn.textContent = originalText;
      deleteBtn.disabled = false;
    }
  } catch (err) {
    console.error("Delete Error:", err);
    let errorMessage = "Network error";
    if (err.name === 'AbortError') {
      errorMessage = "Request timed out";
    } else if (err.message) {
      errorMessage = err.message;
    }
    notify("❌ " + errorMessage, "error");
    deleteBtn.textContent = originalText;
    deleteBtn.disabled = false;
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Extract filename from public_id
function getFileName(publicId) {
  const parts = publicId.split('/');
  return parts[parts.length - 1] || 'Unknown';
}

// Main function to fetch and render gallery
async function fetchAndRenderGallery() {
  // Prevent multiple simultaneous refreshes
  if (isRefreshing) {
    console.log('⚠️  Already refreshing, skipping...');
    return;
  }

  const loading = document.getElementById("loading");
  const gallery = document.getElementById("gallery");
  
  try {
    isRefreshing = true;
    loading.style.display = "block";
    gallery.innerHTML = "";

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    console.log('🔄 Fetching gallery images...');
    const response = await fetch('https://tenkasidic-backend.onrender.com/gallery-images', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    updateStatus(true); // Server is responding
    
    if (data.success) {
      currentImages = data.images;
      updateStats();
      console.log(`✅ Successfully loaded ${currentImages.length} images`);
      
      if (currentImages.length === 0) {
        gallery.innerHTML = `
          <div class="empty-state">
            <h3>📷 No Images Yet</h3>
            <p>Upload some images to get started!</p>
          </div>
        `;
      } else {
        currentImages.forEach(img => {
          const filename = getFileName(img.public_id);
          const uploadDate = formatDate(img.created_at);
          
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
            <img src="${img.secure_url}" alt="${filename}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><rect width=\"100\" height=\"100\" fill=\"%23f0f0f0\"/><text x=\"50\" y=\"50\" text-anchor=\"middle\" dy=\".3em\" fill=\"%23999\">Error</text></svg>'">
            <button class="delete-btn" onclick="deleteImage('${img.public_id}', '${filename.replace(/'/g, "\\'")}')"
                    title="Delete ${filename}">
              🗑️ Delete
            </button>
            <div class="card-info">
              <div class="card-date">📅 ${uploadDate}</div>
            </div>
          `;
          gallery.appendChild(card);
        });
      }
    } else {
      gallery.innerHTML = `
        <div class="error-state">
          <h3>❌ Failed to Load Images</h3>
          <p>${data.message}</p>
          <button onclick="fetchAndRenderGallery()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ Error fetching gallery images:', error);
    updateStatus(false); // Server connection failed
    
    if (error.name === 'AbortError') {
      gallery.innerHTML = `
        <div class="error-state">
          <h3>⏰ Request Timed Out</h3>
          <p>Server is taking too long to respond</p>
          <button onclick="fetchAndRenderGallery()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
        </div>
      `;
    } else {
      gallery.innerHTML = `
        <div class="error-state">
          <h3>🔌 Connection Error</h3>
          <p>Make sure your server is running on https://tenkasidic-backend.onrender.com</p>
          <p>Error: ${error.message}</p>
          <button onclick="fetchAndRenderGallery()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Retry Connection</button>
        </div>
      `;
    }
    currentImages = [];
    updateStats();
  } finally {
    loading.style.display = "none";
    isRefreshing = false;
  }
}

// CONTROLLED auto-refresh - only when page is visible and not already refreshing
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(() => {
    // Only refresh if page is visible and not already refreshing
    if (!document.hidden && !isRefreshing) {
      console.log('🔄 Auto-refreshing gallery...');
      fetchAndRenderGallery();
    } else {
      console.log('⚠️  Skipping auto-refresh (page hidden or already refreshing)');
    }
  }, 60000); // 60 seconds to reduce server load
}

// Health check function
async function checkServerHealth() {
  try {
    const response = await fetch('https://tenkasidic-backend.onrender.com/health', {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      updateStatus(true);
      return true;
    }
  } catch (error) {
    updateStatus(false);
    return false;
  }
}

// Initialize on DOM load
function initializeAdminPanel() {
  if (isInitialized) {
    console.log('⚠️  Admin panel already initialized, skipping...');
    return;
  }
  
  isInitialized = true;
  console.log('🚀 Initializing Admin Panel...');
  
  // Check server health first
  checkServerHealth().then(isHealthy => {
    if (isHealthy) {
      fetchAndRenderGallery();
      startAutoRefresh();
    } else {
      const gallery = document.getElementById("gallery");
      gallery.innerHTML = `
        <div class="error-state">
          <h3>🔌 Server Not Available</h3>
          <p>Please start your server on https://tenkasidic-backend.onrender.com</p>
          <button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Refresh Page</button>
        </div>
      `;
      document.getElementById("loading").style.display = "none";
    }
  });
}

// Debug functions for console
function reloadGallery() {
  isRefreshing = false;
  fetchAndRenderGallery();
}

function toggleAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('🛑 Auto-refresh stopped');
  } else {
    startAutoRefresh();
    console.log('▶️ Auto-refresh started');
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", initializeAdminPanel);

// Stop auto-refresh when page becomes hidden
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    console.log('📄 Page hidden, pausing auto-refresh');
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  } else {
    console.log('📄 Page visible, resuming auto-refresh');
    startAutoRefresh();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Make functions globally available
window.deleteImage = deleteImage;
window.reloadGallery = reloadGallery;
window.toggleAutoRefresh = toggleAutoRefresh;

// Initialize widget when document is ready
let widget;
document.addEventListener("DOMContentLoaded", function() {
  widget = initializeCloudinaryWidget();
  
  // Event listeners for buttons
  document.getElementById("upload_widget").addEventListener("click", () => widget.open(), false);
  document.getElementById("refresh_btn").addEventListener("click", () => {
    if (!isRefreshing) {
      fetchAndRenderGallery();
    }
  }, false);
});