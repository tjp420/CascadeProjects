(async () => {
    try {
        const path = require('path');
        const client = require(path.join(__dirname, '..', 'server', 'services', 'ollama-client.cjs'));
        const baseUrl = process.env.OLLAMA_BASE_URL || client.DEFAULT_OLLAMA_URL || 'http://127.0.0.1:11434';
        console.log('Using Ollama base URL ->', baseUrl);

        console.log('\n1) Listing models (includeMeta:true)');
        try {
            const list = await client.ollamaListModels(baseUrl, { includeMeta: true, forceRefresh: true, timeoutMs: 5000 });
            console.log('Models:', list.models || list);
            if (list.timing) console.log('Timing:', list.timing);
        } catch (err) {
            console.error('List models error:', err && err.message);
        }

        console.log('\n2) Generate (ollamaGenerate) using model "llama2"');
        try {
            const gen = await client.ollamaGenerate(baseUrl, 'llama2', 'Say hello in one sentence.', { includeMeta: true, timeoutMs: 60000 });
            console.log('Generate response:', gen.response || gen);
            if (gen.timing) console.log('Timing:', gen.timing);
        } catch (err) {
            console.error('Generate error:', err && err.message);
        }

        console.log('\n3) Chat (ollamaChat) using model "llama2"');
        try {
            const msg = [{ role: 'user', content: 'Hello from integration test' }];
            const chat = await client.ollamaChat(baseUrl, 'llama2', msg, { includeMeta: true, timeoutMs: 60000 });
            console.log('Chat response:', chat.response || chat);
            if (chat.timing) console.log('Timing:', chat.timing);
        } catch (err) {
            console.error('Chat error:', err && err.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('Integration script failed:', err);
        process.exit(2);
    }
})();
