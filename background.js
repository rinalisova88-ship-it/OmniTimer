let timers = {};
let activeCompany = null;
let activeType = null;
let ticker = null;
let isPaused = false;
let stopTriggered = false;
let currentPageCompany = null;
let heartbeatTimer = null;
let lastHeartbeat = Date.now();

// Проверка: жива ли вкладка OmniDesk
function startHeartbeatWatcher() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    // Если прошло больше 10 секунд с последнего heartbeat — вкладка закрыта
    if (now - lastHeartbeat > 10000 && activeCompany) {
      // Останавливаем таймер
      activeCompany = null;
      activeType = null;
      if (ticker) clearInterval(ticker);
      updateBadgeByStatus();
    }
  }, 5000);
}

// Обновляем время последнего heartbeat
function updateHeartbeat() {
  lastHeartbeat = Date.now();
  // Если таймер был остановлен из-за отсутствия heartbeat, но вкладка снова появилась — не возобновляем автоматически
  // Пользователь сам переключится или нажмёт авторежим
}

chrome.storage.local.get(['omniTimers'], (res) => {
  if (res.omniTimers) timers = res.omniTimers;
});
startHeartbeatWatcher();

function setBadge(text, color) {
  chrome.action.setBadgeText({ text: text || "" });
  if (color) chrome.action.setBadgeBackgroundColor({ color: color });
}

function updateBadgeByStatus() {
  // Состояние 1: нет активной компании (СТОП)
  if (!activeCompany) {
    setBadge("■", "#e53935");  // красный квадрат
    return;
  }
  
  // Состояние 2: пауза
  if (isPaused) {
    setBadge("||", "#2196F3");  // синий
    return;
  }
  
  // Состояние 3: рассинхрон (таймер активен, но компания на странице другая)
  if (activeCompany && currentPageCompany && activeCompany !== currentPageCompany) {
    setBadge("≠", "#ff9800");  // оранжевый
    return;
  }
  
  // Состояние 4: нормальная работа
  setBadge("ON", "#28a745");  // зелёный
}

function startTicking() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    if (activeCompany && !isPaused) {
      if (!timers[activeCompany] || typeof timers[activeCompany] !== 'object') {
        timers[activeCompany] = { seconds: 0, type: activeType || "Не указан" };
      }
      timers[activeCompany].seconds += 1;
      chrome.storage.local.set({ omniTimers: timers });
      updateBadgeByStatus();
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "heartbeat") {
    updateHeartbeat();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "switchCompany") {
    chrome.storage.local.get(['isManualTask'], (data) => {
      // Если включен ручной режим (клик по списку), игнорируем авто-сигналы
      if (data.isManualTask && !request.manual) {
        sendResponse({ success: false });
        return;
      }

      // ПРИНУДИТЕЛЬНЫЙ ЗАПУСК (кнопка "вернуться в авторежим") — снимаем блокировку Стоп
      if (request.force) {
        stopTriggered = false;
      }

      // Если мы только что нажали СТОП для ЭТОЙ ЖЕ компании — не даем ей запуститься автоматом
      if (stopTriggered && request.company === activeCompany && !request.force) {
        sendResponse({ success: false });
        return;
      }

      activeCompany = request.company;
      activeType = request.clientType || "Не указан";
      stopTriggered = false;
      updateHeartbeat(); // обновляем heartbeat при смене компании

      if (activeCompany) {
        isPaused = false;
        startTicking();
      } else {
        if (ticker) clearInterval(ticker);
      }
      updateBadgeByStatus();
    });
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "togglePause") {
    isPaused = !isPaused;
    updateBadgeByStatus();
    sendResponse({ isPaused: isPaused });
    return true;
  }

  if (request.action === "forceStop") {
    stopTriggered = true;
    activeCompany = null;
    if (ticker) clearInterval(ticker);
    updateBadgeByStatus();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "getStatus") {
    let currentSec = 0;
    if (activeCompany && timers[activeCompany]) {
      currentSec = timers[activeCompany].seconds || 0;
    }
    sendResponse({
      activeCompany: activeCompany,
      activeType: activeType,
      currentTime: currentSec,
      isPaused: isPaused
    });
    return true;
  }

  if (request.action === "clearAll") {
    timers = {};
    activeCompany = null;
    activeType = null;
    isPaused = false;
    stopTriggered = false;
    currentPageCompany = null;
    if (ticker) clearInterval(ticker);
    chrome.storage.local.set({ omniTimers: {}, isManualTask: false });
    updateBadgeByStatus();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "pageCompanyChanged") {
    currentPageCompany = request.company;
    updateBadgeByStatus();
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});




