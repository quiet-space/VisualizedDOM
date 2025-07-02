function getUrl() {
  const urlElement = document.getElementById("url");
  const errorElement = document.getElementById("error-message");

  // 에러 메시지 숨기기
  hideError();

  // 현재 활성 탭의 URL 가져오기
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      const url = tabs[0].url;

      // chrome:// URL이거나 특수 페이지인 경우 에러 표시 및 URL 입력 모드 활성화
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:")
      ) {
        showError(
          "브라우저 내부 페이지에서는 DOM 분석을 할 수 없습니다. 아래에 분석하고 싶은 웹사이트 URL을 입력해주세요."
        );
        enableUrlInput();

        // URL 입력 필드에 기본값 설정
        const urlInput = document.getElementById("url-input");
        urlInput.value = "https://";
        urlInput.focus();
        urlInput.setSelectionRange(8, 8); // https:// 뒤에 커서 위치
      } else {
        urlElement.textContent = url;
        urlElement.style.color = "#86868b";
        urlElement.className = "url normal-url";

        // 정상 URL인 경우 URL 입력 모드 해제
        disableUrlInput();
        hideError();
      }

      console.log(url);
    }
  });
}

function showError(message) {
  const errorElement = document.getElementById("error-message");
  const refreshBtn = document.getElementById("refresh-btn");
  const urlWrapper = document.querySelector(".url-input-wrapper");
  const container = document.querySelector(".container");

  errorElement.textContent = message;
  errorElement.style.display = "block";
  refreshBtn.classList.add("show");
  urlWrapper.classList.add("has-refresh");
  container.classList.add("has-refresh-btn");
}

function hideError() {
  const errorElement = document.getElementById("error-message");
  const refreshBtn = document.getElementById("refresh-btn");
  const urlWrapper = document.querySelector(".url-input-wrapper");
  const container = document.querySelector(".container");

  errorElement.style.display = "none";
  refreshBtn.classList.remove("show");
  urlWrapper.classList.remove("has-refresh");
  container.classList.remove("has-refresh-btn");
}

function enableUrlInput() {
  const urlElement = document.getElementById("url");
  const urlInput = document.getElementById("url-input");
  const refreshBtn = document.getElementById("refresh-btn");

  // 현재 URL을 입력 필드에 설정 (브라우저 내부 페이지가 아닌 경우에만)
  let currentUrl = urlElement.textContent;

  // 브라우저 내부 페이지가 아니고 정상 URL인 경우에만 현재 URL 설정
  if (
    currentUrl &&
    !currentUrl.startsWith("⚠️") &&
    !currentUrl.startsWith("Loading") &&
    currentUrl.trim() !== ""
  ) {
    // 정상 URL인 경우 현재 URL을 입력 필드에 설정
    if (
      !currentUrl.startsWith("chrome://") &&
      !currentUrl.startsWith("chrome-extension://") &&
      !currentUrl.startsWith("edge://") &&
      !currentUrl.startsWith("about:")
    ) {
      urlInput.value = currentUrl;
    } else {
      // 브라우저 내부 페이지인 경우 기본값 설정
      urlInput.value = "https://";
    }
  } else {
    // 기타 경우 기본값 설정
    urlInput.value = "https://";
  }

  // 요소 전환
  urlElement.style.display = "none";
  urlInput.style.display = "block";
  refreshBtn.classList.add("show");

  const urlWrapper = document.querySelector(".url-input-wrapper");
  const container = document.querySelector(".container");
  urlWrapper.classList.add("has-refresh");
  container.classList.add("has-refresh-btn");

  // 포커스 및 커서 위치 설정
  setTimeout(() => {
    urlInput.focus();
    if (urlInput.value === "https://") {
      urlInput.setSelectionRange(8, 8); // https:// 뒤에 커서 위치
    } else {
      urlInput.select(); // 전체 선택
    }
  }, 50);
}

function disableUrlInput() {
  const urlElement = document.getElementById("url");
  const urlInput = document.getElementById("url-input");
  const refreshBtn = document.getElementById("refresh-btn");

  urlElement.style.display = "block";
  urlInput.style.display = "none";

  // 에러가 없는 경우에만 Refresh 버튼 숨기기
  const errorElement = document.getElementById("error-message");
  const urlWrapper = document.querySelector(".url-input-wrapper");

  if (errorElement.style.display === "none") {
    refreshBtn.classList.remove("show");
    urlWrapper.classList.remove("has-refresh");
    const container = document.querySelector(".container");
    container.classList.remove("has-refresh-btn");
  }
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
