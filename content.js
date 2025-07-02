// DOM 트리 시각화 기능
let isVisualizationActive = false;
let visualizationColors = [
  "#99D9EA",
  "#FFAEC9",
  "#B8E6B8",
  "#FFD93D",
  "#DDA0DD",
  "#F0E68C",
  "#FFA07A",
  "#98FB98",
];
let colorIndex = 0;
let processedNodes = new Set();

// GIF 캡처 관련 변수
let isCapturing = false;
let captureFrames = [];
let captureInterval = null;
let captureCanvas = null;
let captureContext = null;

// 확장 프로그램으로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startDOMTreeVisualization") {
    startDOMTreeVisualization();
    sendResponse({ success: true });
  } else if (request.action === "enableGifCapture") {
    enableGifCaptureButton();
    sendResponse({ success: true });
  }
});

function startDOMTreeVisualization() {
  if (isVisualizationActive) return;

  isVisualizationActive = true;

  // 기존 시각화 제거
  removeExistingVisualization();

  // DOM 트리 시각화 컨테이너 생성
  createDOMTreeVisualization();
}

function createDOMTreeVisualization() {
  // 다크모드 상태 관리
  let isDarkMode = false;

  // 시각화 컨테이너 생성
  const treeContainer = document.createElement("div");
  treeContainer.id = "dom-tree-visualization";
  treeContainer.classList.add("visualization-window");

  // 미리보기 창 생성
  const previewContainer = document.createElement("div");
  previewContainer.id = "dom-preview-visualization";
  previewContainer.classList.add("visualization-window");

  // 초기 스타일 적용
  applyTheme(treeContainer, previewContainer, isDarkMode);

  // 제목 추가 (드래그 핸들 역할)
  const title = document.createElement("div");
  title.textContent = "DOM Tree Structure";
  title.classList.add("drag-handle", "window-title");
  treeContainer.appendChild(title);

  // 다크모드 토글 버튼 (Tree Window)
  const themeToggle = document.createElement("button");
  themeToggle.textContent = "🌙";
  themeToggle.classList.add("theme-toggle");
  themeToggle.onclick = () => {
    isDarkMode = !isDarkMode;
    themeToggle.textContent = isDarkMode ? "☀️" : "🌙";
    applyTheme(treeContainer, previewContainer, isDarkMode);
  };
  treeContainer.appendChild(themeToggle);

  // 미리보기 제목 추가 (드래그 핸들 역할)
  const previewTitle = document.createElement("div");
  previewTitle.textContent = "Layout & Paint Preview";
  previewTitle.classList.add("drag-handle", "window-title");
  previewContainer.appendChild(previewTitle);

  // GIF 캡처 버튼 추가 (초기에는 비활성화)
  const gifCaptureBtn = document.createElement("button");
  gifCaptureBtn.textContent = "📹";
  gifCaptureBtn.title = "Wait for preview to complete...";
  gifCaptureBtn.classList.add("gif-capture-btn");
  gifCaptureBtn.disabled = true;
  gifCaptureBtn.style.opacity = "0.5";
  gifCaptureBtn.onclick = () => {
    if (gifCaptureBtn.disabled) return;
    if (gifCaptureBtn.textContent === "📹") {
      startGifCapture(previewContent, gifCaptureBtn);
    } else {
      stopGifCapture(gifCaptureBtn);
    }
  };
  previewContainer.appendChild(gifCaptureBtn);

  // 미리보기 내용 컨테이너
  const previewContent = document.createElement("div");
  previewContent.id = "preview-content";
  previewContent.style.cssText = `
    width: 100%;
    height: calc(100% - 40px);
    position: relative;
    overflow: hidden;
    background: #f9f9f9;
    border: 1px solid #ddd;
  `;
  previewContainer.appendChild(previewContent);

  // 리사이즈 핸들 추가
  const resizeHandle = document.createElement("div");
  resizeHandle.classList.add("resize-handle");
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, transparent 0%, transparent 30%, #999 30%, #999 40%, transparent 40%, transparent 60%, #999 60%, #999 70%, transparent 70%);
    cursor: nw-resize;
    z-index: 1001;
    border-bottom-right-radius: 10px;
  `;
  previewContainer.appendChild(resizeHandle);

  // 트리 내용 컨테이너
  const treeContent = document.createElement("div");
  treeContent.id = "tree-content";
  treeContainer.appendChild(treeContent);

  // 닫기 버튼 (트리 컨테이너용)
  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 15px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 25px;
    height: 25px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  `;
  closeButton.onclick = () => {
    treeContainer.remove();
    previewContainer.remove();
    isVisualizationActive = false;
  };
  treeContainer.appendChild(closeButton);

  // 닫기 버튼 (미리보기 컨테이너용)
  const previewCloseButton = document.createElement("button");
  previewCloseButton.textContent = "×";
  previewCloseButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 15px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  `;
  previewCloseButton.onclick = () => {
    treeContainer.remove();
    previewContainer.remove();
    isVisualizationActive = false;
  };
  previewContainer.appendChild(previewCloseButton);

  document.body.appendChild(treeContainer);
  document.body.appendChild(previewContainer);

  // 드래그 기능 추가
  makeDraggable(treeContainer, title);
  makeDraggable(previewContainer, previewTitle);

  // 리사이즈 기능 추가
  makeResizable(previewContainer, resizeHandle);

  // DOM 트리 구조 분석 및 표시
  setTimeout(() => {
    buildDOMTree(
      document.documentElement,
      treeContent,
      previewContent,
      0,
      isDarkMode
    );

    // 완료 후 메시지 전송
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "visualizationComplete" });

      // Preview 완료 후 추가 시간 대기 후 완료 알림
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "previewComplete" });
      }, 2000);
    }, 8000); // 더 긴 시간으로 조정
  }, 500);
}

function buildDOMTree(element, container, previewContainer, depth, isDarkMode) {
  if (!element || depth > 8) return; // 깊이 제한

  // 시각화 창들과 그 자식 요소들은 제외
  if (shouldSkipElement(element)) return;

  const nodeDiv = document.createElement("div");
  const indent = "  ".repeat(depth);
  const tagName = element.tagName
    ? element.tagName.toLowerCase()
    : element.nodeName;

  // 노드 정보 생성 - 태그 이름만 표시 (waterfall 스타일)
  let nodeText = `${indent}${depth > 0 ? "├─ " : ""}${tagName}`;

  // 스타일 적용
  nodeDiv.innerHTML = nodeText;
  nodeDiv.classList.add("tree-node");
  nodeDiv.dataset.elementId = getElementUniqueId(element); // 고유 ID 저장
  nodeDiv.style.cssText = `
    margin: 4px 0;
    padding: 8px 12px;
    border-left: 3px solid ${getDepthColor(depth)};
    background: rgba(${getDepthRGB(depth)}, 0.08);
    border-radius: 8px;
    transition: all 0.3s ease;
    cursor: pointer;
    white-space: pre-wrap;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.4;
    color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
    border: 1px solid rgba(${getDepthRGB(depth)}, 0.2);
  `;

  // 호버 효과
  nodeDiv.onmouseenter = () => {
    nodeDiv.style.background = `rgba(${getDepthRGB(depth)}, 0.15)`;
    nodeDiv.style.transform = "translateX(4px)";
    nodeDiv.style.boxShadow = `0 2px 8px rgba(${getDepthRGB(depth)}, 0.3)`;
    // 실제 DOM 요소에 파란색 dashed border 추가
    highlightElement(element, true);
  };

  nodeDiv.onmouseleave = () => {
    // 선택된 상태가 아닐 때만 스타일 제거
    if (!nodeDiv.classList.contains("selected")) {
      nodeDiv.style.background = `rgba(${getDepthRGB(depth)}, 0.08)`;
      nodeDiv.style.transform = "translateX(0)";
      nodeDiv.style.boxShadow = "none";
      // 하이라이트 제거
      removeHighlight(element);
    }
  };

  // 클릭 효과
  nodeDiv.onclick = () => {
    // 기존 선택된 노드 스타일 제거
    const prevSelected = container.querySelector(".tree-node.selected");
    if (prevSelected) {
      prevSelected.classList.remove("selected");
      prevSelected.style.background = `rgba(${getDepthRGB(
        parseInt(prevSelected.dataset.depth) || 0
      )}, 0.08)`;
    }

    // 현재 노드 선택 스타일 적용
    nodeDiv.classList.add("selected");
    nodeDiv.dataset.depth = depth;
    nodeDiv.style.background = "#007aff20";

    // Preview에서도 해당 box 선택 상태로 만들기
    const previewBox = previewContainer.querySelector(
      `[data-element-id="${getElementUniqueId(element)}"]`
    );

    if (previewBox) {
      // 기존 선택된 Preview box 스타일 제거
      const prevSelectedPreview = previewContainer.querySelector(
        ".preview-box.selected"
      );
      if (prevSelectedPreview) {
        prevSelectedPreview.classList.remove("selected");
        prevSelectedPreview.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        prevSelectedPreview.style.transform = "scale(1)";
        prevSelectedPreview.style.zIndex = "";
      }

      // 현재 Preview box 선택 스타일 적용
      previewBox.classList.add("selected");
      previewBox.style.boxShadow = "0 0 12px rgba(0, 122, 255, 0.8)";
      previewBox.style.transform = "scale(1.15)";
      previewBox.style.zIndex = "1000";
    }

    // 실제 DOM 요소에 파란색 shadow 추가
    removeAllHighlights();
    highlightElement(element, true);

    // 실제 웹사이트에서 해당 요소로 스크롤
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  };

  container.appendChild(nodeDiv);

  // 렌더링 과정 시뮬레이션
  const renderDelay = depth * 200 + Math.random() * 150;

  setTimeout(() => {
    // 1. 트리 노드 애니메이션
    nodeDiv.style.opacity = "0";
    nodeDiv.style.transform = "translateX(-20px)";
    setTimeout(() => {
      nodeDiv.style.opacity = "1";
      nodeDiv.style.transform = "translateX(0)";
    }, 50);

    // 2. DOM 생성 단계 - 미리보기에 기본 박스 생성
    if (shouldShowInPreview(element)) {
      setTimeout(() => {
        createDOMPhase(element, previewContainer, depth);
      }, 300);

      // 3. Layout 계산 단계
      setTimeout(() => {
        layoutPhase(element, previewContainer, depth);
      }, 800);

      // 4. Composite 단계 (페인팅)
      setTimeout(() => {
        compositePhase(element, previewContainer, depth);
      }, 1300);
    }
  }, renderDelay);

  // 자식 요소들 처리 (시각화 창 요소들은 제외)
  const children = Array.from(element.children || []).filter(
    (child) => !shouldSkipElement(child)
  );
  children.forEach((child, index) => {
    setTimeout(() => {
      buildDOMTree(child, container, previewContainer, depth + 1, isDarkMode);
    }, renderDelay + index * 150);
  });
}

function shouldSkipElement(element) {
  if (!element || !element.tagName) return true;

  // 시각화 창들은 DOM 트리에서 제외
  if (
    element.id === "dom-tree-visualization" ||
    element.id === "dom-preview-visualization"
  ) {
    return true;
  }

  // 시각화 창의 자식 요소들도 제외
  let parent = element.parentElement;
  while (parent) {
    if (
      parent.id === "dom-tree-visualization" ||
      parent.id === "dom-preview-visualization"
    ) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

function shouldShowInPreview(element) {
  if (!element.tagName) return false;

  const tagName = element.tagName.toLowerCase();
  const skipTags = ["script", "style", "meta", "link", "title", "head"];

  // 시각화 창들 관련 요소들은 미리보기에서 제외
  if (shouldSkipElement(element)) {
    return false;
  }

  return !skipTags.includes(tagName);
}

function getElementSize(element, tagName) {
  const rect = element.getBoundingClientRect();
  const scale = 0.3; // 미리보기 창 크기에 맞게 축소

  let width = Math.max(20, Math.min(rect.width * scale, 100));
  let height = Math.max(15, Math.min(rect.height * scale, 80));

  // 특정 요소들의 기본 크기 설정
  switch (tagName) {
    case "img":
      width = Math.max(width, 40);
      height = Math.max(height, 30);
      break;
    case "button":
      width = Math.max(width, 50);
      height = Math.max(height, 25);
      break;
    case "input":
      width = Math.max(width, 60);
      height = Math.max(height, 20);
      break;
    case "div":
    case "section":
    case "article":
      if (width < 30) width = 80;
      if (height < 20) height = 40;
      break;
  }

  return {
    width: width + "px",
    height: height + "px",
  };
}

function getElementLabel(element, tagName) {
  if (element.id) return `#${element.id.substring(0, 8)}`;
  if (element.className)
    return `.${element.className.split(" ")[0].substring(0, 8)}`;
  return tagName.toUpperCase();
}

function layoutPreviewBox(box, element, depth) {
  // 레이아웃 단계 - 위치 계산
  const containerRect = document
    .getElementById("preview-content")
    .getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const scale = 0.3;

  let x = Math.max(5, Math.min(rect.left * scale, 250));
  let y = Math.max(5, Math.min(rect.top * scale, 350));

  // 겹치지 않도록 조정
  if (depth > 2) {
    x += (depth - 2) * 15;
    y += (depth - 2) * 10;
  }

  box.style.left = x + "px";
  box.style.top = y + "px";
  box.style.opacity = "0.7";
  box.style.transform = "scale(1)";
  box.style.backgroundColor = "#f0f0f0";
}

function paintPreviewBox(box, element) {
  // 페인트 단계 - 실제 스타일 적용
  const computedStyle = window.getComputedStyle(element);
  const tagName = element.tagName.toLowerCase();

  // 페인트 애니메이션
  box.style.transition = "all 0.8s ease";

  setTimeout(() => {
    // 배경색 적용
    const bgColor = computedStyle.backgroundColor;
    if (
      bgColor &&
      bgColor !== "rgba(0, 0, 0, 0)" &&
      bgColor !== "transparent"
    ) {
      box.style.backgroundColor = bgColor;
    } else {
      // 요소 타입별 기본 색상
      switch (tagName) {
        case "img":
          box.style.backgroundColor = "#e3f2fd";
          break;
        case "button":
          box.style.backgroundColor = "#f5f5f5";
          break;
        case "input":
          box.style.backgroundColor = "#fff";
          break;
        case "header":
          box.style.backgroundColor = "#fff3e0";
          break;
        case "nav":
          box.style.backgroundColor = "#e8f5e8";
          break;
        case "footer":
          box.style.backgroundColor = "#fce4ec";
          break;
        default:
          box.style.backgroundColor = "white";
      }
    }

    box.style.opacity = "1";
    box.style.borderColor = computedStyle.borderColor || "black";

    // 최종 페인트 효과
    box.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
  }, 300);
}

function getDepthColor(depth) {
  const colors = [
    "#4CAF50",
    "#2196F3",
    "#FF9800",
    "#E91E63",
    "#9C27B0",
    "#00BCD4",
    "#CDDC39",
    "#FF5722",
  ];
  return colors[depth % colors.length];
}

function getDepthRGB(depth) {
  const rgbColors = [
    "76, 175, 80",
    "33, 150, 243",
    "255, 152, 0",
    "233, 30, 99",
    "156, 39, 176",
    "0, 188, 212",
    "205, 220, 57",
    "255, 87, 34",
  ];
  return rgbColors[depth % rgbColors.length];
}

function getCSSLayoutInfo(element) {
  if (!element.tagName) return null;

  const computedStyle = window.getComputedStyle(element);
  const layoutInfo = [];

  // Display 속성
  const display = computedStyle.display;
  if (display && display !== "block" && display !== "inline") {
    layoutInfo.push(`display: ${display}`);
  }

  // Position 속성
  const position = computedStyle.position;
  if (position && position !== "static") {
    layoutInfo.push(`position: ${position}`);
  }

  // Flexbox 속성
  if (display === "flex" || display === "inline-flex") {
    const flexDirection = computedStyle.flexDirection;
    const justifyContent = computedStyle.justifyContent;
    const alignItems = computedStyle.alignItems;

    if (flexDirection !== "row")
      layoutInfo.push(`flex-direction: ${flexDirection}`);
    if (justifyContent !== "flex-start")
      layoutInfo.push(`justify-content: ${justifyContent}`);
    if (alignItems !== "stretch") layoutInfo.push(`align-items: ${alignItems}`);
  }

  // Grid 속성
  if (display === "grid" || display === "inline-grid") {
    const gridTemplateColumns = computedStyle.gridTemplateColumns;
    const gridTemplateRows = computedStyle.gridTemplateRows;

    if (gridTemplateColumns !== "none")
      layoutInfo.push(
        `grid-columns: ${gridTemplateColumns.substring(0, 20)}...`
      );
    if (gridTemplateRows !== "none")
      layoutInfo.push(`grid-rows: ${gridTemplateRows.substring(0, 20)}...`);
  }

  // Float 속성
  const float = computedStyle.float;
  if (float && float !== "none") {
    layoutInfo.push(`float: ${float}`);
  }

  // 크기 정보
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    layoutInfo.push(
      `size: ${Math.round(rect.width)}×${Math.round(rect.height)}`
    );
  }

  return layoutInfo.length > 0 ? layoutInfo.join(" | ") : null;
}

function makeDraggable(element, handle) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  // 현재 위치를 초기 오프셋으로 설정
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  // 현재 화면상의 위치를 기준으로 설정
  xOffset = rect.left;
  yOffset = rect.top;

  function dragStart(e) {
    // 드래그 핸들을 클릭했는지 확인
    if (e.target === handle || handle.contains(e.target)) {
      isDragging = true;
      element.style.transition = "none";

      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }

      e.preventDefault(); // 텍스트 선택 방지
    }
  }

  function dragEnd(e) {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      element.style.transition = "all 0.3s ease";
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      if (e.type === "touchmove") {
        currentX = e.touches[0].clientX - initialX;
        currentY = e.touches[0].clientY - initialY;
      } else {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
      }

      xOffset = currentX;
      yOffset = currentY;

      // 화면 경계 체크
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const elementWidth = element.offsetWidth;
      const elementHeight = element.offsetHeight;

      // 최소/최대 위치 제한
      const minX = -elementWidth + 100; // 100px 정도는 보이도록
      const maxX = windowWidth - 100;
      const minY = 0;
      const maxY = windowHeight - 50; // 제목 부분은 보이도록

      xOffset = Math.max(minX, Math.min(maxX, xOffset));
      yOffset = Math.max(minY, Math.min(maxY, yOffset));

      // 위치 적용
      element.style.left = xOffset + "px";
      element.style.top = yOffset + "px";
      element.style.right = "auto"; // right 속성 제거하여 left 우선하도록
    }
  }

  // 이벤트 리스너 추가
  handle.addEventListener("mousedown", dragStart, false);
  document.addEventListener("mouseup", dragEnd, false);
  document.addEventListener("mousemove", drag, false);

  // 터치 이벤트 지원
  handle.addEventListener("touchstart", dragStart, false);
  document.addEventListener("touchend", dragEnd, false);
  document.addEventListener("touchmove", drag, false);
}

function makeResizable(element, resizeHandle) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  function resizeStart(e) {
    isResizing = true;

    if (e.type === "touchstart") {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }

    const rect = element.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;

    element.style.transition = "none";
    e.preventDefault();
  }

  function resizeEnd(e) {
    if (isResizing) {
      isResizing = false;
      element.style.transition = "all 0.3s ease";
    }
  }

  function resize(e) {
    if (!isResizing) return;

    e.preventDefault();

    let currentX, currentY;
    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else {
      currentX = e.clientX;
      currentY = e.clientY;
    }

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // 최소/최대 크기 제한
    const minWidth = 250;
    const maxWidth = Math.min(800, window.innerWidth - 100);
    const minHeight = 200;
    const maxHeight = Math.min(700, window.innerHeight - 100);

    const newWidth = Math.max(
      minWidth,
      Math.min(maxWidth, startWidth + deltaX)
    );
    const newHeight = Math.max(
      minHeight,
      Math.min(maxHeight, startHeight + deltaY)
    );

    element.style.width = newWidth + "px";
    element.style.height = newHeight + "px";

    // 내용 컨테이너 높이도 조정
    const previewContent = element.querySelector("#preview-content");
    if (previewContent) {
      previewContent.style.height = `calc(100% - 40px)`;
    }
  }

  // 이벤트 리스너 추가
  resizeHandle.addEventListener("mousedown", resizeStart, false);
  document.addEventListener("mouseup", resizeEnd, false);
  document.addEventListener("mousemove", resize, false);

  // 터치 이벤트 지원
  resizeHandle.addEventListener("touchstart", resizeStart, false);
  document.addEventListener("touchend", resizeEnd, false);
  document.addEventListener("touchmove", resize, false);
}

// 새로운 렌더링 단계 함수들
function createDOMPhase(element, previewContainer, depth) {
  const box = document.createElement("div");
  const tagName = element.tagName
    ? element.tagName.toLowerCase()
    : element.nodeName;

  // DOM 노드 ID 설정
  box.setAttribute("data-element-id", getElementId(element));
  box.classList.add("preview-box", "dom-phase");

  // 기본 DOM 박스 스타일 (위치 없음)
  box.style.cssText = `
    position: absolute;
    border: 2px dashed #999;
    background-color: #f9f9f9;
    min-width: 30px;
    min-height: 20px;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.5s ease;
    left: 50%;
    top: 50%;
    transform-origin: center;
  `;

  // 라벨 추가
  const label = document.createElement("span");
  label.textContent = getElementLabel(element, tagName);
  label.style.cssText = `
    font-size: 6px;
    color: #666;
    text-align: center;
  `;
  box.appendChild(label);

  previewContainer.appendChild(box);

  // DOM 생성 애니메이션
  setTimeout(() => {
    box.style.opacity = "0.6";
    box.style.transform = "scale(0.8)";
  }, 100);
}

function layoutPhase(element, previewContainer, depth) {
  const box = previewContainer.querySelector(
    `[data-element-id="${getElementId(element)}"]`
  );
  if (!box) return;

  box.classList.remove("dom-phase");
  box.classList.add("layout-phase");

  // Layout 계산 - 실제 위치와 크기 설정
  const rect = element.getBoundingClientRect();
  const scale = 0.3;

  let x = Math.max(5, Math.min(rect.left * scale, 250));
  let y = Math.max(5, Math.min(rect.top * scale, 350));

  // 겹치지 않도록 조정
  if (depth > 2) {
    x += (depth - 2) * 10;
    y += (depth - 2) * 8;
  }

  const sizes = getElementSize(
    element,
    element.tagName ? element.tagName.toLowerCase() : element.nodeName
  );

  // Layout 단계 스타일
  box.style.cssText += `
    left: ${x}px;
    top: ${y}px;
    width: ${sizes.width};
    height: ${sizes.height};
    border: 2px solid #ff9800;
    background-color: #fff3e0;
    opacity: 0.8;
    transform: scale(1);
  `;
}

function compositePhase(element, previewContainer, depth) {
  const box = previewContainer.querySelector(
    `[data-element-id="${getElementId(element)}"]`
  );
  if (!box) return;

  box.classList.remove("layout-phase");
  box.classList.add("composite-phase");

  // 최종 페인팅 - 실제 스타일 적용
  const computedStyle = window.getComputedStyle(element);
  const tagName = element.tagName
    ? element.tagName.toLowerCase()
    : element.nodeName;

  // 배경색 적용
  let backgroundColor = computedStyle.backgroundColor;
  if (
    !backgroundColor ||
    backgroundColor === "rgba(0, 0, 0, 0)" ||
    backgroundColor === "transparent"
  ) {
    // 요소 타입별 기본 색상
    switch (tagName) {
      case "img":
        backgroundColor = "#e3f2fd";
        break;
      case "button":
        backgroundColor = "#f5f5f5";
        break;
      case "input":
        backgroundColor = "#fff";
        break;
      case "header":
        backgroundColor = "#fff3e0";
        break;
      case "nav":
        backgroundColor = "#e8f5e8";
        break;
      case "footer":
        backgroundColor = "#fce4ec";
        break;
      default:
        backgroundColor = "white";
    }
  }

  // Composite 단계 스타일
  box.style.cssText += `
    border: 1px solid ${computedStyle.borderColor || "#333"};
    background-color: ${backgroundColor};
    opacity: 1;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    cursor: pointer;
  `;

  // 고유 ID 저장
  box.dataset.elementId = getElementUniqueId(element);

  // Preview box 이벤트 핸들러 추가
  box.onmouseenter = () => {
    // 클릭된 상태가 아닐 때만 hover 효과 적용
    if (!box.classList.contains("selected")) {
      box.style.boxShadow = "0 0 8px rgba(0, 122, 255, 0.6)";
      box.style.transform = "scale(1.1)";
      box.style.zIndex = "1000";

      // 실제 DOM 요소에 파란색 dashed border 추가 (hover용)
      highlightElement(element, true);

      // DOM Structure에서 해당 노드 하이라이트
      highlightCorrespondingTreeNode(element);
    }
  };

  box.onmouseleave = () => {
    // 클릭된 상태가 아닐 때만 hover 효과 제거
    if (!box.classList.contains("selected")) {
      box.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
      box.style.transform = "scale(1)";
      box.style.zIndex = "";

      // 하이라이트 제거 (hover용)
      removeHighlight(element);
      removeTreeNodeHighlight();
    }
  };

  // Preview box 클릭 효과
  box.onclick = () => {
    // 기존 선택된 Preview box 스타일 제거
    const prevSelectedPreview = previewContainer.querySelector(
      ".preview-box.selected"
    );
    if (prevSelectedPreview) {
      prevSelectedPreview.classList.remove("selected");
      prevSelectedPreview.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
      prevSelectedPreview.style.transform = "scale(1)";
      prevSelectedPreview.style.zIndex = "";
    }

    // 현재 Preview box 선택 스타일 적용
    box.classList.add("selected");
    box.style.boxShadow = "0 0 12px rgba(0, 122, 255, 0.8)";
    box.style.transform = "scale(1.15)";
    box.style.zIndex = "1000";

    // 모든 기존 하이라이트 제거 후 새로운 하이라이트 적용
    removeAllHighlights();
    highlightElement(element, true);

    // 실제 웹사이트에서 해당 요소로 스크롤
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // DOM Structure에서 해당 노드로 스크롤하고 선택
    scrollToAndSelectTreeNode(element);
  };
}

function getElementId(element) {
  return (
    element.id ||
    element.tagName +
      "_" +
      Array.from(element.parentNode?.children || []).indexOf(element)
  );
}

function applyTheme(treeContainer, previewContainer, isDarkMode) {
  const treeTheme = isDarkMode
    ? {
        background: "rgba(28, 28, 30, 0.95)",
        color: "#f2f2f7",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        titleColor: "#f2f2f7",
        titleBorder: "1px solid rgba(255, 255, 255, 0.1)",
        shadow:
          "0 20px 40px rgba(0, 0, 0, 0.6), 0 10px 20px rgba(0, 0, 0, 0.4)",
      }
    : {
        background: "rgba(255, 255, 255, 0.95)",
        color: "#1d1d1f",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        titleColor: "#1d1d1f",
        titleBorder: "1px solid rgba(0, 0, 0, 0.1)",
        shadow:
          "0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)",
      };

  const previewTheme = isDarkMode
    ? {
        background: "rgba(28, 28, 30, 0.95)",
        color: "#f2f2f7",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        titleColor: "#f2f2f7",
        titleBorder: "1px solid rgba(255, 255, 255, 0.1)",
        contentBg: "#2c2c2e",
        shadow:
          "0 20px 40px rgba(0, 0, 0, 0.6), 0 10px 20px rgba(0, 0, 0, 0.4)",
      }
    : {
        background: "rgba(255, 255, 255, 0.95)",
        color: "#1d1d1f",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        titleColor: "#1d1d1f",
        titleBorder: "1px solid rgba(0, 0, 0, 0.1)",
        contentBg: "#f9f9f9",
        shadow:
          "0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)",
      };

  // Tree Container 스타일 (Apple System UI)
  treeContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 420px;
    max-height: 80vh;
    background: ${treeTheme.background};
    backdrop-filter: blur(20px);
    color: ${treeTheme.color};
    border: ${treeTheme.border};
    border-radius: 20px;
    padding: 25px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-y: auto;
    z-index: 10000;
    box-shadow: ${treeTheme.shadow};
    transition: all 0.3s ease;
  `;

  // Preview Container 스타일 (Apple System UI)
  previewContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 460px;
    width: 380px;
    height: 520px;
    background: ${previewTheme.background};
    backdrop-filter: blur(20px);
    color: ${previewTheme.color};
    border: ${previewTheme.border};
    border-radius: 20px;
    padding: 20px;
    z-index: 9999;
    box-shadow: ${previewTheme.shadow};
    overflow: hidden;
    transition: all 0.3s ease;
  `;

  // 제목 스타일 업데이트 (Apple System UI)
  const treeTitle = treeContainer.querySelector(".window-title");
  const previewTitle = previewContainer.querySelector(".window-title");

  if (treeTitle) {
    treeTitle.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: ${treeTheme.titleColor};
      text-align: center;
      border-bottom: ${treeTheme.titleBorder};
      padding-bottom: 12px;
      cursor: move;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: -0.01em;
    `;
  }

  if (previewTitle) {
    previewTitle.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: ${previewTheme.titleColor};
      text-align: center;
      border-bottom: ${previewTheme.titleBorder};
      padding-bottom: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: move;
      user-select: none;
      letter-spacing: -0.01em;
    `;
  }

  // 미리보기 내용 컨테이너 스타일 업데이트
  const previewContent = previewContainer.querySelector("#preview-content");
  if (previewContent) {
    previewContent.style.cssText = `
      width: 100%;
      height: calc(100% - 50px);
      position: relative;
      overflow: hidden;
      background: ${previewTheme.contentBg};
      border: 1px solid ${
        isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      };
      border-radius: 12px;
      transition: all 0.2s ease;
    `;
  }

  // 테마 토글 버튼 스타일 (Apple System UI)
  const themeToggle = treeContainer.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.style.cssText = `
      position: absolute;
      top: 18px;
      left: 18px;
      background: ${
        isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"
      };
      backdrop-filter: blur(10px);
      border: 1px solid ${
        isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)"
      };
      border-radius: 50%;
      width: 32px;
      height: 32px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
    `;
  }

  // 리사이즈 핸들 스타일 업데이트 (Apple System UI)
  const resizeHandle = previewContainer.querySelector(".resize-handle");
  if (resizeHandle) {
    const handleColor = isDarkMode
      ? "rgba(255, 255, 255, 0.3)"
      : "rgba(0, 0, 0, 0.3)";
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 5px;
      right: 5px;
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, transparent 0%, transparent 30%, ${handleColor} 30%, ${handleColor} 40%, transparent 40%, transparent 60%, ${handleColor} 60%, ${handleColor} 70%, transparent 70%);
      cursor: nw-resize;
      z-index: 1001;
      border-bottom-right-radius: 15px;
      transition: all 0.2s ease;
    `;
  }

  // GIF 캡처 버튼 스타일 업데이트 (Apple System UI)
  const gifCaptureBtn = previewContainer.querySelector(".gif-capture-btn");
  if (gifCaptureBtn) {
    const isDisabled = gifCaptureBtn.disabled;
    gifCaptureBtn.style.cssText = `
      position: absolute;
      top: 18px;
      right: 55px;
      background: ${
        isDisabled
          ? isDarkMode
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.03)"
          : isDarkMode
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.05)"
      };
      backdrop-filter: blur(10px);
      border: 1px solid ${
        isDisabled
          ? isDarkMode
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.05)"
          : isDarkMode
          ? "rgba(255, 255, 255, 0.2)"
          : "rgba(0, 0, 0, 0.1)"
      };
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: ${isDisabled ? "not-allowed" : "pointer"};
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      color: ${
        isDisabled
          ? isDarkMode
            ? "#86868b"
            : "#c7c7cc"
          : isDarkMode
          ? "#f2f2f7"
          : "#1d1d1f"
      };
      opacity: ${isDisabled ? "0.5" : "1"};
    `;
  }

  // 닫기 버튼들 스타일 업데이트 (Apple System UI)
  const closeButtons = document.querySelectorAll(
    '[style*="background: #ff4444"], [style*="background:#ff4444"]'
  );
  closeButtons.forEach((closeBtn) => {
    if (
      closeBtn &&
      (closeBtn.closest("#dom-tree-visualization") ||
        closeBtn.closest("#dom-preview-visualization"))
    ) {
      closeBtn.style.cssText = `
        position: absolute;
        top: 18px;
        right: 18px;
        background: #ff3b30;
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
      `;
    }
  });

  // Tree 노드 스타일 업데이트
  const treeNodes = treeContainer.querySelectorAll(".tree-node");
  treeNodes.forEach((node) => {
    if (node.style.fontFamily && node.style.fontFamily.includes("Courier")) {
      node.style.fontFamily =
        "-apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";
      node.style.fontSize = "13px";
      node.style.color = isDarkMode ? "#f2f2f7" : "#1d1d1f";
    }
  });
}

// GIF 캡처 기능
function startGifCapture(previewContent, button) {
  isCapturing = true;
  captureFrames = [];
  button.textContent = "⏹️";
  button.title = "Stop Capture";

  // 캡처용 캔버스 생성
  const rect = previewContent.getBoundingClientRect();
  captureCanvas = document.createElement("canvas");
  captureCanvas.width = rect.width;
  captureCanvas.height = rect.height;
  captureContext = captureCanvas.getContext("2d");

  // 200ms마다 프레임 캡처 (5fps)
  captureInterval = setInterval(() => {
    captureFrame(previewContent);
  }, 200);

  console.log("GIF 캡처 시작됨");
}

function stopGifCapture(button) {
  if (!isCapturing) return;

  isCapturing = false;
  button.textContent = "📹";
  button.title = "Capture as GIF";

  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  if (captureFrames.length > 0) {
    generateGif();
  }

  console.log(`GIF 캡처 완료. 총 ${captureFrames.length} 프레임`);
}

function captureFrame(previewContent) {
  if (!isCapturing || !captureCanvas || !captureContext) return;

  // HTML을 SVG로 변환하여 캔버스에 그리기
  const rect = previewContent.getBoundingClientRect();
  const html = previewContent.innerHTML;
  const computedStyles = window.getComputedStyle(previewContent);

  // SVG foreignObject를 사용하여 HTML 렌더링
  const svg = `
    <svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: ${computedStyles.backgroundColor};
          position: relative;
          overflow: hidden;
        ">
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;

  const img = new Image();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  img.onload = function () {
    captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
    captureContext.drawImage(img, 0, 0);

    // 캔버스 데이터를 프레임으로 저장
    const imageData = captureContext.getImageData(
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );
    captureFrames.push({
      data: imageData,
      delay: 200, // 200ms 지연
    });

    URL.revokeObjectURL(url);
  };

  img.onerror = function () {
    // SVG 방식이 실패하면 스크린샷 방식 시도
    captureFrameByScreenshot(previewContent);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}

function captureFrameByScreenshot(previewContent) {
  // html2canvas 라이브러리가 없으므로 간단한 대안 구현
  const rect = previewContent.getBoundingClientRect();

  // 현재 보이는 요소들의 정보를 수집
  const elements = previewContent.querySelectorAll(".preview-box");
  const frameData = [];

  elements.forEach((element) => {
    const elementRect = element.getBoundingClientRect();
    const previewRect = previewContent.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    frameData.push({
      x: elementRect.left - previewRect.left,
      y: elementRect.top - previewRect.top,
      width: elementRect.width,
      height: elementRect.height,
      backgroundColor: computedStyle.backgroundColor,
      borderColor: computedStyle.borderColor,
      borderWidth: computedStyle.borderWidth,
      opacity: computedStyle.opacity,
      text: element.textContent,
    });
  });

  captureFrames.push({
    elements: frameData,
    timestamp: Date.now(),
    delay: 200,
  });
}

async function generateGif() {
  if (captureFrames.length === 0) return;

  // GIF.js 라이브러리를 동적으로 로드
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";

  script.onload = function () {
    createGifFromFrames();
  };

  script.onerror = function () {
    // GIF.js 로드 실패 시 대안 방법
    downloadFramesAsImages();
  };

  document.head.appendChild(script);
}

function createGifFromFrames() {
  if (typeof GIF === "undefined") {
    downloadFramesAsImages();
    return;
  }

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: captureCanvas.width,
    height: captureCanvas.height,
  });

  // 각 프레임을 GIF에 추가
  captureFrames.forEach((frame) => {
    if (frame.data) {
      // ImageData를 캔버스로 변환
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = captureCanvas.width;
      tempCanvas.height = captureCanvas.height;
      const tempContext = tempCanvas.getContext("2d");
      tempContext.putImageData(frame.data, 0, 0);

      gif.addFrame(tempCanvas, { delay: frame.delay });
    }
  });

  gif.on("finished", function (blob) {
    downloadGif(blob);
  });

  gif.render();
}

function downloadFramesAsImages() {
  // GIF 생성이 불가능한 경우 개별 이미지로 다운로드
  captureFrames.forEach((frame, index) => {
    if (frame.data) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = captureCanvas.width;
      tempCanvas.height = captureCanvas.height;
      const tempContext = tempCanvas.getContext("2d");
      tempContext.putImageData(frame.data, 0, 0);

      tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dom-render-frame-${index + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  });

  alert(
    `GIF 생성에 실패했습니다. ${captureFrames.length}개의 PNG 이미지로 다운로드됩니다.`
  );
}

function downloadGif(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dom-rendering-process.gif";
  a.click();
  URL.revokeObjectURL(url);

  alert("DOM 렌더링 과정 GIF가 다운로드되었습니다!");
}

function enableGifCaptureButton() {
  const gifCaptureBtn = document.querySelector(".gif-capture-btn");
  if (gifCaptureBtn) {
    gifCaptureBtn.disabled = false;
    gifCaptureBtn.title = "Capture as GIF";

    // 다크모드 상태 확인
    const treeContainer = document.getElementById("dom-tree-visualization");
    const isDarkMode =
      treeContainer && treeContainer.style.background.includes("28, 28, 30");

    // Apple System UI 스타일로 업데이트
    gifCaptureBtn.style.cssText = `
      position: absolute;
      top: 18px;
      right: 55px;
      background: ${
        isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"
      };
      backdrop-filter: blur(10px);
      border: 1px solid ${
        isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)"
      };
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
      opacity: 1;
    `;

    // 호버 효과 추가
    gifCaptureBtn.addEventListener("mouseenter", () => {
      gifCaptureBtn.style.transform = "scale(1.1)";
      gifCaptureBtn.style.background = isDarkMode
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(0, 0, 0, 0.08)";
    });

    gifCaptureBtn.addEventListener("mouseleave", () => {
      gifCaptureBtn.style.transform = "scale(1)";
      gifCaptureBtn.style.background = isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.05)";
    });

    // 활성화 애니메이션
    gifCaptureBtn.style.transform = "scale(1.2)";
    setTimeout(() => {
      gifCaptureBtn.style.transform = "scale(1)";
    }, 300);
  }
}

function removeExistingVisualization() {
  // 캡처 중이면 중단
  if (isCapturing) {
    isCapturing = false;
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
  }

  const existing = document.getElementById("dom-tree-visualization");
  if (existing) {
    existing.remove();
  }

  const existingPreview = document.getElementById("dom-preview-visualization");
  if (existingPreview) {
    existingPreview.remove();
  }
}

function visualizeDOMConstruction() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            !processedNodes.has(node)
          ) {
            highlightElementWithColor(node);
            processedNodes.add(node);
          }
        });
      }
    });
  });

  // 기존 DOM 요소들 시각화
  const allElements = document.querySelectorAll("*");
  allElements.forEach((element, index) => {
    setTimeout(() => {
      if (!processedNodes.has(element)) {
        highlightElementWithColor(element);
        processedNodes.add(element);
      }
    }, index * 50); // 50ms 간격으로 순차적 시각화
  });

  // 새로 추가되는 요소들 관찰
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // DOM 구성 완료 후 페인팅 시각화 시작
  setTimeout(() => {
    observer.disconnect();
    startPaintVisualization();
  }, allElements.length * 50 + 1000);
}

function highlightElementWithColor(element) {
  const color = visualizationColors[colorIndex % visualizationColors.length];
  colorIndex++;

  // 원래 스타일 저장
  const originalStyle = element.style.cssText;
  element.setAttribute("data-original-style", originalStyle);

  // 시각화 스타일 적용
  element.style.backgroundColor = color;
  element.style.border = `2px solid ${color}`;
  element.style.transition = "all 0.3s ease";
  element.style.opacity = "0.8";
}

function startPaintVisualization() {
  const allElements = document.querySelectorAll("*");

  // 페인팅 효과 시뮬레이션
  allElements.forEach((element, index) => {
    setTimeout(() => {
      element.style.animation = "paintEffect 0.5s ease-in-out";
    }, index * 30);
  });

  // 페인팅 완료 후 정리
  setTimeout(() => {
    finishVisualization();
  }, allElements.length * 30 + 1000);
}

function finishVisualization() {
  // 시각화 스타일 제거
  removeVisualizationStyles();

  // 확장 프로그램에 완료 알림
  chrome.runtime.sendMessage({ action: "visualizationComplete" });

  isVisualizationActive = false;
}

function removeVisualizationStyles() {
  const allElements = document.querySelectorAll("*");
  allElements.forEach((element) => {
    const originalStyle = element.getAttribute("data-original-style");
    if (originalStyle !== null) {
      element.style.cssText = originalStyle;
      element.removeAttribute("data-original-style");
    }
    element.style.animation = "";
  });
}

// CSS 애니메이션 추가
const style = document.createElement("style");
style.textContent = `
  @keyframes paintEffect {
    0% { 
      filter: brightness(1.5) saturate(1.5);
      transform: scale(1.02);
    }
    50% { 
      filter: brightness(2) saturate(2);
      transform: scale(1.05);
    }
    100% { 
      filter: brightness(1) saturate(1);
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);

// 요소에 고유 ID 생성/할당
function getElementUniqueId(element) {
  if (!element.dataset.uniqueId) {
    element.dataset.uniqueId =
      "elem_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }
  return element.dataset.uniqueId;
}

// 요소에 파란색 shadow 하이라이트 추가 (기존 스타일 보존)
function highlightElement(element, isDashed = false) {
  if (!element || !element.style) {
    return;
  }

  // 시각화 창 요소들은 하이라이트하지 않음
  if (shouldSkipElement(element)) {
    return;
  }

  // 기존 box-shadow 저장 (있는 경우)
  if (!element.dataset.originalBoxShadow) {
    element.dataset.originalBoxShadow = element.style.boxShadow || "none";
  }

  if (isDashed) {
    // 기존 shadow에 파란색 shadow 추가
    const originalShadow = element.dataset.originalBoxShadow;
    const highlightShadow =
      "0 0 12px rgba(0, 122, 255, 0.6), 0 0 24px rgba(0, 122, 255, 0.3)";

    if (originalShadow && originalShadow !== "none") {
      element.style.boxShadow = `${originalShadow}, ${highlightShadow}`;
    } else {
      element.style.boxShadow = highlightShadow;
    }

    // 약간의 z-index 조정으로 가시성 확보
    if (!element.dataset.originalZIndex) {
      element.dataset.originalZIndex = element.style.zIndex || "auto";
    }
    element.style.zIndex = (parseInt(element.style.zIndex) || 0) + 10;
  } else {
    element.style.outline = "2px solid #007aff";
    element.style.outlineOffset = "2px";
  }
}

// 하이라이트 제거 (원래 스타일 복원)
function removeHighlight(element) {
  if (!element || !element.style) return;

  // 원래 box-shadow 복원
  if (element.dataset.originalBoxShadow) {
    if (element.dataset.originalBoxShadow === "none") {
      element.style.boxShadow = "";
    } else {
      element.style.boxShadow = element.dataset.originalBoxShadow;
    }
    delete element.dataset.originalBoxShadow;
  }

  // 원래 z-index 복원
  if (element.dataset.originalZIndex) {
    if (element.dataset.originalZIndex === "auto") {
      element.style.zIndex = "";
    } else {
      element.style.zIndex = element.dataset.originalZIndex;
    }
    delete element.dataset.originalZIndex;
  }

  // outline 제거
  element.style.outline = "";
  element.style.outlineOffset = "";
}

// 모든 하이라이트 제거 (원래 스타일 복원)
function removeAllHighlights() {
  document.querySelectorAll("*").forEach((el) => {
    if (
      el.style &&
      !el.closest("#dom-tree-visualization") &&
      !el.closest("#dom-preview-visualization")
    ) {
      // 하이라이트된 요소만 처리
      if (
        el.dataset.originalBoxShadow ||
        el.dataset.originalZIndex ||
        (el.style.outline && el.style.outline.includes("#007aff"))
      ) {
        removeHighlight(el);
      }
    }
  });
}

// DOM Structure에서 해당 노드 하이라이트
function highlightCorrespondingTreeNode(element) {
  const elementId = getElementUniqueId(element);
  const treeContainer = document.getElementById("tree-content");
  if (!treeContainer) return;

  const treeNode = treeContainer.querySelector(
    `[data-element-id="${elementId}"]`
  );
  if (treeNode) {
    treeNode.style.background = "#007aff20";
    treeNode.style.transform = "translateX(4px)";
    treeNode.style.boxShadow = "0 2px 8px rgba(0, 122, 255, 0.3)";
  }
}

// DOM Structure에서 노드 하이라이트 제거
function removeTreeNodeHighlight() {
  const treeContainer = document.getElementById("tree-content");
  if (!treeContainer) return;

  const highlightedNodes = treeContainer.querySelectorAll(
    ".tree-node:not(.selected)"
  );
  highlightedNodes.forEach((node) => {
    const depth = parseInt(node.dataset.depth) || 0;
    node.style.background = `rgba(${getDepthRGB(depth)}, 0.08)`;
    node.style.transform = "translateX(0)";
    node.style.boxShadow = "none";
  });
}

// DOM Structure에서 해당 노드로 스크롤하고 선택
function scrollToAndSelectTreeNode(element) {
  const elementId = getElementUniqueId(element);
  const treeContainer = document.getElementById("tree-content");
  const previewContainer = document.getElementById("dom-preview-visualization");

  if (!treeContainer) return;

  const treeNode = treeContainer.querySelector(
    `[data-element-id="${elementId}"]`
  );

  if (treeNode) {
    // 기존 선택된 노드 스타일 제거
    const prevSelected = treeContainer.querySelector(".tree-node.selected");
    if (prevSelected) {
      prevSelected.classList.remove("selected");
      const prevDepth = parseInt(prevSelected.dataset.depth) || 0;
      prevSelected.style.background = `rgba(${getDepthRGB(prevDepth)}, 0.08)`;
    }

    // 현재 노드 선택 스타일 적용
    treeNode.classList.add("selected");
    treeNode.style.background = "#007aff20";

    // 스크롤하여 노드가 보이도록 함
    treeNode.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // 잠시 깜빡이는 효과
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      treeNode.style.background =
        flashCount % 2 === 0 ? "#007aff40" : "#007aff20";
      flashCount++;
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        treeNode.style.background = "#007aff20";
      }
    }, 200);
  }

  // Preview에서도 해당 box 선택 상태로 만들기
  if (previewContainer) {
    const previewBox = previewContainer.querySelector(
      `[data-element-id="${elementId}"]`
    );

    if (previewBox) {
      // 기존 선택된 Preview box 스타일 제거
      const prevSelectedPreview = previewContainer.querySelector(
        ".preview-box.selected"
      );
      if (prevSelectedPreview) {
        prevSelectedPreview.classList.remove("selected");
        prevSelectedPreview.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        prevSelectedPreview.style.transform = "scale(1)";
        prevSelectedPreview.style.zIndex = "";
      }

      // 현재 Preview box 선택 스타일 적용
      previewBox.classList.add("selected");
      previewBox.style.boxShadow = "0 0 12px rgba(0, 122, 255, 0.8)";
      previewBox.style.transform = "scale(1.15)";
      previewBox.style.zIndex = "1000";
    }
  }
}
