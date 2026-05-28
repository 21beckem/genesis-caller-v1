import { BaseTool } from '../BaseTool.js';

export class SmartThingsTool extends BaseTool {
  constructor() {
    super(
      'SmartThings',
      'Control and check status of SmartThings devices'
    );
  }

  getConfig() {
    return {
      apiKey: '',
      locationId: ''
    };
  }

  getConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'SmartThings API Key',
        type: 'password',
        placeholder: 'Enter your SmartThings API key',
        required: true
      },
      {
        name: 'locationId',
        label: 'Location ID',
        type: 'text',
        placeholder: 'Enter your location ID',
        required: true
      }
    ];
  }

  validateConfig(config) {
    return config.apiKey && config.apiKey.length > 0 && 
           config.locationId && config.locationId.length > 0;
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
          }
        },
        {
          name: 'getDeviceStatus',
          description: 'Get status of a specific device',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device ID'
              }
            },
            required: ['deviceId']
          }
        },
        {
          name: 'controlDevice',
          description: 'Turn a device on or off',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device ID'
              },
              command: {
                type: 'string',
                description: 'Command to execute (on, off, toggle)',
                enum: ['on', 'off', 'toggle']
              }
            },
            required: ['deviceId', 'command']
          }
        }
      ]
    };
  }

  async execute(functionName, args) {
    switch (functionName) {
      case 'getDevices':
        return this._getDevices();
      case 'getDeviceStatus':
        return this._getDeviceStatus(args.deviceId);
      case 'controlDevice':
        return this._controlDevice(args.deviceId, args.command);
      default:
        throw new Error(`Unknown function ${functionName}`);
    }
  }

  async _getDevices() {
    return {
      devices: [
        { id: 'device1', name: 'Living Room Light', type: 'light', status: 'on' },
        { id: 'device2', name: 'Bedroom Light', type: 'light', status: 'off' },
        { id: 'device3', name: 'Front Door Lock', type: 'lock', status: 'locked' }
      ],
      note: 'Demo devices - configure API key for real devices'
    };
  }

  async _getDeviceStatus(deviceId) {
    return {
      deviceId,
      status: 'on',
      note: 'Configure API key to get real device status'
    };
  }

  async _controlDevice(deviceId, command) {
    return {
      deviceId,
      command,
      result: 'success',
      note: 'Configure API key to control real devices'
    };
  }
}
