/* GenSmart Web Widget Loader v1.0 */
(function () {
  'use strict';

  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var agentId = scriptTag.getAttribute('data-agent-id');
  if (!agentId) {
    console.error('[GenSmart] Missing data-agent-id attribute on widget script tag');
    return;
  }

  // Derive base URL from script src (e.g. https://www.gensmart.co/widget.js -> https://www.gensmart.co)
  var scriptSrc = scriptTag.src || '';
  var baseUrl = scriptSrc.replace(/\/widget\.js(\?.*)?$/, '') || window.location.origin;

  // API base: prefer data-api-url attribute, otherwise derive from baseUrl
  // e.g. https://www.gensmart.co -> https://api.gensmart.co
  var apiBase = scriptTag.getAttribute('data-api-url');
  if (!apiBase) {
    try {
      var urlObj = new URL(baseUrl);
      // Strip www. prefix before adding api. prefix
      if (urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = urlObj.hostname.substring(4);
      }
      if (!urlObj.hostname.startsWith('api.')) {
        urlObj.hostname = 'api.' + urlObj.hostname;
      }
      apiBase = urlObj.origin;
    } catch (e) {
      apiBase = baseUrl;
    }
  }

  var isOpen = false;
  var bubbleEl = null;
  var containerEl = null;

  function fetchConfig(cb) {
    var url = apiBase + '/api/widget/' + agentId + '/config';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          cb(null, JSON.parse(xhr.responseText));
        } catch (e) {
          cb(e, null);
        }
      } else {
        cb(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.send();
  }

  function createStyles(primaryColor, position) {
    var isRight = position !== 'bottom-left';
    var side = isRight ? 'right' : 'left';
    var style = document.createElement('style');
    style.textContent =
      '#gensmart-bubble{position:fixed;bottom:24px;' + side + ':24px;width:60px;height:60px;border-radius:50%;background:' + primaryColor + ';cursor:pointer;z-index:999999;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .2s,box-shadow .2s,opacity .4s;opacity:0;transform:scale(0);}' +
      '#gensmart-bubble:hover{transform:scale(1.08)!important;box-shadow:0 6px 28px rgba(0,0,0,.28);}' +
      '#gensmart-container{position:fixed;bottom:100px;' + side + ':24px;width:380px;height:520px;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.15);z-index:999998;display:none;opacity:0;transform:translateY(20px);transition:opacity .25s,transform .25s;}' +
      '#gensmart-container iframe{width:100%;height:100%;border:0;display:block;}' +
      '@media(max-width:767px){#gensmart-container{bottom:0;' + side + ':0;width:100vw;width:100dvw;height:100vh;height:100dvh;border-radius:0;}}';
    document.head.appendChild(style);
  }

  var CHAT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  function openChat() {
    if (isOpen) return;
    isOpen = true;
    containerEl.style.display = 'block';
    bubbleEl.innerHTML = CLOSE_ICON;
    requestAnimationFrame(function () {
      containerEl.style.opacity = '1';
      containerEl.style.transform = 'translateY(0)';
    });
  }

  function closeChat() {
    if (!isOpen) return;
    isOpen = false;
    containerEl.style.opacity = '0';
    containerEl.style.transform = 'translateY(20px)';
    bubbleEl.innerHTML = CHAT_ICON;
    setTimeout(function () {
      if (!isOpen) containerEl.style.display = 'none';
    }, 250);
  }

  function init(config) {
    var primaryColor = config.primary_color || '#25D366';
    var position = config.position || 'bottom-right';
    var iframeUrl = baseUrl + '/widget/' + agentId;

    createStyles(primaryColor, position);

    // Create bubble
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'gensmart-bubble';
    bubbleEl.setAttribute('role', 'button');
    bubbleEl.setAttribute('aria-label', 'Open chat');
    bubbleEl.setAttribute('tabindex', '0');
    bubbleEl.innerHTML = CHAT_ICON;
    bubbleEl.addEventListener('click', function () { isOpen ? closeChat() : openChat(); });
    bubbleEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { isOpen ? closeChat() : openChat(); }
    });

    // Create iframe container
    containerEl = document.createElement('div');
    containerEl.id = 'gensmart-container';

    var iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.setAttribute('title', config.name + ' Chat');
    iframe.setAttribute('allow', 'microphone');
    containerEl.appendChild(iframe);

    // Listen for postMessages from iframe
    window.addEventListener('message', function (event) {
      if (event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'gensmart:close') closeChat();
    });

    document.body.appendChild(bubbleEl);
    document.body.appendChild(containerEl);

    // Animate bubble in after short delay
    setTimeout(function () {
      bubbleEl.style.opacity = '1';
      bubbleEl.style.transform = 'scale(1)';
    }, 600);
  }

  function start() {
    fetchConfig(function (err, config) {
      if (err || !config) {
        console.warn('[GenSmart] Could not load widget config:', err);
        return;
      }
      init(config);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
