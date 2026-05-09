function findOmniData() {
  const url = window.location.href;
  if (url.includes('list')) return null;

  const bodyText = document.body.innerText;
  
  let nameMatch = bodyText.match(/НАЗВАНИЕ\s*\n\s*([^\n]+)/i);
  if (!nameMatch) {
    nameMatch = bodyText.match(/НАЗВАНИЕ:\s*([^\n]+)/i);
  }

  const typeMatch = bodyText.match(/ТИП ОБСЛУЖИВАНИЯ\s*\n\s*([^\n]+)/i) || bodyText.match(/ТИП ОБСЛУЖИВАНИЯ:\s*([^\n]+)/i);
  
  if (nameMatch) {
    const name = nameMatch[1].trim();
    const type = typeMatch ? typeMatch[1].trim() : "Не указан";
    
    const blacklist = ["СОЗДАНО", "ПРИОРИТЕТ", "СТАТУС", "ОТВЕТСТВЕННЫЙ", "КАНАЛ", "ГРУППА", "ПОСЛЕДНИЙ"];
    if (blacklist.includes(name.toUpperCase())) return null;
    if (name.length > 80) return null;

    return { name, type };
  }
  
  const allLabels = document.querySelectorAll('div, span, label, b');
  for (let label of allLabels) {
    if (label.innerText && label.innerText.trim().toUpperCase() === 'НАЗВАНИЕ') {
      const val = label.nextElementSibling || label.parentElement.lastElementChild;
      if (val && val.innerText.trim().length < 80) {
        return { 
          name: val.innerText.trim().split('\n')[0], 
          type: "Определено по структуре" 
        };
      }
    }
  }

  return null;
}

let lastActiveName = null;

// Отправляем heartbeat каждые 3 секунды, чтобы background знал, что вкладка жива
setInterval(() => {
  chrome.runtime.sendMessage({ action: "heartbeat" });
}, 3000);

setInterval(() => {
  const found = findOmniData();
  
  if (found) {
    chrome.runtime.sendMessage({ 
      action: "pageCompanyChanged", 
      company: found.name 
    });
  } else {
    chrome.runtime.sendMessage({ 
      action: "pageCompanyChanged", 
      company: null 
    });
  }
  
  if (found && found.name !== lastActiveName) {
    lastActiveName = found.name;
    chrome.runtime.sendMessage({ action: "switchCompany", company: found.name, clientType: found.type });
  } else if (!found && lastActiveName !== null) {
    lastActiveName = null;
    chrome.runtime.sendMessage({ action: "switchCompany", company: null });
  }
}, 1500);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCompany") {
    const data = findOmniData();
    if (data) {
      lastActiveName = data.name;
      chrome.runtime.sendMessage({ action: "switchCompany", company: data.name, clientType: data.type, force: true });
    } else {
      lastActiveName = null;
      chrome.runtime.sendMessage({ action: "switchCompany", company: null });
    }
  }
  return true;
});











