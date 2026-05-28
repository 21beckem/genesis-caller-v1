export class BaseTool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.enabled = true;
  }

  getConfig() {
    return {};
  }

  getConfigFields() {
    return [];
  }

  validateConfig(config) {
    return true;
  }

  configUpdated(config) {
    // Optional method for tools to react to config changes
  }

  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  async execute(functionName, args) {
    throw new Error(`Tool ${this.name} must implement execute method`);
  }

  async handleFollowUp(question) {
    return null;
  }
}
