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

// 확장 프로그램으로부터 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startDOMTreeVisualization") {
    startDOMTreeVisualization(request.isDarkMode || false);
    sendResponse({ success: true });
  } else if (request.action === "updateTheme") {
    updateVisualizationTheme(request.isDarkMode);
    sendResponse({ success: true });
  }
});

function startDOMTreeVisualization(initialDarkMode = false) {
  if (isVisualizationActive) return;

  isVisualizationActive = true;

  // 기존 시각화 제거
  removeExistingVisualization();

  // DOM 트리 시각화 컨테이너 생성
  createDOMTreeVisualization(initialDarkMode);
}

function createDOMTreeVisualization(initialDarkMode = false) {
  // 다크모드 상태 관리
  let isDarkMode = initialDarkMode;

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

  // 헤더 컨테이너 생성 (상단 고정)
  const headerContainer = document.createElement("div");
  headerContainer.classList.add("window-header");
  headerContainer.style.cssText = `
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: ${
      isDarkMode ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)"
    };
    backdrop-filter: blur(20px);
    border-bottom: 1px solid ${
      isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
    };
    border-radius: 20px 20px 0 0;
    padding: 18px 20px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;

  // 제목 추가 (드래그 핸들 역할)
  const title = document.createElement("div");
  title.textContent = "DOM Tree Structure";
  title.classList.add("drag-handle", "window-title");
  title.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: -0.01em;
    cursor: move;
    user-select: none;
    flex: 1;
    text-align: center;
    margin: 0;
  `;

  // 닫기 버튼 (Apple System UI 스타일)
  const treeCloseButton = document.createElement("button");
  treeCloseButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
  treeCloseButton.style.cssText = `
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #ff5f57;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(255, 95, 87, 0.3);
    margin-left: auto;
  `;

  treeCloseButton.addEventListener("mouseenter", () => {
    treeCloseButton.style.transform = "scale(1.1)";
    treeCloseButton.style.boxShadow = "0 4px 12px rgba(255, 95, 87, 0.4)";
  });

  treeCloseButton.addEventListener("mouseleave", () => {
    treeCloseButton.style.transform = "scale(1)";
    treeCloseButton.style.boxShadow = "0 2px 8px rgba(255, 95, 87, 0.3)";
  });

  treeCloseButton.onclick = () => {
    // Tree window만 닫기
    treeContainer.remove();

    // 만약 Preview window도 없다면 하이라이트 제거 및 상태 초기화
    if (!document.getElementById("dom-preview-visualization")) {
      removeAllHighlights();
      isVisualizationActive = false;
    }
  };

  headerContainer.appendChild(title);
  headerContainer.appendChild(treeCloseButton);
  treeContainer.appendChild(headerContainer);

  // 미리보기 헤더 컨테이너 생성 (상단 고정)
  const previewHeaderContainer = document.createElement("div");
  previewHeaderContainer.classList.add("window-header");
  previewHeaderContainer.style.cssText = `
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: ${
      isDarkMode ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)"
    };
    backdrop-filter: blur(20px);
    border-bottom: 1px solid ${
      isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
    };
    border-radius: 20px 20px 0 0;
    padding: 18px 20px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;

  // 미리보기 제목 추가 (드래그 핸들 역할)
  const previewTitle = document.createElement("div");
  previewTitle.textContent = "Layout & Paint Preview";
  previewTitle.classList.add("drag-handle", "window-title");
  previewTitle.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: -0.01em;
    cursor: move;
    user-select: none;
    flex: 1;
    text-align: center;
    margin: 0;
  `;

  // 미리보기 닫기 버튼 (Apple System UI 스타일)
  const previewCloseButton = document.createElement("button");
  previewCloseButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
  previewCloseButton.style.cssText = `
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #ff5f57;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(255, 95, 87, 0.3);
    margin-left: auto;
  `;

  previewCloseButton.addEventListener("mouseenter", () => {
    previewCloseButton.style.transform = "scale(1.1)";
    previewCloseButton.style.boxShadow = "0 4px 12px rgba(255, 95, 87, 0.4)";
  });

  previewCloseButton.addEventListener("mouseleave", () => {
    previewCloseButton.style.transform = "scale(1)";
    previewCloseButton.style.boxShadow = "0 2px 8px rgba(255, 95, 87, 0.3)";
  });

  previewCloseButton.onclick = () => {
    // Preview window만 닫기
    previewContainer.remove();

    // 만약 Tree window도 없다면 하이라이트 제거 및 상태 초기화
    if (!document.getElementById("dom-tree-visualization")) {
      removeAllHighlights();
      isVisualizationActive = false;
    }
  };

  previewHeaderContainer.appendChild(previewTitle);
  previewHeaderContainer.appendChild(previewCloseButton);
  previewContainer.appendChild(previewHeaderContainer);

  // 미리보기 내용 컨테이너
  const previewContent = document.createElement("div");
  previewContent.id = "preview-content";
  previewContent.style.cssText = `
    flex: 1;
    position: relative;
    overflow: hidden;
    background: ${isDarkMode ? "#2c2c2e" : "#f9f9f9"};
    border: 1px solid ${
      isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
    };
    border-radius: 12px;
    margin: 15px 20px 20px 20px;
    transition: all 0.2s ease;
  `;
  previewContainer.appendChild(previewContent);

  // 리사이즈 핸들 추가
  const resizeHandle = document.createElement("div");
  resizeHandle.classList.add("resize-handle");
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, transparent 0%, transparent 30%, ${
      isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
    } 30%, ${
    isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
  } 40%, transparent 40%, transparent 60%, ${
    isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
  } 60%, ${
    isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
  } 70%, transparent 70%);
    cursor: nw-resize;
    z-index: 1001;
    border-bottom-right-radius: 15px;
    transition: all 0.2s ease;
  `;
  previewContainer.appendChild(resizeHandle);

  // 트리 내용 컨테이너 (스크롤 가능)
  const treeContent = document.createElement("div");
  treeContent.id = "tree-content";
  treeContent.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 25px 25px 25px;
    scrollbar-width: thin;
    scrollbar-color: ${
      isDarkMode
        ? "rgba(255, 255, 255, 0.3) transparent"
        : "rgba(0, 0, 0, 0.3) transparent"
    };
  `;

  // WebKit 브라우저용 스크롤바 스타일
  const scrollbarStyle = document.createElement("style");
  scrollbarStyle.textContent = `
    #tree-content::-webkit-scrollbar {
      width: 6px;
    }
    #tree-content::-webkit-scrollbar-track {
      background: transparent;
    }
    #tree-content::-webkit-scrollbar-thumb {
      background: ${
        isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
      };
      border-radius: 3px;
      transition: all 0.2s ease;
    }
    #tree-content::-webkit-scrollbar-thumb:hover {
      background: ${
        isDarkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)"
      };
    }
  `;
  document.head.appendChild(scrollbarStyle);

  treeContainer.appendChild(treeContent);

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

  // 자식 요소들 확인 (시각화 창 요소들은 제외)
  const children = Array.from(element.children || []).filter(
    (child) => !shouldSkipElement(child)
  );
  const hasChildren = children.length > 0;

  // 노드 컨테이너 생성
  const nodeContainer = document.createElement("div");
  nodeContainer.classList.add("tree-node-container");
  nodeContainer.dataset.elementId = getElementUniqueId(element);

  // 노드 헤더 생성 (토글 버튼 + 노드 정보)
  const nodeHeader = document.createElement("div");
  nodeHeader.classList.add("tree-node-header");
  nodeHeader.style.cssText = `
    display: flex;
    align-items: center;
    margin: 4px 0;
    padding: 8px 12px;
    border-left: 3px solid ${getDepthColor(depth)};
    background: rgba(${getDepthRGB(depth)}, 0.08);
    border-radius: 8px;
    transition: all 0.3s ease;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: ${isDarkMode ? "#f2f2f7" : "#1d1d1f"};
    border: 1px solid rgba(${getDepthRGB(depth)}, 0.2);
  `;

  // 토글 버튼 (자식이 있을 때만)
  let toggleButton = null;
  if (hasChildren) {
    toggleButton = document.createElement("span");
    toggleButton.classList.add("tree-toggle");
    toggleButton.textContent = "▼"; // 기본적으로 펼쳐진 상태
    toggleButton.title = "Click to collapse/expand";
    toggleButton.style.cssText = `
      margin-right: 8px;
      font-size: 10px;
      color: ${isDarkMode ? "#86868b" : "#666"};
      transition: transform 0.2s ease, background 0.2s ease;
      user-select: none;
      min-width: 12px;
      text-align: center;
      cursor: pointer;
      border-radius: 50%;
      padding: 2px;
    `;

    // 토글 버튼 호버 효과
    toggleButton.addEventListener("mouseenter", () => {
      toggleButton.style.background = "rgba(0, 122, 255, 0.1)";
      toggleButton.style.color = isDarkMode ? "#f2f2f7" : "#007aff";
    });

    toggleButton.addEventListener("mouseleave", () => {
      toggleButton.style.background = "transparent";
      toggleButton.style.color = isDarkMode ? "#86868b" : "#666";
    });

    nodeHeader.appendChild(toggleButton);
  } else {
    // 자식이 없으면 빈 공간 추가 (정렬 맞춤)
    const spacer = document.createElement("span");
    spacer.style.cssText = `
      margin-right: 20px;
      min-width: 12px;
    `;
    nodeHeader.appendChild(spacer);
  }

  // 노드 텍스트 생성 - 태그 이름만 표시 (waterfall 스타일)
  const nodeText = document.createElement("span");
  nodeText.innerHTML = `${indent}${depth > 0 ? "├─ " : ""}${tagName}`;
  nodeText.style.cssText = `
    white-space: pre-wrap;
    flex: 1;
  `;
  nodeHeader.appendChild(nodeText);

  // 자식 요소들을 담을 컨테이너
  const childrenContainer = document.createElement("div");
  childrenContainer.classList.add("tree-children");
  childrenContainer.style.cssText = `
    margin-left: 16px;
    transition: all 0.3s ease;
    overflow: hidden;
  `;

  // 노드 컨테이너에 헤더와 자식 컨테이너 추가
  nodeContainer.appendChild(nodeHeader);
  nodeContainer.appendChild(childrenContainer);

  // 헤더에 이벤트 핸들러 추가
  nodeHeader.dataset.elementId = getElementUniqueId(element);

  // 호버 효과
  nodeHeader.onmouseenter = () => {
    nodeHeader.style.background = `rgba(${getDepthRGB(depth)}, 0.15)`;
    nodeHeader.style.transform = "translateX(4px)";
    nodeHeader.style.boxShadow = `0 2px 8px rgba(${getDepthRGB(depth)}, 0.3)`;
    // 실제 DOM 요소에 파란색 dashed border 추가
    highlightElement(element, true);
  };

  nodeHeader.onmouseleave = () => {
    // 선택된 상태가 아닐 때만 스타일 제거
    if (!nodeHeader.classList.contains("selected")) {
      nodeHeader.style.background = `rgba(${getDepthRGB(depth)}, 0.08)`;
      nodeHeader.style.transform = "translateX(0)";
      nodeHeader.style.boxShadow = "none";
      // 하이라이트 제거
      removeHighlight(element);
    }
  };

  // 클릭 효과
  nodeHeader.onclick = (e) => {
    e.stopPropagation(); // 이벤트 버블링 방지

    // 토글 버튼 클릭 시 접기/펼치기
    if (
      hasChildren &&
      (e.target === toggleButton || toggleButton.contains(e.target))
    ) {
      const isExpanded =
        childrenContainer.style.maxHeight !== "0px" &&
        childrenContainer.style.maxHeight !== "";

      if (isExpanded) {
        // 접기
        childrenContainer.style.maxHeight = "0px";
        childrenContainer.style.opacity = "0";
        toggleButton.textContent = "▶";
        toggleButton.style.transform = "rotate(-90deg)";
      } else {
        // 펼치기
        childrenContainer.style.maxHeight = "none";
        childrenContainer.style.opacity = "1";
        toggleButton.textContent = "▼";
        toggleButton.style.transform = "rotate(0deg)";
      }
      return;
    }

    // 일반 클릭 시 선택 효과
    // 기존 선택된 노드 스타일 제거
    const prevSelected = container.querySelector(".tree-node-header.selected");
    if (prevSelected) {
      prevSelected.classList.remove("selected");
      const prevDepth = parseInt(prevSelected.dataset.depth) || 0;
      prevSelected.style.background = `rgba(${getDepthRGB(prevDepth)}, 0.08)`;
    }

    // 현재 노드 선택 스타일 적용
    nodeHeader.classList.add("selected");
    nodeHeader.dataset.depth = depth;
    nodeHeader.style.background = "#007aff20";

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

  container.appendChild(nodeContainer);

  // 렌더링 과정 시뮬레이션
  const renderDelay = depth * 200 + Math.random() * 150;

  setTimeout(() => {
    // 1. 트리 노드 애니메이션
    nodeHeader.style.opacity = "0";
    nodeHeader.style.transform = "translateX(-20px)";
    setTimeout(() => {
      nodeHeader.style.opacity = "1";
      nodeHeader.style.transform = "translateX(0)";
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
  children.forEach((child, index) => {
    setTimeout(() => {
      buildDOMTree(
        child,
        childrenContainer,
        previewContainer,
        depth + 1,
        isDarkMode
      );
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

  // 기본 태그 필터링
  if (skipTags.includes(tagName)) {
    return false;
  }

  // 실제로 화면에 표시되는지 확인
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  // 크기가 없거나 화면 밖에 있는 요소 제외
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  // display: none이거나 visibility: hidden인 요소 제외
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden"
  ) {
    return false;
  }

  // opacity가 0인 요소 제외
  if (parseFloat(computedStyle.opacity) === 0) {
    return false;
  }

  // 화면 영역 밖에 완전히 벗어난 요소 제외
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  if (
    rect.right < 0 ||
    rect.bottom < 0 ||
    rect.left > viewport.width ||
    rect.top > viewport.height
  ) {
    return false;
  }

  // 너무 작은 요소들 제외 (1px 이하)
  if (rect.width < 1 || rect.height < 1) {
    return false;
  }

  return true;
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

  // Layout 단계 스타일 - 기존 스타일을 완전히 대체
  box.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${sizes.width};
    height: ${sizes.height};
    border: 2px solid #ff9800;
    background-color: #fff3e0;
    opacity: 0.8;
    transform: scale(1);
    transition: all 0.5s ease;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
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

  // Composite 단계 스타일 - 이전 스타일 유지하면서 최종 스타일 적용
  box.style.border = `1px solid ${computedStyle.borderColor || "#333"}`;
  box.style.backgroundColor = backgroundColor;
  box.style.opacity = "1";
  box.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
  box.style.cursor = "pointer";

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

  // Tree Container 스타일 (Apple System UI with fixed header)
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
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 10000;
    box-shadow: ${treeTheme.shadow};
    transition: all 0.3s ease;
  `;

  // Preview Container 스타일 (Apple System UI with fixed header)
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
    padding: 0;
    z-index: 9999;
    box-shadow: ${previewTheme.shadow};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;

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

  // Tree 노드 스타일 업데이트
  const treeNodes = treeContainer.querySelectorAll(".tree-node-header");
  treeNodes.forEach((node) => {
    node.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";
    node.style.fontSize = "13px";
    node.style.color = isDarkMode ? "#f2f2f7" : "#1d1d1f";
  });
}

// 테마 업데이트 함수
function updateVisualizationTheme(isDarkMode) {
  const treeContainer = document.getElementById("dom-tree-visualization");
  const previewContainer = document.getElementById("dom-preview-visualization");

  if (treeContainer && previewContainer) {
    applyTheme(treeContainer, previewContainer, isDarkMode);

    // 헤더 배경색 업데이트
    const treeHeader = treeContainer.querySelector(".window-header");
    const previewHeader = previewContainer.querySelector(".window-header");

    if (treeHeader) {
      treeHeader.style.background = isDarkMode
        ? "rgba(28, 28, 30, 0.95)"
        : "rgba(255, 255, 255, 0.95)";
      treeHeader.style.borderBottomColor = isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
    }

    if (previewHeader) {
      previewHeader.style.background = isDarkMode
        ? "rgba(28, 28, 30, 0.95)"
        : "rgba(255, 255, 255, 0.95)";
      previewHeader.style.borderBottomColor = isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
    }

    // 제목 색상 업데이트
    const titles = document.querySelectorAll(
      "#dom-tree-visualization .window-title, #dom-preview-visualization .window-title"
    );
    titles.forEach((title) => {
      title.style.color = isDarkMode ? "#f2f2f7" : "#1d1d1f";
    });

    // 미리보기 내용 컨테이너 배경색 업데이트
    const previewContent = previewContainer.querySelector("#preview-content");
    if (previewContent) {
      previewContent.style.background = isDarkMode ? "#2c2c2e" : "#f9f9f9";
      previewContent.style.borderColor = isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
    }

    // 스크롤바 색상 업데이트
    const existingScrollbarStyle = document.querySelector(
      'style[data-scrollbar="tree-content"]'
    );
    if (existingScrollbarStyle) {
      existingScrollbarStyle.remove();
    }

    const scrollbarStyle = document.createElement("style");
    scrollbarStyle.setAttribute("data-scrollbar", "tree-content");
    scrollbarStyle.textContent = `
      #tree-content::-webkit-scrollbar-thumb {
        background: ${
          isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
        };
      }
      #tree-content::-webkit-scrollbar-thumb:hover {
        background: ${
          isDarkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)"
        };
      }
    `;
    document.head.appendChild(scrollbarStyle);
  }
}

function removeExistingVisualization() {
  // 모든 하이라이트 제거
  removeAllHighlights();

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

  /* 토글 버튼 호버 효과 */
  .tree-toggle:hover {
    background: rgba(0, 122, 255, 0.1);
    border-radius: 50%;
    padding: 2px;
  }
`;
document.head.appendChild(style);

// 페이지 언로드 시 모든 하이라이트 정리
window.addEventListener("beforeunload", () => {
  removeAllHighlights();
});

// 페이지 히든 상태일 때도 하이라이트 정리
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    removeAllHighlights();
  }
});

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

  const treeNodeContainer = treeContainer.querySelector(
    `[data-element-id="${elementId}"]`
  );
  if (treeNodeContainer) {
    const treeNodeHeader = treeNodeContainer.querySelector(".tree-node-header");
    if (treeNodeHeader) {
      treeNodeHeader.style.background = "#007aff20";
      treeNodeHeader.style.transform = "translateX(4px)";
      treeNodeHeader.style.boxShadow = "0 2px 8px rgba(0, 122, 255, 0.3)";
    }
  }
}

// DOM Structure에서 노드 하이라이트 제거
function removeTreeNodeHighlight() {
  const treeContainer = document.getElementById("tree-content");
  if (!treeContainer) return;

  const highlightedNodes = treeContainer.querySelectorAll(
    ".tree-node-header:not(.selected)"
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

  const treeNodeContainer = treeContainer.querySelector(
    `[data-element-id="${elementId}"]`
  );

  if (treeNodeContainer) {
    const treeNodeHeader = treeNodeContainer.querySelector(".tree-node-header");
    if (!treeNodeHeader) return;

    // 부모 노드들을 모두 펼치기 (해당 노드가 보이도록)
    let parentContainer = treeNodeContainer.parentElement;
    while (parentContainer && parentContainer !== treeContainer) {
      if (parentContainer.classList.contains("tree-children")) {
        parentContainer.style.maxHeight = "none";
        parentContainer.style.opacity = "1";

        // 부모 노드의 토글 버튼도 업데이트
        const parentNodeContainer = parentContainer.parentElement;
        if (
          parentNodeContainer &&
          parentNodeContainer.classList.contains("tree-node-container")
        ) {
          const toggleButton =
            parentNodeContainer.querySelector(".tree-toggle");
          if (toggleButton) {
            toggleButton.textContent = "▼";
            toggleButton.style.transform = "rotate(0deg)";
          }
        }
      }
      parentContainer = parentContainer.parentElement;
    }

    // 기존 선택된 노드 스타일 제거
    const prevSelected = treeContainer.querySelector(
      ".tree-node-header.selected"
    );
    if (prevSelected) {
      prevSelected.classList.remove("selected");
      const prevDepth = parseInt(prevSelected.dataset.depth) || 0;
      prevSelected.style.background = `rgba(${getDepthRGB(prevDepth)}, 0.08)`;
    }

    // 현재 노드 선택 스타일 적용
    treeNodeHeader.classList.add("selected");
    treeNodeHeader.style.background = "#007aff20";

    // 스크롤하여 노드가 보이도록 함
    treeNodeHeader.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // 잠시 깜빡이는 효과
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      treeNodeHeader.style.background =
        flashCount % 2 === 0 ? "#007aff40" : "#007aff20";
      flashCount++;
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        treeNodeHeader.style.background = "#007aff20";
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
