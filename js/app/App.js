import { StorageManager } from '../storage/StorageManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { UIManager } from '../ui/UIManager.js';
import { GeminiClient } from '../api/GeminiClient.js';
import { AudioHandler } from '../audio/AudioHandler.js';
import { WeatherTool } from '../tools/examples/WeatherTool.js';
import { SmartThingsTool } from '../tools/examples/SmartThingsTool.js';

export class App {
  constructor() {
    this.storage = new StorageManager();
    this.toolManager = new ToolManager(this.storage);
    this.ui = new UIManager();
    this.gemini = null;
    this.audio = new AudioHandler();
    this.isCallActive = false;

    this._registerTools();
    this._setupEventListeners();
  }

  _registerTools() {
    this.toolManager.registerTool(WeatherTool);
    this.toolManager.registerTool(SmartThingsTool);
  }

  _setupEventListeners() {
    document.getElementById('profile-btn').addEventListener('click', () => {
      this.ui.openProfileMenu();
    });

    document.getElementById('settings-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.ui.closeProfileMenu();
      this.ui.showScreen('settings-screen');
      this._populateSettings();
    });

    document.getElementById('tools-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.ui.closeProfileMenu();
      this.ui.showScreen('tools-library-screen');
      this._populateToolsLibrary();
    });

    document.getElementById('start-call-btn').addEventListener('click', () => {
      this.startCall();
    });

    document.getElementById('mute-btn').addEventListener('click', () => {
      this.toggleMute();
    });

    document.getElementById('end-call-btn').addEventListener('click', () => {
      this.endCall();
    });

    document.getElementById('save-api-key-btn').addEventListener('click', () => {
      this._saveSettings();
    });

    Array.from(document.querySelectorAll('.back-btn')).forEach(btn => {
      btn.addEventListener('click', () => {
        this.ui.showScreen(btn.dataset.returnScreen || 'main');
        this._populateToolsLibrary();
      });
    });

    document.addEventListener('click', (e) => {
      const profileMenu = document.getElementById('profile-menu');
      const profileBtn = document.getElementById('profile-btn');

      if (e.target !== profileBtn && !profileBtn.contains(e.target) &&
          e.target !== profileMenu && !profileMenu.contains(e.target)) {
        this.ui.closeProfileMenu();
      }
    });

    document.getElementById('view-usage-link').addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://aistudio.google.com/app/rate-limit', '_blank');
    });
  }

  _populateSettings() {
    const apiKeyInput = document.getElementById('api-key-input');
    const voiceSelect = document.getElementById('voice-select');

    apiKeyInput.value = this.storage.getAPIKey();
    voiceSelect.value = this.storage.getVoice();

    const toolSettingsContainer = document.getElementById('tool-settings-container');
    toolSettingsContainer.innerHTML = '';

    const enabledTools = this.toolManager.getAllTools().filter(tool => {
      const config = this.storage.getToolConfig(tool.name);
      return tool.getConfigFields && tool.getConfigFields().length > 0;
    });

    if (enabledTools.length === 0) {
      toolSettingsContainer.innerHTML = '<p style="color: #999;">No tools requiring configuration</p>';
      return;
    }

    enabledTools.forEach(tool => {
      const toolItem = document.createElement('button');
      toolItem.className = 'tool-settings-item';
      toolItem.textContent = tool.name;
      toolItem.addEventListener('click', () => {
        this._showToolSettings(tool.name, 'settings-screen');
      });
      toolSettingsContainer.appendChild(toolItem);
    });
  }

  _saveSettings() {
    const apiKeyInput = document.getElementById('api-key-input');
    const voiceSelect = document.getElementById('voice-select');

    this.storage.setAPIKey(apiKeyInput.value);
    this.storage.setVoice(voiceSelect.value);

    alert('Settings saved!');
  }

  _showToolSettings(toolName, returnScreen='main') {
    const tool = this.toolManager.getTool(toolName);
    const fields = tool.getConfigFields();
    const config = this.storage.getToolConfig(toolName);

    document.getElementById('back-from-tool-settings-btn').dataset.returnScreen = returnScreen;
    this.ui.showScreen('tool-settings-screen');

    const toolSettingsTitle = document.getElementById('tool-settings-title');
    toolSettingsTitle.textContent = `${toolName} Settings`;

    const fieldsContainer = document.getElementById('tool-fields-container');
    fieldsContainer.innerHTML = '';

    fields.forEach(field => {
      if (field.type === 'span') {
        const span = document.createElement('span');
        span.textContent = field.text;
        fieldsContainer.appendChild(span);
        if (typeof field.style === 'string') {
          span.style.cssText = field.style;
        }
        return;
      }
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = field.type || 'text';
      input.placeholder = field.placeholder || '';
      input.value = config[field.name] || '';
      input.dataset.fieldName = field.name;

      group.appendChild(label);
      group.appendChild(input);
      fieldsContainer.appendChild(group);
    });

    const saveBtn = document.getElementById('save-tool-settings-btn');
    saveBtn.onclick = () => {
      const newConfig = {};
      fields.forEach(field => {
        const input = fieldsContainer.querySelector(`input[data-field-name="${field.name}"]`);
        newConfig[field.name] = input.value;
      });

      if (this.toolManager.setToolConfig(toolName, newConfig)) {
        alert(`${toolName} settings saved!`);
        this.ui.showScreen(returnScreen);
        this._populateSettings();
      } else {
        alert('Invalid configuration');
      }
    };
  }

  _populateToolsLibrary() {
    const toolsContainer = document.getElementById('tools-list-container');
    toolsContainer.innerHTML = '';

    const tools = this.toolManager.getAllTools();
    tools.forEach(tool => {
      const toolItem = document.createElement('div');
      toolItem.className = 'tool-item';

      const toolName = document.createElement('div');
      toolName.className = 'tool-name';
      toolName.textContent = tool.name;
      toolName.dataset.toolName = tool.name;
      toolName.addEventListener('click', () => this._showToolPopup(tool.name));

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = this.storage.isToolEnabled(tool.name);
      toggle.addEventListener('change', () => {
        this.toolManager.toggleTool(tool.name, toggle.checked);
      });

      toolItem.appendChild(toolName);
      toolItem.appendChild(toggle);
      toolsContainer.appendChild(toolItem);
    });
  }

  _showToolPopup(toolName) {
    const tool = this.toolManager.getTool(toolName);
    const popup = document.getElementById('tool-popup');
    const hasSettings = tool.getConfigFields && tool.getConfigFields().length > 0;

    document.getElementById('tool-popup-name').textContent = tool.name;
    document.getElementById('tool-popup-description').textContent = tool.description;

    const popupToggle = document.getElementById('tool-popup-toggle');
    popupToggle.checked = this.storage.isToolEnabled(tool.name);
    popupToggle.addEventListener('change', () => {
      this.toolManager.toggleTool(tool.name, popupToggle.checked);
    });

    const settingsLink = document.getElementById('tool-popup-settings-link');
    if (hasSettings) {
      settingsLink.style.display = 'block';
      settingsLink.onclick = (e) => {
        e.preventDefault();
        popup.style.display = 'none';
        this._showToolSettings(toolName, 'tools-library-screen');
      };
    } else {
      settingsLink.style.display = 'none';
    }

    popup.style.display = 'flex';
  }

  async startCall() {
    const apiKey = this.storage.getAPIKey();
    if (!apiKey) {
      alert('Please set your Gemini API key in settings');
      this.ui.showScreen('settings-screen');
      this._populateSettings();
      return;
    }

    try {
      this.isCallActive = true;
      this.ui.setCallActive(true);
      this.ui.clearTranscript();
      this.storage.clearTranscript();

      this.gemini = GeminiClient.fromObject({
        apiKey,
        toolManager: this.toolManager,
        audio: this.audio,
        ui: this.ui
      });
      const voice = this.storage.getVoice();

      await this.gemini.connect(voice, onClose => {
        if (!this.isCallActive) return;
        this.ui.addTranscriptMessage('system', 'Call ended by Gemini');
        this.endCall();
      });
      await this.audio.startRecording((chunk) => {
        void this.gemini.sendAudioChunk(chunk).catch((error) => {
          console.error('Failed to send audio chunk:', error);
          this.endCall();
        });
      });

      this.ui.addTranscriptMessage('system', 'Call started. Streaming audio live...');
    } catch (error) {
      alert(`Failed to start call: ${error.message}`);
      this.isCallActive = false;
      this.ui.setCallActive(false);
    }
  }

  async _handleToolCall(toolCallData) {
    const { tool_name, tool_calls } = toolCallData;

    for (const call of tool_calls) {
      this.ui.addTranscriptToolCall(tool_name, call.name, call.args);

      try {
        const result = await this.toolManager.executeTool(tool_name, call.name, call.args);
        this.ui.addTranscriptToolResult(tool_name, result);
      } catch (error) {
        this.ui.addTranscriptToolResult(tool_name, { error: error.message });
      }
    }

    await this.gemini.processToolCall(toolCallData);
  }

  toggleMute() {
    if (this.audio.isMuted()) {
      this.audio.unmute();
      this.ui.setMuted(false);
    } else {
      this.audio.mute();
      this.ui.setMuted(true);
    }
  }

  async endCall() {
    this.audio.stopAudioPlayback();
    try {
      if (this.audio.isRecording) {
        await this.audio.stopRecording();
      }

      if (this.gemini) {
        this.gemini.disconnect();
      }

      this.isCallActive = false;
      this.ui.setCallActive(false);
      this.ui.addTranscriptMessage('system', 'Call ended.');
      this.storage.setTranscript(this.ui.transcript);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
