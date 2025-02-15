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
      initializeCharts();
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
  initializeCharts();
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

function getWeekNumber(dateString) {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function getWeeklyData() {
  const weeks = {};
  Object.keys(appData.timeData).forEach(date => {
    const weekNumber = getWeekNumber(date);
    if (!weeks[weekNumber]) {
      weeks[weekNumber] = { productive: 0, missed: 0 };
    }
    
    appData.timeData[date].forEach(slot => {
      if (slot.value && slot.value !== 'F') weeks[weekNumber].productive++;
      if (slot.value === 'F') weeks[weekNumber].missed++;
    });
  });

  const labels = Object.keys(weeks).sort().map(w => `Week ${w}`);
  return {
    labels,
    datasets: [
      {
        label: 'Productive Slots',
        data: labels.map(w => weeks[w.split(' ')[1]].productive),
        backgroundColor: 'rgba(75, 192, 192, 0.5)'
      },
      {
        label: 'Missed Slots',
        data: labels.map(w => weeks[w.split(' ')[1]].missed),
        backgroundColor: 'rgba(255, 99, 132, 0.5)'
      }
    ]
  };
}

function getMonthlyData() {
  const months = {};
  Object.keys(appData.timeData).forEach(date => {
    const month = date.substring(0, 7);
    if (!months[month]) {
      months[month] = { productive: 0, missed: 0 };
    }
    
    appData.timeData[date].forEach(slot => {
      if (slot.value && slot.value !== 'F') months[month].productive++;
      if (slot.value === 'F') months[month].missed++;
    });
  });

  const labels = Object.keys(months).sort();
  return {
    labels,
    datasets: [
      {
        label: 'Productive Slots',
        data: labels.map(m => months[m].productive),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true
      },
      {
        label: 'Missed Slots',
        data: labels.map(m => months[m].missed),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true
      }
    ]
  };
}

function chartOptions(title) {
  return {
    responsive: true,
    plugins: {
      title: { display: true, text: title },
      legend: { position: 'bottom' }
    }
  };
}

// ========================
// COMPARISON SYSTEM
// ========================

function getRandomColor() {
  return `hsl(${Math.random() * 360}, 70%, 50%)`;
}

function updateComparisonChart(labels) {
  const datasets = labels.map(label => {
    let dataPoints = [];
    if (label.startsWith('Week')) {
      const weekNumber = label.split(' ')[1];
      dataPoints = Object.keys(appData.timeData)
        .filter(date => getWeekNumber(date) === parseInt(weekNumber))
        .flatMap(date => appData.timeData[date]);
    } else if (label.includes('-')) { // Month format YYYY-MM
      dataPoints = Object.keys(appData.timeData)
        .filter(date => date.startsWith(label))
        .flatMap(date => appData.timeData[date]);
    } else { // Daily comparison
      dataPoints = appData.timeData[label] || [];
    }

    return {
      label: `${label} (Productive)`,
      data: [dataPoints.filter(slot => slot.value && slot.value !== 'F').length],
      backgroundColor: getRandomColor()
    };
  });

  comparisonChart.data.labels = labels;
  comparisonChart.data.datasets = datasets;
  comparisonChart.update();
}

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

// ========================
// INITIALIZATION
// ========================

function initializeCharts() {
  [weeklyChart, monthlyChart, comparisonChart].forEach(chart => {
    if (chart) chart.destroy();
  });

  weeklyChart = new Chart(document.getElementById('weekly-chart'), {
    type: 'bar',
    data: getWeeklyData(),
    options: chartOptions('Weekly Activity Distribution')
  });

  monthlyChart = new Chart(document.getElementById('monthly-chart'), {
    type: 'line',
    data: getMonthlyData(),
    options: chartOptions('Monthly Progress')
  });

  comparisonChart = new Chart(document.getElementById('comparison-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: chartOptions('Comparison View')
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeTimeGrid();
  initializeCharts();
  setInterval(autoFillMissedSlots, 300000);
  
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
