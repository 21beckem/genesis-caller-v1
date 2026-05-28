import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
  Type,
} from './genai-2.6.0.js';


const INITIAL_CONTEXT = `
Things to know but never say:
- Never use slang. Respond using the same language I talk to you in.
- If the prompt I give is not clear, or it seems like I wasn't speaking to you, say nothing.
- Speak slowly and clearly, and wait for me to finish speaking before responding. If I interrupt you, stop talking immediately and wait for me to finish.

Things to know about yourself:
- Your name is Genesis.
- You are an AI assistant created and trained by Mr. Becker.
- You are an expandable AI that can utilize extentions to perform tasks.`;

export class GeminiClient {
	#geminiSpeakingNow = false;
  constructor(apiKey, toolManager, audio, ui) {
    this.apiKey = apiKey;
    this.toolManager = toolManager;
    this.audio = audio;
    this.ui = ui;
    this.ai = null;
    this.session = null;
    this.isConnected = false;
    this.responseQueue = [];
    this.waiters = [];
    this.functionToToolName = new Map();
  }

  async connect(voice, onCloseCallback) {
    if (this.isConnected) return this.session;
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    this._buildFunctionMap();

    const config = {
      responseModalities: [Modality.AUDIO],
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      contextWindowCompression: {
        triggerTokens: 104857,
        slidingWindow: { targetTokens: 52428 },
      },
      systemInstruction: {
        parts: [{
          text: INITIAL_CONTEXT.trim(),
        }],
      },
      tools: this._buildTools(),
    };

    this.session = await this.ai.live.connect({
      model: 'models/gemini-3.1-flash-live-preview',
      callbacks: {
        onopen: () => {
          this.isConnected = true;
        },
        onmessage: (message) => {
          this._handleIncomingMessage(message);
        },
        onerror: (error) => {
          this.isConnected = false;
          console.error('Gemini live session error:', error);
        },
        onclose: () => {
					console.log('Gemini live session closed');
          this.isConnected = false;
          if (typeof onCloseCallback === 'function') {
            onCloseCallback();
          }
        },
      },
      config,
    });

    return this.session;
  }

  _buildFunctionMap() {
    this.functionToToolName.clear();

    for (const tool of this.toolManager.getEnabledTools()) {
      const definition = tool.getToolDefinition();
      const functions = definition.functions && definition.functions.length > 0
        ? definition.functions
        : [{
            name: definition.name,
            description: definition.description,
            inputSchema: definition.inputSchema,
          }];

      for (const fn of functions) {
        this.functionToToolName.set(fn.name, tool.name);
      }
    }
  }

  _buildTools() {
    return this.toolManager.getEnabledTools().map((tool) => {
      const definition = tool.getToolDefinition();
      const functions = definition.functions && definition.functions.length > 0
        ? definition.functions
        : [{
            name: definition.name,
            description: definition.description,
            inputSchema: definition.inputSchema,
          }];

      return {
        functionDeclarations: functions.map((fn) => ({
          name: fn.name,
          description: fn.description,
          parameters: this._convertSchema(fn.inputSchema),
        })),
      };
    });
  }

  _convertSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return { type: Type.OBJECT, properties: {}, required: [] };
    }

    const converted = { ...schema };

    if (typeof converted.type === 'string') {
      const mappedType = Type[converted.type.toUpperCase()];
      if (mappedType) {
        converted.type = mappedType;
      }
    }

    if (converted.properties && typeof converted.properties === 'object') {
      const properties = {};
      for (const [key, value] of Object.entries(converted.properties)) {
        properties[key] = this._convertSchema(value);
      }
      converted.properties = properties;
    }

    if (converted.items && typeof converted.items === 'object') {
      converted.items = this._convertSchema(converted.items);
    }

    return converted;
  }
	
	#middleOfMessageId = null;
  _handleIncomingMessage(message) {
		console.log('Received message from Gemini session:', message);
		if (message.sessionResumptionUpdate) return; // Ignore session resumption messages for now
    if (message.setupComplete !== undefined) {
        this.isConnected = true;
    }
    if (message.toolCall) {
      this.processToolCall(message.toolCall);
    }

    if (message.serverContent) {
			if (message.serverContent.turnComplete) {
				this.#geminiSpeakingNow = false;
				this.#middleOfMessageId = null;
				return;
			}
			if (message?.serverContent?.inputTranscription?.text) {
				this.ui.addTranscriptMessage('user', message.serverContent.inputTranscription.text);
			}
			if (message?.serverContent?.modelTurn?.parts) {
				this.#geminiSpeakingNow = true;
				message.serverContent.modelTurn.parts.forEach((part) => {
					if (typeof part?.inlineData?.mimeType === 'string' && part.inlineData.mimeType.startsWith('audio/')) {
						this.audio.playAudio(part.inlineData.data);
					}
				});
			}
			if (message?.serverContent?.outputTranscription?.text) {
				if (this.#middleOfMessageId !== null) {
					this.ui.appendToTranscriptMessageById(this.#middleOfMessageId, message.serverContent.outputTranscription.text);
				} else {
					this.#middleOfMessageId = this.ui.addTranscriptMessage('gemini', message.serverContent.outputTranscription.text);
				}
			}
    }
  }

  _enqueueResponse(response) {
    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(response);
      return;
    }

    this.responseQueue.push(response);
  }

  async sendAudioChunk(audioChunk) {
    if (!this.session || !this.isConnected) {
      throw new Error('Gemini session is not connected');
    }
		if (this.#geminiSpeakingNow) return; // Don't send audio if Gemini is currently speaking, to avoid interrupting
		this.session.sendRealtimeInput({
			audio: {
				data: new Uint8Array(audioChunk).toBase64(),
				mimeType: 'audio/pcm;rate=16000'
			}
		});
  }

  async processToolCall(toolCallData) {
    if (!this.session) {
      throw new Error('Gemini session is not connected');
    }

    const functionCalls = toolCallData.functionCalls || toolCallData.function_calls || [];
    const functionResponses = [];

    for (const functionCall of functionCalls) {
      const toolName = this.functionToToolName.get(functionCall.name) || functionCall.toolName || functionCall.tool_name || functionCall.name;

      try {
        const result = await this.toolManager.executeTool(
          toolName,
          functionCall.name,
          functionCall.args || {}
        );

        functionResponses.push({
          id: functionCall.id,
          name: functionCall.name,
          response: result,
        });
      } catch (error) {
        functionResponses.push({
          id: functionCall.id,
          name: functionCall.name,
          response: { error: error.message },
        });
      }
    }

    this.session.sendToolResponse({
      functionResponses,
    });
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }

    this.ai = null;
    this.isConnected = false;
    this.responseQueue = [];
    this.waiters = [];
    this.functionToToolName.clear();
  }

	static fromObject(obj) {
		return new this(
			obj.apiKey,
			obj.toolManager,
			obj.audio,
			obj.ui
		);
	}
}
