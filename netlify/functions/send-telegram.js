exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        console.log('Environment check:', {
            hasBotToken: !!BOT_TOKEN,
            hasChatId: !!CHAT_ID,
            botTokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
            chatIdLength: CHAT_ID ? CHAT_ID.length : 0
        });

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('Missing environment variables:', {
                hasBotToken: !!BOT_TOKEN,
                hasChatId: !!CHAT_ID,
                allEnvVars: Object.keys(process.env).filter(key => key.includes('TELEGRAM'))
            });
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST'
                },
                body: JSON.stringify({
                    error: 'Server configuration error',
                    details: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in environment variables'
                })
            };
        }

        // Parse form data
        console.log('Received request body:', event.body);
        const formData = JSON.parse(event.body);
        console.log('Parsed form data:', formData);

        // Build message
        let message = '📩 Новая заявка с сайта:\n\n';
        
        const addField = (label, value) => {
            if (value && value.trim()) {
                message += `<b>${label}:</b> ${value.trim()}\n`;
            }
        };

        // Car data
        addField('Рег. номер', formData.regNumber);
        addField('Марка', formData.make);
        addField('Модель', formData.model);
        addField('Год выпуска', formData.year);
        addField('Пробег', formData.mileage);
        addField('КПП', formData.transmission);
        addField('Двигатель', formData.engine);
        if (formData.price && formData.price.trim()) {
            message += `<b>Желаемая цена:</b> ${formData.price.trim()} €\n`;
        }

        message += '\n<b>Контактные данные:</b>\n';
        addField('Имя', formData.name);
        addField('Email', formData.email);
        addField('Телефон', formData.phone);
        addField('Город', formData.city);
        addField('Доп. информация', formData.note);

        // Send message to Telegram
        console.log('Sending message to Telegram:', {
            chatId: CHAT_ID,
            messageLength: message.length,
            message: message.substring(0, 200) + '...'
        });

        const telegramPayload = {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        };

        const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(telegramPayload)
        });

        console.log('Telegram response status:', telegramResponse.status);

        if (!telegramResponse.ok) {
            const errorText = await telegramResponse.text();
            console.error('Telegram API error:', {
                status: telegramResponse.status,
                statusText: telegramResponse.statusText,
                error: errorText
            });
            throw new Error(`Telegram API error: ${telegramResponse.status} - ${errorText}`);
        }

        const telegramResult = await telegramResponse.json();
        console.log('Telegram success:', telegramResult);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST'
            },
            body: JSON.stringify({ success: true, message: 'Message sent successfully' })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST'
            },
            body: JSON.stringify({ 
                error: 'Failed to send message',
                details: error.message 
            })
        };
    }
};
