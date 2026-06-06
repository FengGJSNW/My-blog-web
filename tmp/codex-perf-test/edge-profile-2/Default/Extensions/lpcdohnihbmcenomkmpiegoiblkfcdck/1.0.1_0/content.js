let listenerAdded = false;

function addListenerOnce() {
  if (!listenerAdded) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "exportChat") {
        applyRules(request.rules);
        exportChat(request.format);
        sendResponse({ success: true });
      }
    });
    listenerAdded = true; // 设置标志位，防止重复添加
  }
}
function applyRules(rules) {
  console.log("开始应用规则"); // 添加打印信息
  if (rules.variables) {
    Object.assign(globalThis, rules.variables); // 使用globalThis来允许全局替换
  }
  if (rules.selectors) {
    Object.assign(selectors, rules.selectors);
  }
  if (rules.config) {
    Object.assign(config, rules.config);
  }
  if (rules.functions) {
    Object.keys(rules.functions).forEach((key) => {
      if (typeof globalThis[key] === "function") {
        globalThis[key] = rules.functions[key]; // 替换全局函数
      }
    });
  }
  console.log("规则应用完成"); // 添加打印信息
}

const selectors = {
  chatContainer:'div[role="presentation"]',
  messageAuthorRole: "div[data-message-author-role]",
  userMessage: 'div[data-message-author-role="user"]',
  assistantMessage: 'div[data-message-author-role="assistant"]',
  codeBlock: "pre",
  codeLanguage: "div > div > span",
  codeContent: "code",
  activeChatTitle: "li.relative a",
  activeChatTitleDiv: "div",
};

const config = {
  reverseMessageOrder: false, // 设置为 true 以适应消息顺序倒过来的站点
};

function ensureDependencies(callback) {
  const checkDependencies = setInterval(() => {
    if (
      typeof TurndownService !== "undefined" &&
      typeof html2pdf !== "undefined"
    ) {
      clearInterval(checkDependencies);
      callback();
    }
  }, 100);
}

function initializeTurndownService() {
  const turndownService = new TurndownService();

  turndownService.addRule("codeBlock", {
    filter: (node) => node.nodeName === selectors.codeBlock,
    replacement: (content, node) => {
      const language = node.querySelector(selectors.codeLanguage)
        ? node.querySelector(selectors.codeLanguage).innerText
        : "";
      const codeContent = node.querySelector(selectors.codeContent)
        ? node.querySelector(selectors.codeContent).innerText.trim()
        : "";
      return "```" + language + "\n" + codeContent + "\n```";
    },
  });

  turndownService.addRule("removeUserAvatar", {
    filter: (node) =>
      node.nodeName === "IMG" && node.getAttribute("alt") === "User",
    replacement: () => "",
  });

  turndownService.addRule("removeAssistantAvatar", {
    filter: (node) =>
      node.nodeName === "IMG" && node.getAttribute("alt") === "GPT",
    replacement: () => "",
  });

  turndownService.addRule("removeCopyCodeButton", {
    filter: (node) =>
      node.nodeName === "BUTTON",
    replacement: () => "",
  });

  return turndownService;
}

function getChatTitle() {
  const currentUrl = window.location.href;
  const activeChatTitleElement = Array.from(
    document.querySelectorAll(selectors.activeChatTitle)
  ).find((a) => a.href === currentUrl);
  return activeChatTitleElement
    ? activeChatTitleElement
        .querySelector(selectors.activeChatTitleDiv)
        .innerText.trim()
    : "chat";
}


function removeExternalImages(container) {

  const clonedContainer = container.cloneNode(true);
  clonedContainer.querySelectorAll("img").forEach((img) => {
    if (img.src && img.src.startsWith("http")) {
      img.remove();
    }
  });
  return clonedContainer;
}

function processUserMessage(node, turndownService) {
  const userText = node.innerText.trim();
  const markdown = "##user\n\n" + userText.replace(/\n/g, "  \n") + "\n\n";
  const jsonlData = { role: "user", content: userText };
  //console.log("markdown",markdown);

  return { markdown, jsonlData };
}

function processAssistantMessage(node, turndownService) {
  const assistantMarkdown = turndownService.turndown(node);
  const markdown = "##assistant\n\n" + assistantMarkdown + "\n\n";
  const jsonlData = { role: "assistant", content: assistantMarkdown };
  //console.log("markdown",markdown);
  return { markdown, jsonlData };
}

function processMessages(turndownService, chatContainer) {
  let markdown = "";
  let jsonlData = [];

  const messages = Array.from(
    chatContainer.querySelectorAll(selectors.messageAuthorRole)
  );
  if (config.reverseMessageOrder) {
    messages.reverse();
  }

  messages.forEach((node) => {
    let role;
    if (node.matches(selectors.userMessage)) {
      role = 'userMessage';
    } else if (node.matches(selectors.assistantMessage)) {
      role = 'assistantMessage';
    } else {
      console.warn('未知的消息类型:', node);
      return; // 跳过未知类型的消息
    }

    switch (role) {
      case 'userMessage':
        const { markdown: userMarkdown, jsonlData: userJsonlData } = processUserMessage(node, turndownService);
        markdown += userMarkdown;
        jsonlData.push(userJsonlData);
        break;
      case 'assistantMessage':
        const { markdown: assistantMarkdown, jsonlData: assistantJsonlData } = processAssistantMessage(node, turndownService);
        markdown += assistantMarkdown;
        jsonlData.push(assistantJsonlData);
        break;
    }
  });

  return { markdown, jsonlData };
}

function exportChat(format) {
  const chatContainer = document.querySelector(selectors.chatContainer);
  if (!chatContainer) {
    throw new Error("聊天容器未找到，无法导出聊天内容");
  }

  const turndownService = initializeTurndownService();
  const metadata = {
    chatTitle: getChatTitle(),
    timestamp: new Date().toISOString(),
  };

  try {
    switch (format) {
      case "markdown":
        exportMarkdown(turndownService, chatContainer, metadata);
        break;
      case "jsonl":
        exportJsonl(turndownService, chatContainer, metadata);
        break;
      case "pdf":
        exportPdf(chatContainer, metadata);
        break;
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  } catch (error) {
    console.error(`导出${format}格式时出错:`, error);
    localStorage.setItem('exportFailed', 'true'); // 设置导出失败标志
    throw error;
  }
}

function exportMarkdown(turndownService, chatContainer, metadata) {
  const { markdown } = processMessages(turndownService, chatContainer);
  downloadFile(markdown, `${metadata.chatTitle}.md`, "text/markdown");
}

function exportJsonl(turndownService, chatContainer, metadata) {
  const { jsonlData } = processMessages(turndownService, chatContainer);
  const jsonlContent = jsonlData.map((entry) => JSON.stringify(entry)).join("\n");
  downloadFile(jsonlContent, `${metadata.chatTitle}.jsonl`, "application/jsonl");
  downloadFile(JSON.stringify(metadata, null, 2), `${metadata.chatTitle}_metadata.json`, "application/json");
}

function exportPdf(chatContainer, metadata) {
  const newChatContainer = removeExternalImages(chatContainer);
  const opt = {
    margin: [0, 0, 0, 0],
    filename: `${metadata.chatTitle}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
  };

  html2pdf().from(newChatContainer).set(opt).save();
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

ensureDependencies(() => {
  addListenerOnce(); // 调用函数添加监听器
});