// ========================
// APP CORE FUNCTIONALITY
// ========================

const alphabets = ["A", "B", "C", "D", "E", "F"];
const timeIntervals = [...Array(48).keys()].map(i => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes} ${period}`;
});

// ========================
// DATA MANAGEMENT
// ========================

let appData = {
  settings: {
    autoFill: true,
    reminderTime: 10
  },
  timeData: JSON.parse(localStorage.getItem('timeTrackerData')) || {}
};

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function saveToStorage() {
  localStorage.setItem('timeTrackerData', JSON.stringify(appData.timeData));
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
}

// ========================
// TIME GRID MANAGEMENT
// ========================

function initializeTimeGrid() {
  const gridContainer = document.getElementById('time-grid');
  gridContainer.innerHTML = '';
  
  const currentDate = getCurrentDate();
  if (!appData.timeData[currentDate]) {
    appData.timeData[currentDate] = timeIntervals.map(time => ({
      time,
      value: null,
      timestamp: null
    }));
  }

  appData.timeData[currentDate].forEach((slot, index) => {
    const gridItem = document.createElement('div');
    gridItem.className = `grid-item ${slot.value ? 'filled' : ''}`;
    gridItem.textContent = slot.value ? `${slot.time} - ${slot.value}` : slot.time;
    
    gridItem.addEventListener('click', () => handleSlotClick(index));
    gridContainer.appendChild(gridItem);
  });
}

// ========================
// SLOT INTERACTION
// ========================

function handleSlotClick(index) {
  const currentDate = getCurrentDate();
  const slot = appData.timeData[currentDate][index];
  const now = new Date();
  
  const slotTime = new Date();
  slotTime.setHours(Math.floor(index / 2));
  slotTime.setMinutes(index % 2 === 0 ? 0 : 30);
  
  const minTime = new Date(slotTime);
  minTime.setMinutes(minTime.getMinutes() - appData.settings.reminderTime);
  
  const maxTime = new Date(slotTime);
  maxTime.setMinutes(maxTime.getMinutes() + 30);

  if (now >= minTime && now <= maxTime) {
    const value = prompt('Enter activity (A-F):', slot.value || '');
    if (value && alphabets.includes(value.toUpperCase())) {
      slot.value = value.toUpperCase();
      slot.timestamp = new Date().toISOString();
      saveToStorage();
      initializeTimeGrid();
    }
  } else {
    alert('This time slot is not currently available for editing');
  }
}

// ========================
// AUTO-FILL SYSTEM
// ========================

function autoFillMissedSlots() {
  const currentDate = getCurrentDate();
  const now = new Date();
  
  appData.timeData[currentDate].forEach((slot, index) => {
    const slotTime = new Date();
    slotTime.setHours(Math.floor(index / 2));
    slotTime.setMinutes(index % 2 === 0 ? 0 : 30);
    
    if (!slot.value && now > slotTime) {
      slot.value = 'F';
      slot.timestamp = new Date().toISOString();
    }
  });
  
  saveToStorage();
  initializeTimeGrid();
}

// ========================
// DATA IMPORT/EXPORT
// ========================

function exportData() {
  const dataStr = JSON.stringify(appData.timeData);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-data-${getCurrentDate()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = e => {
      try {
        const importedData = JSON.parse(e.target.result);
        appData.timeData = { ...appData.timeData, ...importedData };
        saveToStorage();
        initializeTimeGrid();
        initializeCharts();
      } catch (error) {
        alert('Invalid data file');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// ========================
// CHARTING SYSTEM
// ========================

let weeklyChart, monthlyChart, comparisonChart;

function initializeCharts() {
  // Destroy existing chart instances
  if (weeklyChart) weeklyChart.destroy();
  if (monthlyChart) monthlyChart.destroy();
  if (comparisonChart) comparisonChart.destroy();

  // Weekly Chart
  weeklyChart = new Chart(document.getElementById('weekly-chart'), {
    type: 'bar',
    data: getWeeklyData(),
    options: chartOptions('Weekly Activity Distribution')
  });

  // Monthly Chart
  monthlyChart = new Chart(document.getElementById('monthly-chart'), {
    type: 'line',
    data: getMonthlyData(),
    options: chartOptions('Monthly Progress')
  });

  // Comparison Chart
  comparisonChart = new Chart(document.getElementById('comparison-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: chartOptions('Comparison View')
  });
}

function getWeeklyData() {
  // Implementation for weekly data aggregation
}

function getMonthlyData() {
  // Implementation for monthly data aggregation
}

function chartOptions(title) {
  return {
    responsive: true,
    plugins: {
      title: { display: true, text: title }
    }
  };
}

// ========================
// COMPARISON SYSTEM
// ========================

document.getElementById('compare-type').addEventListener('change', function() {
  document.querySelectorAll('.comparison-section').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById(`${this.value}-comparison`).style.display = 'flex';
});

document.getElementById('compare-days').addEventListener('click', () => {
  const date1 = document.getElementById('first-day').value;
  const date2 = document.getElementById('second-day').value;
  updateComparisonChart([date1, date2]);
});

// ========================
// PWA FUNCTIONALITY
// ========================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPromotion();
});

function showInstallPromotion() {
  const installBtn = document.createElement('button');
  installBtn.textContent = 'Install App';
  installBtn.className = 'install-btn';
  installBtn.onclick = () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
    });
  };
  document.body.appendChild(installBtn);
}

// ========================
// INITIALIZATION
// ========================

document.addEventListener('DOMContentLoaded', () => {
  initializeTimeGrid();
  initializeCharts();
  setInterval(autoFillMissedSlots, 300000); // 5-minute interval
  
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('SW registration failed:', err));
  }

  // Offline Detection
  window.addEventListener('online', () => {
    document.getElementById('offline-warning').style.display = 'none';
  });
  
  window.addEventListener('offline', () => {
    document.getElementById('offline-warning').style.display = 'block';
  });
});