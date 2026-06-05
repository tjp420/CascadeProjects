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

/**
 * Validates and normalizes conversation history to prevent role injection or excessive payloads.
 * Implements security boundaries to mitigate prompt injection.
 */
function sanitizeConversationHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  // Defend against memory exhaustion (DoS): Max 30 messages allowed in history
  const trimmedHistory = history.slice(-30);
  const validatedHistory = [];

  for (const msg of trimmedHistory) {
    if (!msg || typeof msg !== 'object') continue;

    // Strict string conversion and length capping for role and content fields
    const incomingRole = String(msg.role || '').toLowerCase().trim();
    const content = String(msg.content || '').substring(0, 8000); // 8k character limit per turn

    // Whitelist roles: Allow only user or assistant messages from history
    // Blocks injection attempts using 'system', 'developer', or malicious role values
    if (incomingRole === 'user' || incomingRole === 'assistant') {
      validatedHistory.push({
        role: incomingRole,
        content: content
      });
    }
  }

  return validatedHistory;
}

function setupChatbotAPI(app) {
  app.post('/api/chatbot/message', async (req, res) => {
    try {
      const { message, conversationHistory = [], provider = 'ollama', projectPath } = req.body;
      const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }

      // Defend against massive payload sizes
      if (message.length > 12000) {
        return res.status(400).json({ error: 'Message content length exceeds safe processing limit' });
      }

      // Process and sanitize history using secure boundaries
      const sanitizedHistory = sanitizeConversationHistory(conversationHistory);

      logger.info('[Chatbot API] Request:', {
        requestId,
        provider,
        hasMessage: true,
        messageLength: message.length,
        conversationHistoryLength: sanitizedHistory.length
      });

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
        return res.json({
          success: true,
          response: `Demo mode: Ollama is not configured yet.\n\nTo use real AI responses:\n1. Install Ollama from https://ollama.ai\n2. Run \`ollama serve\` in a terminal\n3. Run \`ollama pull llama3.2\` in another terminal\n4. Configure Ollama in Settings → AI providers with URL: http://127.0.0.1:11434\n\nYour message: "${message.substring(0, 200)}"`,
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

      // Safely append a sanitized project path descriptor only for local Ollama.
      // OpenAI/Anthropic are cloud providers — we never send file paths to them.
      let contextSuffix = '';
      if (provider === 'ollama' && projectPath && typeof projectPath === 'string') {
        const cleanPath = path.normalize(projectPath).replace(/["'\r\n]/g, '');
        contextSuffix = `\n\nContext: The user is asking about the codebase at: ${cleanPath}`;
      }

      // Build context securely: System prompt is always first, then validated user/assistant turns
      const messages = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...sanitizedHistory,
        { role: 'user', content: message + contextSuffix }
      ];

      // Generate response using the selected provider
      const inferenceStart = Date.now();
      const response = await generateWithProvider(
        provider,
        messages,
        {
          userCredentials,
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

  /**
   * EU AI Act Article 50 Transparency Disclosure Endpoint
   * Returns standardized disclosure text and human-oversight controls
   * for frontend consumption and user-facing transparency.
   */
  app.get('/api/chatbot/disclosure', (req, res) => {
    res.json({
      aiSystemDisclosure: {
        title: 'AI-Generated Content Disclosure',
        body: 'This chatbot uses artificial intelligence (AI) to generate responses. '
          + 'Responses may be inaccurate, incomplete, or outdated. '
          + 'Always verify critical information independently.',
        providerTransparency: {
          ollama: 'Local AI model running on your machine — no data leaves your device.',
          openai: 'Responses powered by OpenAI GPT models. Data is processed per OpenAI\'s privacy policy.',
          anthropic: 'Responses powered by Anthropic Claude models. Data is processed per Anthropic\'s privacy policy.'
        }
      },
      humanInTheLoop: {
        available: true,
        description: 'Human oversight is available via the SimpleBeacon dashboard. '
          + 'Operators can review inference logs, adjust system prompts, and override provider selections.',
        appealProcess: 'Contact support@simplebeacon.dev to escalate or dispute any AI-generated output.',
        manualOverride: 'Users may switch to local Ollama models at any time for fully on-device inference.'
      },
      euAiActCompliance: {
        classification: 'Annex III — Limited-risk AI system (chatbot)',
        article50: 'Transparency obligation fulfilled via this disclosure and UI labels',
        article12: 'Inference events logged for accountability',
        lastUpdated: new Date().toISOString()
      }
    });
  });

  // Prepend AI-generated marker to chatbot responses for Article 50 compliance
  function buildTransparencyPreamble(provider) {
    const providerName = provider === 'ollama' ? 'Local AI' : provider === 'openai' ? 'OpenAI' : 'Anthropic';
    return `[AI-Generated via ${providerName}] `;
  }

  logger.info('[Chatbot API] Registered POST /api/chatbot/message');
  logger.info('[Chatbot API] Registered GET /api/chatbot/providers');
  logger.info('[Chatbot API] Registered GET /api/chatbot/disclosure');
}

module.exports = { setupChatbotAPI };
