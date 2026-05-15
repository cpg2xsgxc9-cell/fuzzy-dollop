// ─── Config ───
const MODES = {
  work: { label: '专注', minutes: 25, color: '#e74c3c' },
  shortBreak: { label: '短休息', minutes: 5, color: '#27ae60' },
  longBreak: { label: '长休息', minutes: 15, color: '#2980b9' }
};

const CIRCUMFERENCE = 2 * Math.PI * 54; // 339.292

// ─── State ───
let currentMode = 'work';
let timeLeft = MODES.work.minutes * 60;
let totalTime = timeLeft;
let isRunning = false;
let interval = null;
let pomodoroCount = 0;
let cycleCount = 0;
let autoStart = false;
let soundEnabled = true;

// ─── Elements ───
const els = {
  time: document.querySelector('.time'),
  status: document.querySelector('.status'),
  progressFill: document.querySelector('.progress-ring-fill'),
  tabs: document.querySelectorAll('.tab'),
  btnToggle: document.getElementById('btn-toggle'),
  btnReset: document.getElementById('btn-reset'),
  btnSkip: document.getElementById('btn-skip'),
  btnText: document.querySelector('.btn-text'),
  pomodoroCount: document.getElementById('pomodoro-count'),
  cycleCount: document.getElementById('cycle-count'),
  autoStart: document.getElementById('auto-start'),
  soundEnabled: document.getElementById('sound-enabled'),
  app: document.querySelector('.app')
};

// ─── Audio ───
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep() {
  if (!soundEnabled) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {}
}

function playDone() {
  if (!soundEnabled) return;
  try {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.4);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.4);
    });
  } catch {}
}

// ─── Formatting ───
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTitle() {
  document.title = `${fmtTime(timeLeft)} - ${MODES[currentMode].label}`;
  if (window.electronAPI) {
    window.electronAPI.updateTrayTitle(fmtTime(timeLeft));
  }
}

function updateProgress() {
  const offset = CIRCUMFERENCE * (1 - timeLeft / totalTime);
  els.progressFill.style.strokeDashoffset = offset;
}

function updateDisplay() {
  els.time.textContent = fmtTime(timeLeft);
  updateProgress();
  updateTitle();
}

// ─── Mode switching ───
function setMode(mode) {
  currentMode = mode;
  timeLeft = MODES[mode].minutes * 60;
  totalTime = timeLeft;
  isRunning = false;
  clearInterval(interval);
  interval = null;

  els.tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });

  els.app.className = 'app mode-' + mode;
  els.progressFill.style.stroke = MODES[mode].color;
  els.status.textContent = '准备开始';
  els.btnText.textContent = '开始';
  updateDisplay();
}

function switchToNextMode() {
  if (currentMode === 'work') {
    pomodoroCount++;
    els.pomodoroCount.textContent = pomodoroCount;
    if (pomodoroCount % 4 === 0) {
      setMode('longBreak');
    } else {
      setMode('shortBreak');
    }
    cycleCount = Math.floor(pomodoroCount / 4);
    els.cycleCount.textContent = cycleCount;
  } else {
    setMode('work');
  }
  if (autoStart) startTimer();
}

// ─── Timer control ───
function onTick() {
  timeLeft--;
  if (timeLeft <= 0) {
    timeLeft = 0;
    clearInterval(interval);
    interval = null;
    isRunning = false;
    els.btnText.textContent = '开始';
    els.status.textContent = '已完成';
    playDone();
    if (window.electronAPI) {
      window.electronAPI.notify(
        `${MODES[currentMode].label}结束`,
        currentMode === 'work' ? '该休息一下了' : '准备开始新的专注'
      );
    }
    setTimeout(switchToNextMode, 1000);
  }
  updateDisplay();
}

function startTimer() {
  if (isRunning) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isRunning = true;
  els.status.textContent = currentMode === 'work' ? '专注中...' : '休息中...';
  els.btnText.textContent = '暂停';
  playBeep();
  interval = setInterval(onTick, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(interval);
  interval = null;
  els.status.textContent = '已暂停';
  els.btnText.textContent = '继续';
}

function resetTimer() {
  isRunning = false;
  clearInterval(interval);
  interval = null;
  timeLeft = MODES[currentMode].minutes * 60;
  totalTime = timeLeft;
  els.status.textContent = '准备开始';
  els.btnText.textContent = '开始';
  updateDisplay();
}

function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function skipTimer() {
  isRunning = false;
  clearInterval(interval);
  interval = null;
  switchToNextMode();
}

// ─── Events ───
els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (isRunning && !confirm('切换模式将重置当前计时，是否继续？')) return;
    setMode(tab.dataset.mode);
  });
});

els.btnToggle.addEventListener('click', toggleTimer);
els.btnReset.addEventListener('click', resetTimer);
els.btnSkip.addEventListener('click', skipTimer);

els.autoStart.addEventListener('change', (e) => {
  autoStart = e.target.checked;
});

els.soundEnabled.addEventListener('change', (e) => {
  soundEnabled = e.target.checked;
});

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    toggleTimer();
  } else if (e.code === 'Escape') {
    resetTimer();
  }
});

// ─── Init ───
updateDisplay();
