// types.ts
var MAX_VISIBLE_TEXT_LENGTH = 5e3;
var MAX_ELEMENT_TEXT_LENGTH = 200;

// content-script.ts
var networkCalls = [];
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_SNAPSHOT") {
    const snapshot = captureSnapshot();
    sendResponse(snapshot);
    return true;
  }
  if (message.type === "EXTRACT_DOM") {
    const params = message.params;
    const result = extractDom(params.selectors);
    sendResponse(result);
    return true;
  }
  if (message.type === "ADD_NETWORK_CALL") {
    networkCalls.push(message.networkCall);
    return false;
  }
  return false;
});
function captureSnapshot() {
  const body = document.body;
  const html = document.documentElement?.outerHTML || "";
  return {
    url: window.location.href,
    title: document.title || "",
    html,
    visibleText: getVisibleText(body),
    networkCalls: [...networkCalls],
    timestamp: /* @__PURE__ */ new Date()
  };
}
function getVisibleText(element) {
  if (!element) return "";
  const text = element.innerText || element.textContent || "";
  return text.slice(0, MAX_VISIBLE_TEXT_LENGTH);
}
function extractDom(selectors) {
  const elements = {};
  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const nodes = document.querySelectorAll(selector);
      elements[key] = Array.from(nodes).map((node) => extractElementData(node));
    } catch (error) {
      console.error(`[Explorer Extension] Invalid selector "${selector}":`, error);
      elements[key] = [];
    }
  }
  return { elements };
}
function extractElementData(node) {
  const element = {
    tag: node.tagName.toLowerCase(),
    text: getTruncatedText(node)
  };
  if (element.tag === "a") {
    element.href = node.href;
  }
  if (element.tag === "img") {
    element.src = node.src;
  }
  const rect = node.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    element.rect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }
  return element;
}
function getTruncatedText(node) {
  const text = node.innerText || node.textContent || "";
  if (text.length <= MAX_ELEMENT_TEXT_LENGTH) {
    return text.trim();
  }
  return text.slice(0, MAX_ELEMENT_TEXT_LENGTH) + "...";
}
console.log("[Explorer Extension] Content script loaded");
//# sourceMappingURL=content-script.js.map
