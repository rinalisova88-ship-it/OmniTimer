document.addEventListener('DOMContentLoaded', () => {
  const statsContainer = document.getElementById('stats-container');
  const totalDisplay = document.getElementById('total-time');
  const liveTimer = document.getElementById('live-timer');
  const activeCompanyDisplay = document.getElementById('active-company');
  const activeTypeDisplay = document.getElementById('active-type');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');
  const backBtn = document.getElementById('back-to-chat-btn');
  const manualInput = document.getElementById('manual-input');
  const addTaskBtn = document.getElementById('add-task-btn');

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function renderStats(activeName) {
    chrome.storage.local.get(['omniTimers'], (res) => {
      const timers = res.omniTimers || {};
      statsContainer.innerHTML = '';
      let totalSeconds = 0;
      const keys = Object.keys(timers);
      keys.sort((a, b) => (timers[b].seconds || 0) - (timers[a].seconds || 0));
      keys.forEach(name => {
        const data = timers[name];
        totalSeconds += (data.seconds || 0);
        const row = document.createElement('div');
        row.className = 'company-row' + (name === activeName ? ' active' : '');
        row.innerHTML = `<div style="display:flex; flex-direction:column; text-align:left;"><span class="company-name" style="font-weight:bold;">${name}</span><span style="font-size:10px; color:#999;">${data.type || ""}</span></div><span class="company-time">${formatTime(data.seconds || 0)}</span>`;
        row.onclick = () => {
          chrome.storage.local.set({ isManualTask: true });
          chrome.runtime.sendMessage({ action: "switchCompany", company: name, manual: true, clientType: data.type, force: true });
        };
        statsContainer.appendChild(row);
      });
      totalDisplay.textContent = formatTime(totalSeconds);
    });
  }

  function updateLive() {
    chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
      if (response) {
        const currentActive = response.activeCompany || "ОЖИДАНИЕ...";
        activeCompanyDisplay.textContent = currentActive;
        activeTypeDisplay.textContent = response.activeType || "";
        liveTimer.textContent = formatTime(response.currentTime);
        renderStats(response.activeCompany);
        chrome.storage.local.get(['isManualTask'], (data) => {
          backBtn.style.background = data.isManualTask ? '#fff' : '#e8f5e9';
          backBtn.textContent = data.isManualTask ? '🎯 Вернуться к Авто-режиму' : '✅ Авто-режим активен';
        });
        updatePauseUI(response.isPaused);
      }
    });
  }
  
  setInterval(updateLive, 1000);

  // ========== ИСПРАВЛЕННАЯ КНОПКА ДОБАВЛЕНИЯ ЗАДАЧИ ==========
  if (addTaskBtn) {
    addTaskBtn.onclick = () => {
      const taskName = manualInput.value.trim();
      if (taskName === "") {
        alert("Введите название задачи");
        return;
      }
      
      // Устанавливаем ручной режим
      chrome.storage.local.set({ isManualTask: true }, () => {
        // Отправляем команду на переключение на новую задачу
        chrome.runtime.sendMessage({ 
          action: "switchCompany", 
          company: taskName, 
          manual: true, 
          clientType: "Своя задача", 
          force: true 
        }, (response) => {
          // Очищаем поле ввода
          manualInput.value = '';
          // Обновляем интерфейс
          updateLive();
        });
      });
    };
  } else {
    console.error("Кнопка add-task-btn не найдена в DOM");
  }

  backBtn.onclick = () => {
    chrome.storage.local.set({ isManualTask: false }, () => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "getCompany" });
          setTimeout(() => updateLive(), 100);
        }
      });
    });
  };

  pauseBtn.onclick = () => {
    chrome.runtime.sendMessage({ action: "togglePause" }, (response) => {
      if (response) updatePauseUI(response.isPaused);
    });
  };

  stopBtn.onclick = () => {
    chrome.runtime.sendMessage({ action: "forceStop" }, () => {
      updateLive();
    });
  };

  function updatePauseUI(isPaused) {
    if (isPaused) {
      pauseBtn.textContent = "▶️ Продолжить";
      pauseBtn.style.background = "#ff9800";
      pauseBtn.style.color = "white";
    } else {
      pauseBtn.textContent = "⏸ Пауза";
      pauseBtn.style.background = "#f8f9fa";
      pauseBtn.style.color = "#333";
    }
  }

  document.getElementById('download-report').onclick = () => {
    chrome.storage.local.get(['omniTimers'], (res) => {
      const timers = res.omniTimers || {};
      let csv = "\ufeffКомпания;Тип обслуживания;Время\n";
      for (const [n, d] of Object.entries(timers)) csv += `${n};${d.type};${formatTime(d.seconds)}\n`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Report_${new Date().toLocaleDateString()}.csv`;
      link.click();
    });
  };

  document.getElementById('reset-all').onclick = () => {
    if (confirm("Очистить всё за сегодня?")) {
      chrome.runtime.sendMessage({ action: "clearAll" });
      chrome.storage.local.set({ omniTimers: {}, isManualTask: false }, () => updateLive());
    }
  };
  
  updateLive();
});





