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

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('Missing environment variables:', { 
                hasBotToken: !!BOT_TOKEN, 
                hasChatId: !!CHAT_ID 
            });
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Parse form data
        const formData = JSON.parse(event.body);
        
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
        const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!telegramResponse.ok) {
            const errorText = await telegramResponse.text();
            console.error('Telegram API error:', errorText);
            throw new Error(`Telegram API error: ${telegramResponse.status}`);
        }

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
