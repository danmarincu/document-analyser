let dataTable;
const BASE_URL = '/api';

// Common headers for all requests
const commonHeaders = {
    'Content-Type': 'application/json'
};

// Initialize DataTable
$(document).ready(function() {
    dataTable = $('#documentsTable').DataTable({
        order: [[0, 'desc']], // Sort by timestamp descending by default
        columns: [
            { data: 'timestamp' },
            { data: 'fileName' },
            { 
                data: 'status',
                render: function(data, type, row) {
                    return `<span class="status-${data?.toLowerCase()}">${data || 'N/A'}</span>`;
                }
            },
            { 
                data: 'analysis',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return data ? JSON.stringify(data, null, 2) : 'N/A';
                    }
                    return data;
                }
            },
            { 
                data: 'id',
                render: function(data, type, row) {
                    return `<button class="delete-btn" onclick="deleteDocument('${data}')">Delete</button>`;
                }
            }
        ],
        responsive: true,
        pageLength: 10,
        dom: '<"top"lf>rt<"bottom"ip><"clear">'
    });
    
    // Create and append refresh button to search area
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refreshButton';
    refreshButton.textContent = 'Refresh';
    refreshButton.onclick = fetchDocuments;
    
    const searchWrapper = document.querySelector('.dataTables_filter');
    searchWrapper.appendChild(refreshButton);
    
    // Initial data load
    fetchDocuments();

    // Set up auto-refresh every 30 seconds
    setInterval(fetchDocuments, 30000);
});

async function fetchDocuments() {
    try {
        console.log('fetching documents from ', `${BASE_URL}/documents`);
        const response = await fetch(`${BASE_URL}/documents`, {
            method: 'GET',
            headers: commonHeaders
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform the data for DataTables
        const tableData = data.documents.map(doc => {
            const timestamp = doc.processedAt || doc.createdAt || 'N/A';
            const formattedDate = timestamp !== 'N/A' 
                ? new Date(timestamp).toLocaleString()
                : 'N/A';
            
            return {
                timestamp: formattedDate,
                fileName: doc.name,
                status: doc.status,
                analysis: doc.analysis,
                id: doc.id
            };
        });

        // Clear and reload the table
        dataTable.clear().rows.add(tableData).draw();
    } catch (error) {
        console.error('Error fetching documents:', error);
        showError('Failed to fetch documents. Please try again later.');
    }
}

async function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('fileBox');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a file to upload.');
        return;
    }

    // Show loading state
    const uploadButton = event.target;
    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading...';
    
    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const content = e.target.result.split(',')[1]; // Get base64 content
            
            const payload = {
                name: file.name,
                type: file.type || 'application/json',
                content: content
            };

            const response = await fetch(`${BASE_URL}/documents`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showSuccess('Document uploaded successfully!');
            fileInput.value = ''; // Clear the file input
            fetchDocuments(); // Refresh the table
        };

        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading document:', error);
        showError('Failed to upload document. Please try again.');
    } finally {
        // Reset button state
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Document';
    }
}

async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/documents/${documentId}`, {
            method: 'DELETE',
            headers: commonHeaders
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showSuccess('Document deleted successfully!');
        fetchDocuments(); // Refresh the table
    } catch (error) {
        console.error('Error deleting document:', error);
        showError('Failed to delete document. Please try again.');
    }
}

function showError(message) {
    const container = document.querySelector('.container');
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const container = document.querySelector('.container');
    const existingSuccess = document.querySelector('.success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => successDiv.remove(), 5000);
} 