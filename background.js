console.log('🎯 TS2 Leaderboard Downloader loaded!');

let capturedTokens = {
  deviceToken: null,
  accessToken: null, 
  playerId: null,
  clientVersion: '4.19.1.157',
  origin: 'https://265fae58-e5e8-11ee-92c7-27213255ed62.pley.games'
};

// Store leaderboard data
let leaderboardData = {};

// Intercept tokens from network requests
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (details.url.includes('game.trainstation2.com')) {
      console.log('🎯 Request detected to:', details.url);
      
      // Build headers object
      const headers = {};
      if (details.requestHeaders) {
        details.requestHeaders.forEach(header => {
          headers[header.name] = header.value;
          headers[header.name.toLowerCase()] = header.value;
        });
      }
      
      // Extract and save tokens
      let tokensUpdated = false;
      
      if (headers['pxfd-game-access-token'] || headers['Pxfd-Game-Access-Token']) {
        capturedTokens.accessToken = headers['pxfd-game-access-token'] || headers['Pxfd-Game-Access-Token'];
        tokensUpdated = true;
      }
      if (headers['pxfd-player-id'] || headers['Pxfd-Player-Id']) {
        capturedTokens.playerId = headers['pxfd-player-id'] || headers['Pxfd-Player-Id'];
        tokensUpdated = true;
      }
      if (headers['pxfd-device-token'] || headers['Pxfd-Device-Token']) {
        capturedTokens.deviceToken = headers['pxfd-device-token'] || headers['Pxfd-Device-Token'];
        tokensUpdated = true;
      }
      
      if (tokensUpdated) {
        console.log('✅ Tokens captured:', capturedTokens);
        // Save to storage
        chrome.storage.local.set({ts2_tokens: capturedTokens});
      }
    }
  },
  {urls: ["https://game.trainstation2.com/*"]},
  ["requestHeaders"]
);

// Store leaderboard data in persistent storage

// Load saved data on startup
chrome.storage.local.get(['ts2_leaderboard_data'], function(result) {
  if (result.ts2_leaderboard_data) {
    leaderboardData = result.ts2_leaderboard_data;
    console.log('Loaded saved leaderboard data');
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getTokens') {
    sendResponse({tokens: capturedTokens});
  }
  else if (request.action === 'fetchAllUnions') {
    fetchAllUnions()
      .then(data => {
        leaderboardData = data;
        // Save to persistent storage
        chrome.storage.local.set({ts2_leaderboard_data: data});
        sendResponse({success: true, data: data});
      })
      .catch(error => {
        sendResponse({success: false, error: error.message});
      });
    return true; // Keep message channel open for async response
  }
  else if (request.action === 'downloadCSV') {
    if (Object.keys(leaderboardData).length === 0) {
      sendResponse({success: false, error: 'No data available. Fetch unions first.'});
    } else {
      try {
        const csvContent = generateCSV(leaderboardData);
        console.log('Generated CSV content length:', csvContent.length);
        console.log('First 200 chars of CSV:', csvContent.substring(0, 200));
        
        downloadCSV(csvContent)
          .then(() => {
            sendResponse({success: true});
          })
          .catch(error => {
            console.error('Download error:', error);
            sendResponse({success: false, error: error.message});
          });
      } catch (error) {
        console.error('CSV generation error:', error);
        sendResponse({success: false, error: error.message});
      }
    }
    return true; // Keep message channel open for async response
  }
  else if (request.action === 'hasData') {
    // Check if we have data available for download
    sendResponse({hasData: Object.keys(leaderboardData).length > 0});
  }
  else if (request.action === 'testDownload') {
    testDownload();
    sendResponse({success: true});
  }
});

// Function to fetch all unions
async function fetchAllUnions() {
  const brackets = {
    "270eb39e-64d6-4571-be33-669a48e2319b": "BNGZR01",
    "2a6a6881-7324-4252-9b0b-5f1c43aa14b6": "BNGZR02", 
    "69acd4b3-004e-4070-b231-dc481350cc5a": "BNGZR03",
    "fcf3123b-8c60-405b-a98b-1e72453bdb9b": "BNGZR04",
    "83bd6ff9-321f-42bf-9582-08776c588fd1": "BNGZR05",
    "31272b1c-2b6c-4a51-b668-8dceaf6d9cf5": "BNGZR06",
    "1a8fa343-a75d-4ccb-9f65-8085284f1bc6": "BNGZR07",
    "1e3982dc-4436-4ea9-8054-bd82b2c9c51e": "BNGZR08"
  };

  const allData = {};

  for (let i = 0; i < Object.keys(brackets).length; i++) {
    const bracketId = Object.keys(brackets)[i];
    const bracketName = brackets[bracketId];
    
    console.log(`Fetching ${bracketName}...`);

    try {
      const data = await fetchLeaderboardData(bracketId, capturedTokens);
      allData[bracketId] = {
        data: data,
        bracketName: bracketName
      };

      // Delay to avoid rate limiting
      if (i < Object.keys(brackets).length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error fetching ${bracketName}:`, error);
      throw error;
    }
  }

  console.log('All unions fetched successfully!');
  return allData;
}

// Function to fetch single bracket data
function fetchLeaderboardData(bracketId, tokens) {
  return new Promise((resolve, reject) => {
    const url = `https://game.trainstation2.com/api/v2/query/get-leader-board-table?LeaderBoardId=0198f5b5-1fdc-7102-b32d-ca9dcfcae260&Type=global-guild-member-contribution&Bracket=${bracketId}`;
    
    // Generate UUID for request
    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'PXFD-Client-Information': JSON.stringify({"Store":"pley","Version":tokens.clientVersion,"Language":"en"}),
        'PXFD-Client-Version': tokens.clientVersion,
        'PXFD-Device-Token': tokens.deviceToken,
        'PXFD-Game-Access-Token': tokens.accessToken,
        'PXFD-Player-Id': tokens.playerId,
        'PXFD-Request-Id': generateUUID(),
        'PXFD-Retry-No': '0',
        'PXFD-Sent-At': new Date().toISOString(),
        'Origin': tokens.origin,
        'Priority': 'u=4'
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data && data.Success === false) {
        reject(new Error(data.Error?.Message || 'API request failed'));
      } else {
        resolve(data);
      }
    })
    .catch(error => {
      reject(error);
    });
  });
}

// Generate CSV content
function generateCSV(leaderboardData) {
  const allPlayersByBracket = {};
  
  // Organize players by bracket
  Object.keys(leaderboardData).forEach(bracketId => {
    const bracketData = leaderboardData[bracketId];
    const bracketName = bracketData.bracketName;

    if (bracketData.data && bracketData.data.Data && bracketData.data.Data.Progresses) {
      allPlayersByBracket[bracketName] = bracketData.data.Data.Progresses
        .filter(member => member && member.PlayerName !== undefined && member.Progress !== undefined)
        .map(member => ({
          PlayerName: member.PlayerName.toString().trim(),
          Score: member.Progress
        }))
        .sort((a, b) => b.Score - a.Score);
    }
  });

  // Create CSV content
  const maxPlayers = Math.max(...Object.values(allPlayersByBracket).map(bracket => bracket.length));
  let csvContent = '';
  const headers = [];

  Object.keys(allPlayersByBracket).forEach(bracketName => {
    headers.push(`"${bracketName} IGN"`, `"${bracketName} SP"`);
  });

  csvContent += headers.join(',') + '\\n';

  for (let i = 0; i < maxPlayers; i++) {
    const row = [];
    
    Object.keys(allPlayersByBracket).forEach(bracketName => {
      const bracketPlayers = allPlayersByBracket[bracketName];
      
      if (i < bracketPlayers.length) {
        const player = bracketPlayers[i];
        row.push(`"${player.PlayerName.replace(/"/g, '""')}"`, player.Score);
      } else {
        row.push('', '');
      }
    });
    
    csvContent += row.join(',') + '\\n';
  }

  return csvContent;
}

// Download CSV file
function downloadCSV(csvContent) {
  return new Promise((resolve, reject) => {
    console.log('downloadCSV called with content length:', csvContent.length);
    
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
    
    // Convert CSV content to base64 data URL instead of blob URL
    const csvWithBOM = "\uFEFF" + csvContent;
    const base64Content = btoa(unescape(encodeURIComponent(csvWithBOM)));
    const dataUrl = `data:text/csv;charset=utf-8;base64,${base64Content}`;
    
    console.log('Data URL created, length:', dataUrl.length);
    console.log('Attempting download with filename:', `ts2-all-unions-${timestamp}.csv`);
    
    chrome.downloads.download({
      url: dataUrl,
      filename: `ts2-all-unions-${timestamp}.csv`,
      saveAs: false
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('Download started successfully with ID:', downloadId);
        resolve(downloadId);
      }
    });
  });
}

// Test download function
function testDownload() {
  const testContent = "Name,Score\nPlayer1,100\nPlayer2,200";
  const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
  
  // Use data URL instead of blob URL
  const base64Content = btoa(unescape(encodeURIComponent(testContent)));
  const dataUrl = `data:text/csv;charset=utf-8;base64,${base64Content}`;
  
  console.log('Test download - Data URL length:', dataUrl.length);
  
  chrome.downloads.download({
    url: dataUrl,
    filename: `test-${timestamp}.csv`,
    saveAs: false
  }, function(downloadId) {
    if (chrome.runtime.lastError) {
      console.error('Test download failed:', chrome.runtime.lastError);
    } else {
      console.log('Test download successful with ID:', downloadId);
    }
  });
}