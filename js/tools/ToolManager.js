export class ToolManager {
  constructor(storage) {
    this.storage = storage;
    this.tools = new Map();
  }

  registerTool(tool) {
    this.tools.set(tool.name, tool);
    if (!this.storage.getToolConfig(tool.name)) {
      this.storage.setToolConfig(tool.name, tool.getConfig());
    }
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  getEnabledTools() {
    return this.getAllTools().filter(tool => this.storage.isToolEnabled(tool.name));
  }

  isToolEnabled(toolName) {
    return this.storage.isToolEnabled(toolName);
  }

  toggleTool(toolName, enabled) {
    this.storage.setToolEnabled(toolName, enabled);
  }

  getToolConfig(toolName) {
    return this.storage.getToolConfig(toolName);
  }

  setToolConfig(toolName, config) {
    const tool = this.getTool(toolName);
    if (tool && tool.validateConfig(config)) {
      this.storage.setToolConfig(toolName, config);
      return true;
    }
    return false;
  }

  async executeTool(toolName, functionName, args) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const config = this.getToolConfig(toolName);
    tool.config = config;

    return await tool.execute(functionName, args);
  }

  getGeminiToolDefinitions() {
    return this.getEnabledTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      function_declarations: this._getFunctionDeclarations(tool)
    }));
  }

  _getFunctionDeclarations(tool) {
    const definition = tool.getToolDefinition();
    const functions = definition.functions || [];

    if (functions.length === 0) {
      return [{
        name: tool.name,
        description: definition.description,
        parameters: definition.inputSchema
      }];
    }

    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      parameters: fn.inputSchema
    }));
  }
}
