import { BaseTool } from '../BaseTool.js';

export class WeatherTool extends BaseTool {
  constructor() {
    super(
      'Weather',
      'Get current weather information for a location'
    );
  }

  getConfig() {
    return {
      apiKey: ''
    };
  }

  getConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'Weather API Key',
        type: 'password',
        placeholder: 'Enter your OpenWeather API key',
        required: true
      }
    ];
  }

  validateConfig(config) {
    return config.apiKey && config.apiKey.length > 0;
  }

  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      functions: [
        {
          name: 'getWeather',
          description: 'Get current weather for a city',
          inputSchema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'City name'
              },
              units: {
                type: 'string',
                description: 'Temperature units (metric, imperial)',
                enum: ['metric', 'imperial']
              }
            },
            required: ['city']
          }
        }
      ]
    };
  }

  async execute(functionName, args) {
    if (functionName === 'getWeather') {
      return this._getWeather(args.city, args.units || 'metric');
    }
    throw new Error(`Unknown function ${functionName}`);
  }

  async _getWeather(city, units) {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${this.config.apiKey}`
      );

      if (!response.ok) {
        return { error: 'City not found' };
      }

      const data = await response.json();
      return {
        city: data.name,
        temperature: data.main.temp,
        description: data.weather[0].main,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        units: units
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}
