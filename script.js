function getUrl() {
  const urlElement = document.getElementById("url");
  const errorElement = document.getElementById("error-message");

  // 에러 메시지 숨기기
  hideError();

  // 현재 활성 탭의 URL 가져오기
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      const url = tabs[0].url;

      // chrome:// URL이거나 특수 페이지인 경우 경고 표시
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:")
      ) {
        urlElement.textContent = `⚠️ ${url}\n(브라우저 내부 페이지입니다 - 새로고침하거나 일반 웹사이트로 이동해주세요)`;
        urlElement.style.color = "#ff6b6b";
        urlElement.className = "url warning-url";
      } else {
        urlElement.textContent = url;
        urlElement.style.color = "#86868b";
        urlElement.className = "url normal-url";
      }

      console.log(url);
    }
  });
}

function showError(message) {
  const errorElement = document.getElementById("error-message");
  errorElement.textContent = message;
  errorElement.style.display = "block";
}

function hideError() {
  const errorElement = document.getElementById("error-message");
  errorElement.style.display = "none";
}

function enableUrlInput() {
  const urlElement = document.getElementById("url");
  const urlInput = document.getElementById("url-input");

  // 현재 URL을 입력 필드에 설정
  let currentUrl = urlElement.textContent;
  if (currentUrl.startsWith("⚠️")) {
    // 경고 메시지에서 URL 부분만 추출
    const urlMatch = currentUrl.match(/⚠️\s*(.*?)\n/);
    if (urlMatch) {
      currentUrl = urlMatch[1];
    }
  }

  urlInput.value = currentUrl;

  // 요소 전환
  urlElement.style.display = "none";
  urlInput.style.display = "block";
  urlInput.focus();
  urlInput.select();
}

function disableUrlInput() {
  const urlElement = document.getElementById("url");
  const urlInput = document.getElementById("url-input");

  urlElement.style.display = "block";
  urlInput.style.display = "none";
}

async function navigateToUrl(url) {
  try {
    // URL 유효성 검사
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // URL 형식 검사
    new URL(url);

    // 현재 활성 탭으로 이동
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab) {
      await chrome.tabs.update(tab.id, { url: url });
      return true;
    }
  } catch (error) {
    console.error("URL 이동 오류:", error);
    return false;
  }
  return false;
}

function refreshUrl() {
  const refreshBtn = document.getElementById("refresh-btn");

  // 새로고침 애니메이션
  refreshBtn.style.transform = "translateY(-50%) rotate(180deg)";

  setTimeout(() => {
    refreshBtn.style.transform = "translateY(-50%) rotate(0deg)";
  }, 300);

  // URL 다시 가져오기
  getUrl();
}

async function handleButtonClick() {
  console.log("button");

  const button = document.getElementById("btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const urlInput = document.getElementById("url-input");

  // URL 입력 모드인 경우 URL 이동 처리
  if (urlInput.style.display !== "none") {
    const inputUrl = urlInput.value.trim();

    if (!inputUrl) {
      showError("URL을 입력해주세요.");
      return;
    }

    button.disabled = true;
    button.textContent = "페이지 이동 중...";
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = "0.5";

    try {
      const success = await navigateToUrl(inputUrl);

      if (success) {
        // 페이지 이동 성공 후 약간 대기
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // URL 입력 모드 종료
        disableUrlInput();
        hideError();

        // URL 정보 업데이트
        getUrl();

        button.textContent = "Go Visualize";
        button.disabled = false;
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
      } else {
        throw new Error("유효하지 않은 URL입니다.");
      }
    } catch (error) {
      showError(`오류 발생: ${error.message}`);
      button.textContent = "Go Visualize";
      button.disabled = false;
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
    }
    return;
  }

  button.disabled = true;
  button.textContent = "Working hard...";
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = "0.5";

  try {
    // 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab) {
      // 브라우저 내부 페이지 체크
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:")
      ) {
        throw new Error(
          "브라우저 내부 페이지에서는 DOM 분석을 할 수 없습니다. 일반 웹사이트로 이동하거나 URL을 직접 입력해주세요."
        );
      }

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
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";

      // GIF 버튼 활성화 메시지 전송
      await chrome.tabs.sendMessage(tab.id, {
        action: "enableGifCapture",
      });
    }
  } catch (error) {
    console.error("오류 발생:", error);
    showError(error.message);
    enableUrlInput();

    button.textContent = "Go Visualize";
    button.disabled = false;
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = "1";
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
  const refreshBtn = document.getElementById("refresh-btn");
  const urlInput = document.getElementById("url-input");

  button.addEventListener("click", handleButtonClick);
  refreshBtn.addEventListener("click", refreshUrl);

  // URL 입력 필드에서 Enter 키 처리
  urlInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleButtonClick();
    }
  });

  // URL 입력 필드에서 Escape 키로 취소
  urlInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      disableUrlInput();
      hideError();
    }
  });
});
