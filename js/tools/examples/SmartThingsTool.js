import { BaseTool } from '../BaseTool.js';

export class SmartThingsTool extends BaseTool {
  #helper;
  #devicesList = [];
  constructor() {
    super(
      'SmartThings',
      'Control and check status of SmartThings devices'
    );
  }

  configUpdated(config) {
    this.#helper = new SmartThingsHelper({
      token: config.accessToken
    });
    window.smartThingsHelper = this.#helper; // Expose for debugging
    this.#devicesList = []; // Clear cache on config update
    this.#helper.listDevices().then(devices => {
      this.#devicesList = devices;
    }).catch(err => {
      console.error('Failed to load SmartThings devices:', err);
    });
  }

  getConfig() {
    return {
      accessToken: ''
    };
  }

  getConfigFields() {
    return [
      {
        name: 'accessToken',
        label: 'SmartThings Access Token',
        type: 'password',
        placeholder: 'Enter your SmartThings Access Token',
        required: true
      },
      {
        type: 'span',
        text: 'Your access token can be generated on the SmartThings website at https://account.smartthings.com/tokens. It needs the "Devices" scope at minimum.',
        style: 'display: block; opacity: 0.8; font-size: small;'
      }
    ];
  }

  validateConfig(config) {
    return config.accessToken && config.accessToken.length > 0;
  }

  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      functions: [
        {
          name: 'getDevices',
          description: 'List all SmartThings devices',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          },
          execute: () => ({ devices: this.#devicesList })
        },
        {
          name: 'getDeviceStatusOnOffStatus',
          description: 'Get status of a specific device',
          inputSchema: {
            type: 'object',
            properties: {
              deviceName: {
                type: 'string',
                description: 'Device Name (as listed in getDevices)',
                enum: this.#devicesList.map(d => d.label)
              }
            },
            required: ['deviceName']
          },
          execute: ({ deviceName }) => this.#getDeviceStatusOnOffStatus(deviceName)
        },
        {
          name: 'turnDeviceOnOrOff',
          description: 'Turn a device on or off',
          inputSchema: {
            type: 'object',
            properties: {
              deviceName: {
                type: 'string',
                description: 'Device Name (as listed in getDevices)',
                enum: this.#devicesList.map(d => d.label)
              },
              command: {
                type: 'string',
                description: 'Command to execute (on, off)',
                enum: ['on', 'off']
              }
            },
            required: ['deviceName', 'command']
          },
          execute: ({ deviceName, command }) => this.#turnDeviceOnOrOff(deviceName, command)
        }
      ]
    };
  }

  #getDeviceByName(name) {
    return this.#devicesList.find(d => d.label === name);
  }

  async #getDeviceStatusOnOffStatus(deviceName) {
    const device = this.#getDeviceByName(deviceName);
    if (!device) {
      return { error: `Device "${deviceName}" not found` };
    }
    let status;
    try {
      status = await this.#helper.getDeviceState(device.deviceId);
    } catch (err) {
      return { error: 'Failed to get device status' };
    }

    return {
      deviceName,
      onOffStatus: status?.components?.main?.switch?.value || 'unknown'
    };
  }

  async #turnDeviceOnOrOff(deviceName, command) {
    const device = this.#getDeviceByName(deviceName);
    if (!device) {
      return { error: `Device "${deviceName}" not found` };
    }
    
    try {
      await this.#helper.setSwitch(device.deviceId, command === 'on');
    } catch (err) {
      return { error: 'Failed to send command to device' };
    }

    return {
      deviceName,
      command,
      result: 'success'
    };
  }
}








const API_BASE = 'https://api.smartthings.com/v1';

class SmartThingsHelper {
  /**
   * @param {{ token?: string, apiBase?: string }} opts
   * Provide token or set SMARTTHINGS_TOKEN env var.
   */
  #token;
  #apiBase;
  constructor(opts = {}) {
    this.#token = opts.token || false;
    if (!this.#token) return console.warn('SmartThings token not provided. Nothing will work.');
    console.log('SmartThings token loaded.');
    this.#apiBase = opts.apiBase || API_BASE;
  }

  async #request(path, { method = 'GET', body } = {}) {
    const url = `${this.#apiBase}${path}`;
    const headers = {
      Authorization: `Bearer ${this.#token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // If no content (204), return null
    if (res.status === 204) return null;

    let payload;
    try {
      payload = await res.json();
    } catch (err) {
      // If response not JSON, still throw with status text
      const text = await res.text().catch(() => '');
      throw new Error(`SmartThings ${method} ${path} failed: ${res.status} ${res.statusText} — ${text}`);
    }

    if (!res.ok) {
      // Try to include useful error info
      const errMsg = payload?.message || JSON.stringify(payload);
      throw new Error(`SmartThings ${method} ${path} failed: ${res.status} ${res.statusText} — ${errMsg}`);
    }

    return payload;
  }

  #noToken() {
    if (!this.#token) {
      console.error('SmartThings token not configured');
      return false;
    }
    return true;
  }

  /** List all devices (returns array of device metadata objects) */
  async listDevices() {
    if (!this.#noToken()) return [];
    const data = await this.#request('/devices');
    // API returns { items: [...] }
    return data.items || [];
  }

  /** Get device metadata (capabilities, label, deviceId, etc) */
  async getDevice(deviceId) {
    if (!this.#noToken()) return null;
    return this.#request(`/devices/${encodeURIComponent(deviceId)}`);
  }

  /**
   * Get device *state* (current attributes).
   * Normalizes the SmartThings /devices/{id}/status response into:
   * { components: { <componentName>: { <capability>: { <attribute>: value, ... }, ... } } }
   *
   * Also returns a flattened quick map under .flat like:
   * { "<capability>.<attribute>": value, ... }  (eg "switch.switch": "on")
   */
  async getDeviceState(deviceId) {
    if (!this.#noToken()) return null;
    const raw = await this.#request(`/devices/${encodeURIComponent(deviceId)}/status`);
    // Raw structure: { components: { main: { capabilities: { switch: { switch: [ { value, timestamp } ] }, ... } } } }
    const normalized = { components: {} };
    const flat = {};

    return raw;
  }

  /**
   * Generic command sender.
   * capability: e.g. 'switch', 'switchLevel', 'colorControl'
   * command: e.g. 'on', 'off', 'setLevel', ...
   * args: array of arguments (e.g. [50] for setLevel)
   *
   * Returns the HTTP response payload (null for 204).
   */
  async setDeviceState(deviceId, capability, command, args = []) {
    if (!this.#noToken()) return null;
    const body = {
      commands: [
        {
          component: 'main',
          capability,
          command,
          arguments: args,
        },
      ],
    };

    // POST /devices/{deviceId}/commands
    return this.#request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
      method: 'POST',
      body,
    });
  }

  // Convenience shortcuts
  async setSwitch(deviceId, on = true) {
    if (!this.#noToken()) return null;
    return this.setDeviceState(deviceId, 'switch', on ? 'on' : 'off', []);
  }

  /**
   * level: 0-100
   */
  async setLevel(deviceId, level = 100) {
    if (!this.#noToken()) return null;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      throw new Error('level must be a number between 0 and 100');
    }
    return this.setDeviceState(deviceId, 'switchLevel', 'setLevel', [Math.round(level)]);
  }
}

export default SmartThingsHelper;