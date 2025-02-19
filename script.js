// ========================
// APP CORE FUNCTIONALITY
// ========================

const categories = ["A", "B", "C", "D", "E", "F", "S"];
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
    reminderTime: 10,
    sleepHours: { start: 1, end: 12 } // 12:30 AM to 6:00 AM
  },
  timeData: JSON.parse(localStorage.getItem('timeTrackerData')) || {}
};

function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function saveToStorage() {
  localStorage.setItem('timeTrackerData', JSON.stringify(appData.timeData));
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
}

// ========================
// DATA EXPORT/IMPORT
// ========================

function exportData() {
  const dataStr = JSON.stringify(appData.timeData);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `timetracker-data-${getCurrentDate()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.getElementById('import-file');
  input.click();

  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = event => {
      try {
        const importedData = JSON.parse(event.target.result);
        appData.timeData = importedData;
        saveToStorage();
        initializeTimeGrid();
        initializeCharts();
        alert('Data imported successfully!');
      } catch (err) {
        alert('Invalid data file');
      }
    };
    
    reader.readAsText(file);
  };
}

// ========================
// TIME GRID MANAGEMENT
// ========================

function initializeTimeGrid() {
  const gridContainer = document.getElementById('time-grid');
  gridContainer.innerHTML = '';
  
  const currentDate = getCurrentDate();
  
  // Initialize new day with sleep hours
  if (!appData.timeData[currentDate]) {
    appData.timeData[currentDate] = timeIntervals.map((time, index) => ({
      time,
      value: (index >= appData.settings.sleepHours.start && 
              index <= appData.settings.sleepHours.end) ? 'S' : null,
      timestamp: null
    }));
    saveToStorage();
  }

  appData.timeData[currentDate].forEach((slot, index) => {
    const gridItem = document.createElement('div');
    gridItem.className = `grid-item ${slot.value ? 'filled' : ''}`;
    gridItem.textContent = slot.value ? `${slot.time} - ${slot.value}` : slot.time;
    if (slot.value) gridItem.dataset.value = slot.value;
    
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
  
  // Prevent editing sleep hours
  if (index >= appData.settings.sleepHours.start && 
      index <= appData.settings.sleepHours.end) {
    alert("Sleep hours cannot be edited");
    return;
  }

  const now = new Date();
  const slotTime = new Date();
  slotTime.setHours(Math.floor(index / 2));
  slotTime.setMinutes(index % 2 === 0 ? 0 : 30);
  
  const minTime = new Date(slotTime);
  minTime.setMinutes(minTime.getMinutes() - appData.settings.reminderTime);
  
  const maxTime = new Date(slotTime);
  maxTime.setMinutes(maxTime.getMinutes() + 30);

  if (now >= minTime && now <= maxTime) {
    const value = prompt('Enter category (A-F):', slot.value || '');
    if (value && categories.includes(value.toUpperCase())) {
      slot.value = value.toUpperCase();
      slot.timestamp = new Date().toISOString();
      saveToStorage();
      initializeTimeGrid();
      initializeCharts();
    }
  } else {
    alert('This time slot is not currently available for editing');
  }
}

// ========================
// CHARTING SYSTEM
// ========================

let weeklyChart, monthlyChart, comparisonChart;

function getColor(value) {
  const colors = {
    A: '#4CAF50', B: '#2196F3', C: '#9C27B0',
    D: '#FF9800', E: '#E91E63', F: '#F44336', S: '#607D8B'
  };
  return colors[value];
}

function getWeekNumber(dateString) {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function getChartData(timePeriod, isMonthly = false) {
  const data = {};
  const categoryCounts = {};
  
  Object.keys(appData.timeData).forEach(date => {
    const key = isMonthly ? date.substring(0, 7) : getWeekNumber(date);
    
    if (!data[key]) {
      data[key] = { label: isMonthly ? key : `Week ${key}`, categories: {} };
      categories.forEach(c => data[key].categories[c] = 0);
    }
    
    appData.timeData[date].forEach(slot => {
      if (slot.value) {
        data[key].categories[slot.value] = (data[key].categories[slot.value] || 0) + 1;
      }
    });
  });

  const labels = Object.keys(data).sort().map(k => data[k].label);
  categories.forEach(c => {
    categoryCounts[c] = labels.map(label => {
      const key = Object.keys(data).find(k => data[k].label === label);
      return key ? data[key].categories[c] : 0;
    });
  });

  return {
    labels,
    datasets: categories.map(c => ({
      label: c,
      data: categoryCounts[c],
      backgroundColor: getColor(c),
      borderColor: getColor(c),
      fill: isMonthly
    }))
  };
}

// ========================
// COMPARISON SYSTEM
// ========================

// Event listeners for comparison buttons
document.getElementById('compare-days').addEventListener('click', () => {
  const date1 = document.getElementById('first-day').value;
  const date2 = document.getElementById('second-day').value;
  updateComparisonChart([date1, date2]);
});

document.getElementById('compare-weeks').addEventListener('click', () => {
  const week1 = document.getElementById('first-week').value;
  const week2 = document.getElementById('second-week').value;
  updateComparisonChart([`Week ${getWeekNumber(week1)}`, `Week ${getWeekNumber(week2)}`]);
});

document.getElementById('compare-months').addEventListener('click', () => {
  const month1 = document.getElementById('first-month').value;
  const month2 = document.getElementById('second-month').value;
  updateComparisonChart([month1, month2]);
});

// Modified comparison function
function updateComparisonChart(labels) {
  const datasets = [];
  
  labels.forEach(label => {
    let dataPoints = [];
    
    if (label.startsWith('Week')) {
      // Expect label in format "Week <number>"
      const weekNumber = parseInt(label.split(' ')[1]);
      dataPoints = Object.keys(appData.timeData)
        .filter(date => getWeekNumber(date) === weekNumber)
        .flatMap(date => appData.timeData[date]);
    }
    else if (label.includes('-')) { // Direct date comparison
      dataPoints = appData.timeData[label] || [];
    }
    else if (label.includes('/')) { // Month comparison (expects format with '/')
      dataPoints = Object.keys(appData.timeData)
        .filter(date => date.startsWith(label.replace('/', '-')))
        .flatMap(date => appData.timeData[date]);
    }

    categories.forEach(c => {
      datasets.push({
        label: `${label} - ${c}`,
        data: [dataPoints.filter(slot => slot.value === c).length],
        backgroundColor: getColor(c),
        borderColor: getColor(c)
      });
    });
  });

  comparisonChart.data.labels = labels;
  comparisonChart.data.datasets = datasets;
  comparisonChart.update();
}

// ========================
// INITIALIZATION
// ========================

function initializeCharts() {
  [weeklyChart, monthlyChart, comparisonChart].forEach(chart => {
    if (chart) chart.destroy();
  });

  weeklyChart = new Chart(document.getElementById('weekly-chart'), {
    type: 'bar',
    data: getChartData('week'),
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Weekly Category Breakdown' },
        legend: { position: 'bottom' }
      }
    }
  });

  monthlyChart = new Chart(document.getElementById('monthly-chart'), {
    type: 'line',
    data: getChartData('month', true),
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Monthly Progress' },
        legend: { position: 'bottom' }
      }
    }
  });

  comparisonChart = new Chart(document.getElementById('comparison-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Detailed Comparison' },
        legend: { position: 'bottom' }
      }
    }
  });
}

// ========================
// DATE SYNCHRONIZATION
// ========================

function checkDateChange() {
  const currentDate = getCurrentDate();
  if (!appData.timeData[currentDate]) {
    initializeTimeGrid();
    initializeCharts();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeTimeGrid();
  initializeCharts();
  setInterval(checkDateChange, 60000);
  // If autoFillMissedSlots is defined, it will run every 5 minutes.
  if (typeof autoFillMissedSlots === "function") {
    setInterval(autoFillMissedSlots, 300000);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('SW registration failed:', err));
  }

  window.addEventListener('online', () => {
    document.querySelector('.offline-warning').style.display = 'none';
  });
  
  window.addEventListener('offline', () => {
    document.querySelector('.offline-warning').style.display = 'block';
  });
});
