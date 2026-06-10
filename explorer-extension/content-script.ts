// Content Script - Runs in the context of web pages
// Handles DOM manipulation and page state capture for EXTRACT_DOM and GET_SNAPSHOT commands

import type {
  ExtractDomParams,
  ExtractDomResult,
  DomElement,
  SnapshotResult,
  NetworkCall,
  BoundingRect,
} from './types';

import {
  MAX_VISIBLE_TEXT_LENGTH,
  MAX_ELEMENT_TEXT_LENGTH,
} from './types';

// Track network calls observed on this page
const networkCalls: NetworkCall[] = [];

// Listen for network requests (via webNavigation API in service worker)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SNAPSHOT') {
    const snapshot = captureSnapshot();
    sendResponse(snapshot);
    return true;
  }

  if (message.type === 'EXTRACT_DOM') {
    const params = message.params as ExtractDomParams;
    const result = extractDom(params.selectors);
    sendResponse(result);
    return true;
  }

  if (message.type === 'ADD_NETWORK_CALL') {
    networkCalls.push(message.networkCall as NetworkCall);
    return false;
  }

  return false;
});

/**
 * Capture full page snapshot
 */
function captureSnapshot(): SnapshotResult {
  const body = document.body;
  const html = document.documentElement?.outerHTML || '';

  return {
    url: window.location.href,
    title: document.title || '',
    html,
    visibleText: getVisibleText(body),
    networkCalls: [...networkCalls],
    timestamp: new Date(),
  };
}

/**
 * Extract visible text from an element, limited to max length
 */
function getVisibleText(element: Element | null): string {
  if (!element) return '';

  const text = element.innerText || element.textContent || '';
  return text.slice(0, MAX_VISIBLE_TEXT_LENGTH);
}

/**
 * Extract DOM elements by CSS selectors
 */
function extractDom(selectors: Record<string, string>): ExtractDomResult {
  const elements: Record<string, DomElement[]> = {};

  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const nodes = document.querySelectorAll(selector);
      elements[key] = Array.from(nodes).map(node => extractElementData(node));
    } catch (error) {
      console.error(`[Explorer Extension] Invalid selector "${selector}":`, error);
      elements[key] = [];
    }
  }

  return { elements };
}

/**
 * Extract structured data from a DOM element
 */
function extractElementData(node: Element): DomElement {
  const element: DomElement = {
    tag: node.tagName.toLowerCase(),
    text: getTruncatedText(node),
  };

  // Extract href if anchor tag
  if (element.tag === 'a') {
    element.href = (node as HTMLAnchorElement).href;
  }

  // Extract src if img tag
  if (element.tag === 'img') {
    element.src = (node as HTMLImageElement).src;
  }

  // Get bounding rect
  const rect = node.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    element.rect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  return element;
}

/**
 * Get truncated innerText of an element
 */
function getTruncatedText(node: Element): string {
  const text = node.innerText || node.textContent || '';
  if (text.length <= MAX_ELEMENT_TEXT_LENGTH) {
    return text.trim();
  }
  return text.slice(0, MAX_ELEMENT_TEXT_LENGTH) + '...';
}

// Signal that content script is loaded
console.log('[Explorer Extension] Content script loaded');