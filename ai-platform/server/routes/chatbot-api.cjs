/**
 * Chatbot API - AI-powered code assistance
 * Integrates with OpenAI, Anthropic, and Ollama providers
 * 
 * EU AI Act Article 50 Disclosure: This endpoint uses AI systems to generate responses.
 * Users are informed they are interacting with AI-generated content.
 */

const logger = require('../../src/lib/app-logger.cjs');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store.cjs');
const { generateWithProvider } = require('../services/cloud-inference-service.cjs');
const fs = require('fs');
const path = require('path');

// Load system prompts from external config
let CHAT_SYSTEM_PROMPT = '';
try {
  const promptsPath = path.join(__dirname, '../../config/prompts.json');
  const promptsConfig = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
  CHAT_SYSTEM_PROMPT = promptsConfig.static_analysis?.system_instruction || '';
  if (!CHAT_SYSTEM_PROMPT) {
    logger.warn('[Chatbot API] No system instruction found in config/prompts.json, using fallback');
    CHAT_SYSTEM_PROMPT = 'You are a helpful code assistant for the SimpleBeacon platform.';
  }
} catch (error) {
  logger.error('[Chatbot API] Failed to load prompts config:', error);
  CHAT_SYSTEM_PROMPT = 'You are a helpful code assistant for the SimpleBeacon platform.';
}

function setupChatbotAPI(app) {
  app.post('/api/chatbot/message', async (req, res) => {
    try {
      const { message, conversationHistory = [], provider = 'ollama', projectPath } = req.body;
      const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logger.info('[Chatbot API] Request:', { requestId, provider, hasMessage: !!message, messageLength: message?.length, conversationHistoryLength: conversationHistory?.length });

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get user credentials for AI providers
      const userCredentials = await getUserAiCredentials(req.user?.email || null);

      logger.info('[Chatbot API] User credentials:', {
        hasOllamaBaseUrl: !!userCredentials?.ollamaBaseUrl,
        hasOpenAI: !!userCredentials?.openai,
        hasAnthropic: !!userCredentials?.anthropic,
        envOllama: !!process.env.OLLAMA_BASE_URL,
        envOpenAI: !!process.env.OPENAI_API_KEY,
        envAnthropic: !!process.env.ANTHROPIC_API_KEY
      });

      // Check if the selected provider is available
      const isOllamaAvailable = Boolean(userCredentials?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL);
      const isOpenAIAvailable = Boolean(userCredentials?.openai || process.env.OPENAI_API_KEY);
      const isAnthropicAvailable = Boolean(userCredentials?.anthropic || process.env.ANTHROPIC_API_KEY);

      if (provider === 'ollama' && !isOllamaAvailable) {
        // Demo mode: return a canned response instead of error
        return res.json({
          success: true,
          response: `Demo mode: Ollama is not configured yet.\n\nTo use real AI responses:\n1. Install Ollama from https://ollama.ai\n2. Run \`ollama serve\` in a terminal\n3. Run \`ollama pull llama3.2\` in another terminal\n4. Configure Ollama in Settings → AI providers with URL: http://127.0.0.1:11434\n\nYour message: "${message}"`,
          provider: 'demo',
          timing: null
        });
      }
      if (provider === 'openai' && !isOpenAIAvailable) {
        return res.status(400).json({
          error: 'OpenAI is not configured',
          message: 'Configure OpenAI API key in Settings → AI providers or set OPENAI_API_KEY environment variable'
        });
      }
      if (provider === 'anthropic' && !isAnthropicAvailable) {
        return res.status(400).json({
          error: 'Anthropic is not configured',
          message: 'Configure Anthropic API key in Settings → AI providers or set ANTHROPIC_API_KEY environment variable'
        });
      }

      // Build conversation context
      const messages = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      // Add codebase context if projectPath is provided
      let contextPrompt = '';
      if (projectPath) {
        contextPrompt = `\n\nContext: The user is asking about the codebase at: ${projectPath}`;
        messages[messages.length - 1].content += contextPrompt;
      }

      // Generate response using the selected provider
      const inferenceStart = Date.now();
      const response = await generateWithProvider(
        provider,
        messages.map(m => m.content).join('\n\n'),
        {
          userCredentials,
          systemPrompt: CHAT_SYSTEM_PROMPT,
          timeoutMs: 60000,
          ollamaModel: userCredentials?.ollamaModel || null
        }
      );
      const inferenceDuration = Date.now() - inferenceStart;

      // Log AI inference for audit trail (EU AI Act compliance)
      // AI decision logging for accountability per Article 12 requirements
      logger.info('[Chatbot API] Inference logging - AI decision audit:', {
        requestId,
        provider: response.provider || provider,
        inferenceDuration,
        responseLength: response.text?.length || 0,
        hasTiming: !!response.timing
      });

      res.json({
        success: true,
        response: response.text || response.content || 'No response generated',
        provider: response.provider || provider,
        timing: response.timing || null,
        requestId
      });

    } catch (error) {
      logger.error('[Chatbot API] Error:', error);
      res.status(500).json({
        error: 'Failed to generate response',
        message: error.message
      });
    }
  });

  app.get('/api/chatbot/providers', async (req, res) => {
    try {
      const userCredentials = await getUserAiCredentials(req.user?.email || null);
      
      const providers = [
        {
          id: 'ollama',
          label: 'Ollama',
          available: Boolean(userCredentials?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL),
          description: 'Local models via Ollama'
        },
        {
          id: 'openai',
          label: 'OpenAI',
          available: Boolean(userCredentials?.openai || process.env.OPENAI_API_KEY),
          description: 'GPT models'
        },
        {
          id: 'anthropic',
          label: 'Anthropic',
          available: Boolean(userCredentials?.anthropic || process.env.ANTHROPIC_API_KEY),
          description: 'Claude models'
        }
      ];

      res.json({ providers });
    } catch (error) {
      logger.error('[Chatbot API] Error fetching providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  });

  logger.info('[Chatbot API] Registered POST /api/chatbot/message');
  logger.info('[Chatbot API] Registered GET /api/chatbot/providers');
}

module.exports = { setupChatbotAPI };
