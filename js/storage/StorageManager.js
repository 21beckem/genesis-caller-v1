export class StorageManager {
  constructor() {
    this.PREFIX = 'genesis_';
  }

  setAPIKey(key) {
    localStorage.setItem(this.PREFIX + 'api_key', key);
  }

  getAPIKey() {
    return localStorage.getItem(this.PREFIX + 'api_key') || '';
  }

  setVoice(voice) {
    localStorage.setItem(this.PREFIX + 'voice', voice);
  }

  getVoice() {
    return localStorage.getItem(this.PREFIX + 'voice') || 'Puck';
  }

  setThinkingLevel(level) {
    localStorage.setItem(this.PREFIX + 'thinking_level', level);
  }

  getThinkingLevel() {
    return localStorage.getItem(this.PREFIX + 'thinking_level') || 'disabled';
  }

  setToolEnabled(toolName, enabled) {
    localStorage.setItem(this.PREFIX + 'tool_' + toolName + '_enabled', enabled ? '1' : '0');
  }

  isToolEnabled(toolName) {
    return localStorage.getItem(this.PREFIX + 'tool_' + toolName + '_enabled') !== '0';
  }

  setToolConfig(toolName, config) {
    localStorage.setItem(this.PREFIX + 'tool_' + toolName + '_config', JSON.stringify(config));
  }

  getToolConfig(toolName) {
    const stored = localStorage.getItem(this.PREFIX + 'tool_' + toolName + '_config');
    return stored ? JSON.parse(stored) : {};
  }

  setTranscript(transcript) {
    sessionStorage.setItem(this.PREFIX + 'transcript', JSON.stringify(transcript));
  }

  getTranscript() {
    const stored = sessionStorage.getItem(this.PREFIX + 'transcript');
    return stored ? JSON.parse(stored) : [];
  }

  clearTranscript() {
    sessionStorage.removeItem(this.PREFIX + 'transcript');
  }
}
