# Genesis Caller

A web application that allows you to call Google Gemini's speech-to-speech API with a tools system.

## Features

- 🎤 Speech-to-speech communication with Gemini 2.0 Flash Live API
- 🛠️ Extensible tools system with enable/disable toggles
- ⚙️ Tool-specific configuration panels
- 🎵 Voice selection and thinking level settings
- 💾 Local storage for API keys and settings
- 📱 Mobile-first responsive design
- 🎨 Clean, modern UI with Font Awesome icons

## Setup

### 1. Get Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key for the Gemini API
3. Keep this key safe - you'll paste it into the app settings

### 2. Run a Local Server

Since the app uses Web Audio APIs, it must be served over HTTPS or localhost. Choose one:

**Option A: Python 3**
```bash
python -m http.server 8000
```

**Option B: Node.js (http-server)**
```bash
npx http-server
```

**Option C: Any simple HTTP server on port 8000**

Then open `http://localhost:8000` in your browser.

### 3. Configure Settings

1. Click the profile icon (👤) in the top right
2. Click "Settings"
3. Paste your Gemini API key
4. Select your preferred voice and thinking level
5. Click "Save Settings"

## Using the App

### Making a Call

1. Click "Start Call" to begin a new conversation
2. The transcript will clear and the call will initialize
3. Click "Continue" to send your audio input
4. Wait for Gemini to respond with audio
5. Repeat to continue the conversation
6. Click "End Call" to finish

### Managing Tools

1. Click the profile icon (👤)
2. Click "Tool Library"
3. Toggle tools on/off to enable or disable them
4. Click a tool name to see its description
5. If a tool has settings, click the settings link in the popup

### Tool Settings

Some tools require configuration (like API keys). To configure a tool:

1. Go to Settings
2. Under "Tool Settings", click the tool name
3. Fill in the required fields
4. Click "Save Tool Settings"

## Creating New Tools

### Quick Start

1. Create a new file in `js/tools/examples/` (or a new folder for your tool)
2. Extend the `BaseTool` class
3. Register it in `App.js`

### Example Tool Template

```javascript
import { BaseTool } from '../BaseTool.js';

export class MyTool extends BaseTool {
  constructor() {
    super(
      'My Tool Name',
      'Description of what this tool does'
    );
  }

  // Return default configuration object
  getConfig() {
    return {
      apiKey: '',
      userId: ''
    };
  }

  // Define configuration fields shown in settings
  getConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your API key',
        required: true
      },
      {
        name: 'userId',
        label: 'User ID',
        type: 'text',
        placeholder: 'Enter your user ID',
        required: true
      }
    ];
  }

  // Validate configuration before saving
  validateConfig(config) {
    return config.apiKey && config.apiKey.length > 0 &&
           config.userId && config.userId.length > 0;
  }

  // Define the tool structure for Gemini
  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      functions: [
        {
          name: 'doSomething',
          description: 'Does something with the API',
          inputSchema: {
            type: 'object',
            properties: {
              param1: {
                type: 'string',
                description: 'First parameter'
              },
              param2: {
                type: 'number',
                description: 'Second parameter'
              }
            },
            required: ['param1', 'param2']
          }
        }
      ]
    };
  }

  // Execute the tool function
  async execute(functionName, args) {
    switch (functionName) {
      case 'doSomething':
        return this._doSomething(args.param1, args.param2);
      default:
        throw new Error(`Unknown function ${functionName}`);
    }
  }

  async _doSomething(param1, param2) {
    // Your implementation here
    // this.config contains the user's saved configuration
    return {
      result: 'success',
      data: 'your data here'
    };
  }
}
```

### Registering Your Tool

Edit `js/app/App.js` and add your tool to the `_registerTools()` method:

```javascript
_registerTools() {
  this.toolManager.registerTool(new WeatherTool());
  this.toolManager.registerTool(new SmartThingsTool());
  this.toolManager.registerTool(new MyTool()); // Add your tool here
}
```

## Architecture

### Core Modules

- **StorageManager** (`js/storage/`) - Manages localStorage for settings and transcript
- **ToolManager** (`js/tools/`) - Handles tool registration and execution
- **GeminiClient** (`js/api/`) - Interfaces with Gemini WebSocket API
- **AudioHandler** (`js/audio/`) - Manages microphone recording and audio playback
- **UIManager** (`js/ui/`) - Manages screen navigation and UI updates
- **App** (`js/app/`) - Main application orchestrator

### Dependency Injection

All modules use constructor-based dependency injection for flexibility and testability:

```javascript
const storage = new StorageManager();
const toolManager = new ToolManager(storage);
const ui = new UIManager();
const gemini = new GeminiClient(apiKey, toolManager);
const audio = new AudioHandler();
```

## File Structure

```
genesis-caller-v1/
├── index.html                 # Main HTML file
├── css/
│   └── style.css             # Mobile-first styles
├── js/
│   ├── app/
│   │   └── App.js            # Main application
│   ├── api/
│   │   └── GeminiClient.js    # Gemini API client
│   ├── audio/
│   │   └── AudioHandler.js    # Audio recording/playback
│   ├── storage/
│   │   └── StorageManager.js  # localStorage management
│   ├── tools/
│   │   ├── BaseTool.js        # Base tool class
│   │   ├── ToolManager.js     # Tool management
│   │   └── examples/
│   │       ├── WeatherTool.js # Example tool
│   │       └── SmartThingsTool.js # Example tool
│   └── ui/
│       └── UIManager.js       # UI management
└── README.md                  # This file
```

## Notes

- **Storage**: API keys and settings are stored in browser localStorage. They are never sent to any server except Gemini.
- **No Backend**: This is a pure client-side application. All processing happens in your browser.
- **Mobile Only**: UI is optimized for mobile phones and may not work well on desktop.
- **Tools**: Tools can ask follow-up questions by returning data that Gemini processes.

## Security

- Keep your API key private
- Don't share your browser's localStorage with others
- The app runs entirely in your browser; no data leaves except for Gemini API calls

## Browser Support

- Chrome/Edge 90+
- Safari 14.1+
- Firefox 88+
- Requires WebSocket, Web Audio API, and localStorage support

## Troubleshooting

**"No microphone access"** - Grant microphone permission in browser settings

**"WebSocket error"** - Make sure you're using a valid Gemini API key

**"Tool not executing"** - Check that the tool is enabled in Tool Library

**"Settings not saving"** - Clear browser cache and try again
