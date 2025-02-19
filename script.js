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
    // Sleep hours covering 12:30 AM - 6:00 AM means
    // index 1 to index 12 in the 48 half-hour intervals
    sleepHours: { start: 1, end: 12 }
  },
  timeData: JSON.parse(localStorage.getItem('timeTrackerData')) || {}
};

function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function saveToStorage() {
  localStorage.setItem('timeTrackerData', JSON.stringify(appData.timeData));
  // Attempt to persist storage if the browser supports it
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
  
  // If today's date doesn't exist in timeData, initialize it
  if (!appData.timeData[currentDate]) {
    appData.timeData[currentDate] = timeIntervals.map((time, index) => ({
      time,
      value: (index >= appData.settings.sleepHours.start && 
              index <= appData.settings.sleepHours.end) ? 'S' : null,
      timestamp: null
    }));
    saveToStorage();
  }

  // Build the time grid in the DOM
  appData.timeData[currentDate].forEach((slot, index) => {
    const gridItem = document.createElement('div');
    gridItem.className = `grid-item ${slot.value ? 'filled' : ''}`;
    gridItem.textContent = slot.value ? `${slot.time} - ${slot.value}` : slot.time;
    if (slot.value) gridItem.dataset.value = slot.value;
    
    // Handle slot click
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
  if (index >= appData.settings.sleepHours.start && index <= appData.settings.sleepHours.end) {
    alert("Sleep hours cannot be edited");
    return;
  }

  const now = new Date();
  // Build the Date object for the chosen slot
  const slotTime = new Date();
  slotTime.setHours(Math.floor(index / 2));
  slotTime.setMinutes(index % 2 === 0 ? 0 : 30);
  
  // The user can only edit the slot around the actual time
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
    A: '#4CAF50',  // Green
    B: '#2196F3',  // Blue
    C: '#9C27B0',  // Purple
    D: '#FF9800',  // Orange
    E: '#E91E63',  // Pink
    F: '#F44336',  // Red
    S: '#607D8B'   // Grey/Blue
  };
  return colors[value];
}

// Helper to get the ISO week number from a "YYYY-MM-DD" string
function getWeekNumber(dateString) {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  // Move to the nearest Thursday: current date + 4 - current day number
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

// Summarize data for weekly or monthly charts
function getChartData(timePeriod, isMonthly = false) {
  const data = {};
  const categoryCounts = {};
  
  // Gather data by either week or month
  Object.keys(appData.timeData).forEach(date => {
    const key = isMonthly 
      ? date.substring(0, 7)          // "YYYY-MM"
      : getWeekNumber(date);          // Week number
    if (!data[key]) {
      data[key] = {
        label: isMonthly ? key : `Week ${key}`,
        categories: {}
      };
      categories.forEach(c => data[key].categories[c] = 0);
    }
    appData.timeData[date].forEach(slot => {
      if (slot.value) {
        data[key].categories[slot.value]++;
      }
    });
  });

  // Sort labels in ascending order
  const labels = Object.keys(data).sort().map(k => data[k].label);

  // For each category, build an array of counts
  categories.forEach(c => {
    categoryCounts[c] = labels.map(label => {
      const key = Object.keys(data).find(k => data[k].label === label);
      return key ? data[key].categories[c] : 0;
    });
  });

  // Return a Chart.js-friendly data object
  return {
    labels,
    datasets: categories.map(c => ({
      label: c,
      data: categoryCounts[c],
      backgroundColor: getColor(c),
      borderColor: getColor(c),
      fill: isMonthly // For monthly, we might do a filled line chart
    }))
  };
}

// ========================
// COMPARISON SYSTEM
// ========================

// Attach event listeners for Day, Week, and Month comparison buttons
document.getElementById('compare-days').addEventListener('click', () => {
  const date1 = document.getElementById('first-day').value;   // "YYYY-MM-DD"
  const date2 = document.getElementById('second-day').value;  // "YYYY-MM-DD"
  updateComparisonChart([date1, date2]);
});

document.getElementById('compare-weeks').addEventListener('click', () => {
  const week1 = document.getElementById('first-week').value;  // "YYYY-W##"
  const week2 = document.getElementById('second-week').value; // "YYYY-W##"
  updateComparisonChart([week1, week2]);
});

document.getElementById('compare-months').addEventListener('click', () => {
  const month1 = document.getElementById('first-month').value; // "YYYY-MM"
  const month2 = document.getElementById('second-month').value;// "YYYY-MM"
  updateComparisonChart([month1, month2]);
});

/**
 * updateComparisonChart
 * 
 * - Day comparison uses "YYYY-MM-DD"
 * - Week comparison uses "YYYY-W##" (like "2025-W05")
 * - Month comparison uses "YYYY-MM"
 */
function updateComparisonChart(labels) {
  const datasets = [];
  
  labels.forEach(label => {
    let dataPoints = [];

    // 1) Week comparison => "YYYY-W##"
    if (label.includes('W')) {
      const [year, weekStr] = label.split('-W'); // e.g. "2025" and "05"
      const weekNumber = parseInt(weekStr);
      dataPoints = Object.keys(appData.timeData)
        .filter(dateStr => {
          const d = new Date(dateStr);
          return d.getFullYear() === parseInt(year) && getWeekNumber(dateStr) === weekNumber;
        })
        .flatMap(dateStr => appData.timeData[dateStr]);

    // 2) Day comparison => "YYYY-MM-DD" (length == 10)
    } else if (label.length === 10) {
      dataPoints = appData.timeData[label] || [];

    // 3) Month comparison => "YYYY-MM" (length == 7)
    } else if (label.length === 7) {
      dataPoints = Object.keys(appData.timeData)
        .filter(dateStr => dateStr.startsWith(label))
        .flatMap(dateStr => appData.timeData[dateStr]);
    }

    // Build dataset for each category
    categories.forEach(c => {
      datasets.push({
        label: `${label} - ${c}`,
        data: [dataPoints.filter(slot => slot.value === c).length],
        backgroundColor: getColor(c),
        borderColor: getColor(c)
      });
    });
  });

  // Update the chart
  comparisonChart.data.labels = labels;
  comparisonChart.data.datasets = datasets;
  comparisonChart.update();
}

// ========================
// INITIALIZATION
// ========================

function initializeCharts() {
  // Destroy old charts if they exist
  [weeklyChart, monthlyChart, comparisonChart].forEach(chart => {
    if (chart) chart.destroy();
  });

  // Weekly bar chart
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

  // Monthly line chart
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

  // Comparison bar chart (initially empty)
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

// Check if the date changed (new day) and re-initialize if so
function checkDateChange() {
  const currentDate = getCurrentDate();
  if (!appData.timeData[currentDate]) {
    initializeTimeGrid();
    initializeCharts();
  }
}

// On DOM load, initialize the grid and charts
document.addEventListener('DOMContentLoaded', () => {
  initializeTimeGrid();
  initializeCharts();
  
  // Check date change every 60 seconds
  setInterval(checkDateChange, 60000);

  // If you have a function to auto-fill missed slots, you can run it periodically:
  // if (typeof autoFillMissedSlots === "function") {
  //   setInterval(autoFillMissedSlots, 300000);
  // }

  // Register Service Worker (if supported)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('SW registration failed:', err));
  }

  // Offline/Online event listeners
  window.addEventListener('online', () => {
    document.querySelector('.offline-warning').style.display = 'none';
  });
  
  window.addEventListener('offline', () => {
    document.querySelector('.offline-warning').style.display = 'block';
  });
});
