chrome.runtime.onInstalled.addListener(() => {
  // Initialize the storage for the appreciation popup
  chrome.storage.local.set({ lastAppreciationDate: null, lastCheckDate: null, lastVersion: null });
  resetRules();
});

function compareVersions(v1, v2) {
  const parts1 = (v1 || '').split('.').map(Number);
  const parts2 = (v2 || '').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0; // 如果没有更多部分，默认为0
    const num2 = parts2[i] || 0; 
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0; // 相等
}

// Function to check for updates
function checkForUpdates(callback) {
  chrome.storage.local.get(['lastCheckDate', 'lastVersion'], (data) => {
    const now = Date.now();
    const lastCheck = data.lastCheckDate ? new Date(data.lastCheckDate).getTime() : 0;
    const daysSinceLastCheck = Math.floor((now - lastCheck) / (1000 * 60 * 60 * 24));

    if (daysSinceLastCheck >= 3 || !data.lastCheckDate) {
      fetch('https://raw.githubusercontent.com/Rythmeol/Chat-Exporter-Config/main/lastVersion.json')
        .then(response => response.json())
        .then(json => {
          const newVersion = json.version;
          let localVersion = data.lastVersion;
          if (localVersion === null) {
            fetch(chrome.runtime.getURL('lastVersion.json'))
              .then(response => response.json())
              .then(json => {
                localVersion = json.version;
              })
              .catch(error => {
                console.error('Error loading local version:', error);
              });
          }

          if (compareVersions(newVersion, localVersion) > 0) {
            chrome.storage.local.set({ lastVersion: newVersion, updateAvailable: true });
            callback(true, newVersion);
          } else {
            chrome.storage.local.set({ lastVersion: localVersion, updateAvailable: false });
            callback(false, localVersion);
          }
          chrome.storage.local.set({ lastCheckDate: now });
        })
        .catch(error => {
          console.error('检查更新时出错:', error);
          callback(false, null);
        });
    } else {
      callback(data.updateAvailable, data.lastVersion);
    }
  });
}

// Call checkForUpdates on startup
checkForUpdates((updateAvailable, newVersion) => {
  console.log('Update check on startup:', updateAvailable ? `New version available: ${newVersion}` : 'No updates available');
});

// Function to reset rules to default from rules.json
function resetRules() {
  fetch(chrome.runtime.getURL('rules.json'))
    .then(response => response.json())
    .then(defaultRules => {
      chrome.storage.local.set({ rules: defaultRules });
      chrome.storage.local.remove('customPlaceholders');
    })
    .catch(error => {
      console.error('Error loading default rules:', error);
    });
}

// Add listener for reset button in popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'resetRules') {
    resetRules();
    sendResponse({ success: true });
  } else if (request.action === 'checkForUpdates') {
    checkForUpdates((updateAvailable, newVersion) => {
      sendResponse({ updateAvailable, newVersion });
    });
    return true; // 保持消息通道开放以进行异步响应
  } else if (request.action === 'updateRules') {
    updateRules((success) => {
      sendResponse({ success });
    });
    return true; // 保持消息通道开放以进行异步响应
  }
});

// Add listener for update rules
function updateRules(callback) {
  Promise.all([
    fetch('https://raw.githubusercontent.com/Rythmeol/Chat-Exporter-Config/main/rules.json').then(res => res.json()),
    fetch('https://raw.githubusercontent.com/Rythmeol/Chat-Exporter-Config/main/lastVersion.json').then(res => res.json())
  ]).then(([newRules, newVersion]) => {
    chrome.storage.local.set({ rules: newRules, lastVersion: newVersion.version, updateAvailable: false }, () => {
      callback(true);
    });
  }).catch(error => {
    console.error('更新规则时出错:', error);
    callback(false);
  });
}
