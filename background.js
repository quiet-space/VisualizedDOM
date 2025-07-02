// Manifest V3 Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("DOM Visualization Extension installed");
});

// 메시지 전달 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "visualizationComplete") {
    // content script에서 popup으로 메시지 전달
    chrome.runtime.sendMessage(message);
  }
});
