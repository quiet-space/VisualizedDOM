function getUrl() {
  const urlElement = document.getElementById("url");

  // 현재 활성 탭의 URL 가져오기
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      urlElement.textContent = tabs[0].url;
      console.log(tabs[0].url);
    }
  });
}

async function handleButtonClick() {
  console.log("button");

  const button = document.getElementById("btn");
  button.disabled = true;
  button.textContent = "Working hard...";

  try {
    // 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab) {
      // 강력 새로고침 (캐시 무시)
      await chrome.tabs.reload(tab.id, { bypassCache: true });

      // 페이지 로드 완료 대기
      await waitForPageLoad(tab.id);

      // DOM 트리 시각화 시작
      await chrome.tabs.sendMessage(tab.id, {
        action: "startDOMTreeVisualization",
      });

      // 시각화 완료 대기
      await waitForVisualizationComplete();

      // Preview 생성 완료 대기
      await waitForPreviewComplete();

      // 버튼 텍스트 변경
      button.textContent = "We Did It!";
      button.disabled = false;

      // GIF 버튼 활성화 메시지 전송
      await chrome.tabs.sendMessage(tab.id, {
        action: "enableGifCapture",
      });
    }
  } catch (error) {
    console.error("오류 발생:", error);
    button.textContent = "Error occurred";
    button.disabled = false;
  }
}

function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        // 페이지 로드 후 약간의 지연
        setTimeout(resolve, 1000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function waitForVisualizationComplete() {
  return new Promise((resolve) => {
    const listener = (message, sender, sendResponse) => {
      if (message.action === "visualizationComplete") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
}

function waitForPreviewComplete() {
  return new Promise((resolve) => {
    const listener = (message, sender, sendResponse) => {
      if (message.action === "previewComplete") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // 기본 타임아웃 설정 (10초)
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve();
    }, 10000);
  });
}

console.log("11");

getUrl();

// 버튼 클릭 이벤트 리스너 추가
document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("btn");
  button.addEventListener("click", handleButtonClick);
});
