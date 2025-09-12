exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }

    try {
        const result = {
            timestamp: new Date().toISOString(),
            method: event.httpMethod,
            environment: {
                hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
                hasChatId: !!process.env.TELEGRAM_CHAT_ID,
                botTokenLength: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0,
                chatIdLength: process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.length : 0,
                nodeEnv: process.env.NODE_ENV || 'unknown',
                allTelegramVars: Object.keys(process.env).filter(key => key.includes('TELEGRAM'))
            },
            event: {
                headers: event.headers,
                body: event.body ? event.body.substring(0, 100) + '...' : null,
                isBase64Encoded: event.isBase64Encoded
            }
        };

        console.log('Test env result:', result);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Test env error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            })
        };
    }
};
