export class UIManager {
  constructor() {
    this.currentScreen = 'main';
    this.transcript = [];
    this.isCallActive = false;
    this.isMuted = false;
  }

  showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.style.display = 'none';
    });

    const screen = document.getElementById(screenName);
    if (screen) {
      screen.style.display = 'flex';
      this.currentScreen = screenName;
    }
  }

  setCallActive(active) {
    this.isCallActive = active;
    const controlsRow = document.getElementById('controls-row');
    const callControls = document.getElementById('call-controls');
    const normalControls = document.getElementById('normal-controls');

    if (active) {
      controlsRow.style.display = 'flex';
      callControls.style.display = 'flex';
      normalControls.style.display = 'none';
    } else {
      controlsRow.style.display = 'flex';
      callControls.style.display = 'none';
      normalControls.style.display = 'flex';
    }
  }

  addTranscriptMessage(role, message) {
    this.transcript.push({ role, message });
    this._updateTranscriptDisplay();
    return this.transcript.length - 1; // Return index of the new message
  }

  appendToTranscriptMessageById(index, message) {
    if (index < 0 || index >= this.transcript.length) return;
    this.transcript[index].message += message;
    this._updateTranscriptDisplay();
  }

  addTranscriptToolCall(toolName, functionName, args) {
    this.transcript.push({
      role: 'system',
      message: `<strong>Calling ${toolName}.${functionName}</strong>`,
      isToolCall: true
    });
    this._updateTranscriptDisplay();
  }

  addTranscriptToolResult(toolName, result) {
    this.transcript.push({
      role: 'system',
      message: `<strong>${toolName} result:</strong> ${JSON.stringify(result)}`,
      isToolResult: true
    });
    this._updateTranscriptDisplay();
  }

  clearTranscript() {
    this.transcript = [];
    this._updateTranscriptDisplay();
  }

  _updateTranscriptDisplay() {
    const container = document.getElementById('transcript-container');
    if (!container) return;

    container.innerHTML = '';

    this.transcript.forEach(item => {
      const messageEl = document.createElement('div');
      messageEl.className = `transcript-message ${item.role}`;

      if (item.isToolCall || item.isToolResult) {
        messageEl.innerHTML = item.message;
      } else {
        messageEl.textContent = item.message;
      }

      container.appendChild(messageEl);
    });

    container.scrollTop = container.scrollHeight;
  }

  setMuted(muted) {
    this.isMuted = muted;
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.innerHTML = muted
        ? '<i class="fas fa-microphone-slash"></i>'
        : '<i class="fas fa-microphone"></i>';
    }
  }

  openProfileMenu() {
    const menu = document.getElementById('profile-menu');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  }

  closeProfileMenu() {
    const menu = document.getElementById('profile-menu');
    menu.style.display = 'none';
  }

  closeAllPopups() {
    document.querySelectorAll('.popup').forEach(popup => {
      popup.style.display = 'none';
    });
  }
}
