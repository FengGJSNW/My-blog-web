function updateInputPlaceholders(rules, customPlaceholders) {
  const validSelectors = ['chatContainer', 'messageAuthorRole', 'userMessage', 'assistantMessage', 'codeBlock'];
  
  validSelectors.forEach(key => {
    const input = document.getElementById(key);
    if (input) {
      // 使用空对象作为默认值，防止 undefined 错误
      input.placeholder = (customPlaceholders && customPlaceholders[key]) || 
                          (rules.selectors && rules.selectors[key]) || 
                          '';
      input.value = (customPlaceholders && customPlaceholders[key]) || '';
    }
  });
}

// 加载规则和自定义placeholder
function loadRulesAndPlaceholders() {
  chrome.storage.local.get(['rules', 'customPlaceholders'], (data) => {
    // 确保 rules 和 selectors 总是对象
    const rules = data.rules || {};
    rules.selectors = rules.selectors || {};
    const customPlaceholders = data.customPlaceholders || {};
    updateInputPlaceholders(rules, customPlaceholders);
  });
}

// 初始加载
loadRulesAndPlaceholders();

let debounceTimer;

// 监听用户输入变化
document.getElementById('jsonRulesContainer').addEventListener('input', (event) => {
  if (event.target.tagName === 'INPUT') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const updatedCustomPlaceholders = {};
      document.querySelectorAll('#jsonRulesContainer input').forEach(input => {
        const key = input.id;
        const value = input.value.trim();
        if (value) {
          updatedCustomPlaceholders[key] = value;
        }
      });
      updateCustomPlaceholders(updatedCustomPlaceholders);
    }, 1000); // 1秒延迟
  }
});

// 更新自定义placeholder
function updateCustomPlaceholders(customPlaceholders) {
  chrome.storage.local.set({ customPlaceholders: customPlaceholders }, () => {
    loadRulesAndPlaceholders();
  });
}

// 添加重置按钮的功能
document.getElementById('resetButton').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetRules' }, (response) => {
      if (response.success) {
        loadRulesAndPlaceholders();
        alert('规则已重置为默认值');
      }
    });
});

document.getElementById('exportMarkdownBtn').addEventListener('click', () => {
  exportChat('markdown');
});

document.getElementById('exportJsonlBtn').addEventListener('click', () => {
  exportChat('jsonl');
});

document.getElementById('exportPdfBtn').addEventListener('click', () => {
  exportChat('pdf');
});

function exportChat(format) {
  chrome.storage.local.get('rules', (data) => {
    let rules = data.rules || {};

    // 获取表单中的自定义规则
    const customRules = {};
    document.querySelectorAll('#jsonRulesContainer input').forEach(input => {
      const key = input.id;
      const value = input.value.trim();
      if (value) {
        customRules[key] = value;
      }
    });

    // 将自定义规则合并到完整规则中
    if (!rules.selectors) {
      rules.selectors = {};
    }
    Object.assign(rules.selectors, customRules);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'exportChat', format: format, rules: rules }, (response) => {
        if (response && response.success) {
          console.log('聊天导出成功');
          showAppreciation();
        } else {
          console.error('导出聊天失败');
          alert('导出失败,请检查规则是否正确');
        }
      });
    });
  });
}

// Always show appreciation div in popup.html
document.getElementById('appreciation').style.display = 'block';

function showAppreciation() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get('lastAppreciationDate', (data) => {
    if (data.lastAppreciationDate !== today) {
      chrome.storage.local.set({ lastAppreciationDate: today }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              const appreciationDiv = document.createElement('div');
              appreciationDiv.style.position = 'fixed';
              appreciationDiv.style.bottom = '20px';
              appreciationDiv.style.right = '20px';
              appreciationDiv.style.padding = '20px';
              appreciationDiv.style.backgroundColor = '#f9f9f9';
              appreciationDiv.style.border = '1px solid #ddd';
              appreciationDiv.style.borderRadius = '8px';
              appreciationDiv.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
              appreciationDiv.style.fontFamily = 'Arial, sans-serif';
              appreciationDiv.style.color = '#333';
              appreciationDiv.innerHTML = `
                <p>如果你喜欢这个插件，欢迎支持我们：<a href="https://afdian.com/a/rythmeol" target="_blank" style="color: #007bff; text-decoration: none;">爱发电</a></p>
                <button id="closeAppreciationBtn" style="background-color: #007bff; color: #fff; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">关闭</button>
              `;
              document.body.appendChild(appreciationDiv);
              document.getElementById('closeAppreciationBtn').addEventListener('click', () => {
                appreciationDiv.remove();
              });
            }
          });
        });
      });
    }
  });
}

// Add event listener for file drop
const jsonRulesContainer = document.getElementById('jsonRulesContainer');
jsonRulesContainer.addEventListener('dragover', (event) => {
  event.preventDefault();
});

jsonRulesContainer.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/json') {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rules = JSON.parse(e.target.result);
        chrome.storage.local.set({ rules: rules });
        alert('规则已成功导入');
      } catch (error) {
        alert('导入的文件无效');
      }
    };
    reader.readAsText(file);
  } else {
    alert('请拖入有效的 JSON 文件');
  }
});


// Function to update local storage with user modifications
function updateLocalStorage(rules) {
  chrome.storage.local.set({ rules: { selectors: rules } }, () => {
    updateInputPlaceholders({ selectors: rules });
  });
}

// Event listener for user input changes with debounce
document.getElementById('jsonRulesContainer').addEventListener('input', (event) => {
  if (event.target.tagName === 'INPUT') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const updatedRules = {};
      document.querySelectorAll('#jsonRulesContainer input').forEach(input => {
        const key = input.id;
        const value = input.value;
        updatedRules[key] = value;
      });
      updateLocalStorage(updatedRules);
    }, 10000); // 10 秒延迟
  }
});

// Load rules from local storage on popup open
chrome.storage.local.get('rules', (data) => {
  const rules = data.rules || {};
  rules.selectors = rules.selectors || {};
  Object.keys(rules.selectors).forEach(key => {
    const input = document.getElementById(key);
    if (input) {
      input.value = rules.selectors[key];
      input.placeholder = rules.selectors[key];
    }
  });
  updateInputPlaceholders(rules);
});

document.addEventListener('DOMContentLoaded', () => {
  const updateAlert = document.getElementById('updateAlert');
  const exportFailed = localStorage.getItem('exportFailed');

  chrome.storage.local.get(['updateAvailable', 'lastVersion'], (data) => {
    if (exportFailed || data.updateAvailable) {
      updateAlert.style.display = 'block';
      updateAlert.innerHTML = `
        <p>${exportFailed ? 'Error，There is a mistake.' : ''}</p>
        <button id="checkForUpdatesBtn">Find the update</button>
      `;

      document.getElementById('checkForUpdatesBtn').addEventListener('click', () => {
        checkForUpdates();
      });
    }

    if (exportFailed) {
      localStorage.removeItem('exportFailed');
    }
  });
});

function checkForUpdates() {
  chrome.runtime.sendMessage({ action: 'checkForUpdates' }, (response) => {
    const updateAlert = document.getElementById('updateAlert');
    const exportFailed = localStorage.getItem('exportFailed');
    if (response && response.updateAvailable) {
      updateAlert.innerHTML = `
        <p>There is an update of rules. (${response.newVersion})。</p>
        <button id="updateRulesBtn">Update the rules</button>
      `;
      document.getElementById('updateRulesBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'updateRules' }, (updateResponse) => {
          if (updateResponse && updateResponse.success) {
            alert('Update Success!');
            updateAlert.style.display = 'none';
          } else {
            alert('Update Failed...');
          }
        });
      });
    } else {
      updateAlert.innerHTML = `
        <p>暂时没有新的规则文件${exportFailed ? '，请向开发者报告问题。' : ''}</p>
        <p>There is no new rule file at the moment ${exportFailed ? ', please report the problem to the developer' : ''}</p>
      `;
    }
  });
}

// 定义翻译
const translations = {
  zh: {
    toggleLanguage: "English",
    title: "Chat Exporter",
    chatContainerLabel: "聊天容器选择器:",
    messageAuthorRoleLabel: "消息作者角色选择器:",
    userMessageLabel: "用户消息选择器:",
    assistantMessageLabel: "助手消息选择器:",
    codeBlockLabel: "代码块nodeName:",
    previewRules: "预览规则",
    reset:"重置规则",
    exportMarkdown: "导出为 Markdown",
    exportJsonl: "导出为 JSONL",
    exportPdf: "导出为 PDF",
    appreciationText: "如果你喜欢这个插件，欢迎支持我们：",
    appreciationLink: '爱发电'
  },
  en: {
    toggleLanguage: "中文",
    title: "Chat Exporter",
    chatContainerLabel: "Chat Container Selector:",
    messageAuthorRoleLabel: "Message Author Role Selector:",
    userMessageLabel: "User Message Selector:",
    assistantMessageLabel: "Assistant Message Selector:",
    codeBlockLabel: "Code Block nodeName:",
    previewRules: "Preview Rules",
    reset:"Reset Rules",
    exportMarkdown: "Export as Markdown",
    exportJsonl: "Export as JSONL",
    exportPdf: "Export as PDF",
    appreciationText: "If you like this plugin, please support us on:",
    appreciationLink: 'Afdian link'
  }
};

let currentLanguage = 'zh';

function setLanguage(lang) {
  currentLanguage = lang;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = translations[lang][key];
  });
}

document.getElementById('languageToggle').addEventListener('click', () => {
  const newLang = currentLanguage === 'zh' ? 'en' : 'zh';
  setLanguage(newLang);
});

// 初始化语言
document.addEventListener('DOMContentLoaded', () => {
  setLanguage('zh');
  // ... 其他初始化代码 ...
});

// 添加预览规则按钮的逻辑
document.getElementById('jsonRulesPreviewBtn').addEventListener('click', () => {
  const rules = {};
  document.querySelectorAll('#jsonRulesContainer input').forEach(input => {
    rules[input.id] = input.value;
  });
  
  const jsonRulesPreview = document.getElementById('jsonRulesPreview');
  jsonRulesPreview.textContent = JSON.stringify(rules, null, 2);
  jsonRulesPreview.style.display = 'block';
});
