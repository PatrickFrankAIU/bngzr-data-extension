document.addEventListener('DOMContentLoaded', function() {
  const tokenStatusEl = document.getElementById('tokenStatus');
  const progressTextEl = document.getElementById('progressText');
  const fetchAllBtn = document.getElementById('fetchAll');
  const downloadCSVBtn = document.getElementById('downloadCSV');
  const viewTokensBtn = document.getElementById('viewTokens');

  // Check token status and data availability on load
  updateTokenStatus();
  checkDataAvailability();

  // Fetch All Unions button
  fetchAllBtn.addEventListener('click', function() {
    fetchAllBtn.disabled = true;
    fetchAllBtn.textContent = 'Fetching...';
    progressTextEl.textContent = 'Starting to fetch all unions...';
    progressTextEl.className = 'progress';

    chrome.runtime.sendMessage({action: 'fetchAllUnions'}, function(response) {
      if (response.success) {
        progressTextEl.textContent = 'All unions fetched successfully! Data saved.';
        progressTextEl.className = 'progress success';
        fetchAllBtn.textContent = 'Fetch All Unions Data';
        downloadCSVBtn.disabled = false;
      } else {
        progressTextEl.textContent = `Error: ${response.error}`;
        progressTextEl.className = 'progress error';
        fetchAllBtn.disabled = false;
        fetchAllBtn.textContent = 'Fetch All Unions Data';
      }
    });
  });

  // Download CSV button
  downloadCSVBtn.addEventListener('click', function() {
    downloadCSVBtn.disabled = true;
    downloadCSVBtn.textContent = 'Downloading...';
    
    chrome.runtime.sendMessage({action: 'downloadCSV'}, function(response) {
      if (response.success) {
        progressTextEl.textContent = 'CSV file downloaded!';
        progressTextEl.className = 'progress success';
      } else {
        progressTextEl.textContent = `Error: ${response.error}`;
        progressTextEl.className = 'progress error';
      }
      downloadCSVBtn.disabled = false;
      downloadCSVBtn.textContent = 'Download CSV File';
    });
  });

  // View Tokens button
  viewTokensBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'getTokens'}, function(response) {
      alert('Captured Tokens:\n\n' + JSON.stringify(response.tokens, null, 2));
    });
  });

  function updateTokenStatus() {
    chrome.runtime.sendMessage({action: 'getTokens'}, function(response) {
      if (response.tokens && response.tokens.accessToken) {
        tokenStatusEl.innerHTML = 'Tokens captured and ready';
        tokenStatusEl.style.color = 'green';
        fetchAllBtn.disabled = false;
      } else {
        tokenStatusEl.innerHTML = '❌ No tokens captured yet<br><small>Play the game to capture tokens</small>';
        tokenStatusEl.style.color = 'red';
        fetchAllBtn.disabled = true;
      }
    });
  }

  function checkDataAvailability() {
    chrome.runtime.sendMessage({action: 'hasData'}, function(response) {
      if (response.hasData) {
        downloadCSVBtn.disabled = false;
        progressTextEl.textContent = 'Previously fetched data available for download';
        progressTextEl.className = 'progress success';
      } else {
        downloadCSVBtn.disabled = true;
      }
    });
  }
});