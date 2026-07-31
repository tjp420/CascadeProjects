// simplebeacon-ignore: test helper
const CHATBOT_MOCK_ENV_KEY = 'SIMPLEBEACON_CHATBOT_MOCK';

function setChatbotMockMode(enabled) {
  if (enabled) {
    process.env[CHATBOT_MOCK_ENV_KEY] = 'true';
    return;
  }
  delete process.env[CHATBOT_MOCK_ENV_KEY];
}

function clearChatbotMockMode() {
  delete process.env[CHATBOT_MOCK_ENV_KEY];
}

module.exports = {
  setChatbotMockMode,
  clearChatbotMockMode,
};
