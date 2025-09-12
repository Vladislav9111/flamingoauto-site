const multipart = require('lambda-multipart-parser');

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

        // Parse multipart form data
        console.log('Parsing multipart data...');
        const result = await multipart.parse(event);
        console.log('Parsed form data:', {
            fields: Object.keys(result),
            files: result.files ? result.files.length : 0
        });

        const formData = result;

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

        // Check if there are photos
        const photos = [];
        if (formData.files) {
            for (const file of formData.files) {
                if (file.fieldname && file.fieldname.startsWith('photo')) {
                    photos.push(file);
                }
            }
        }

        console.log('Found photos:', photos.length);

        // Send message to Telegram
        if (photos.length > 0) {
            // Send photos with caption using form-data
            console.log('Sending photos with message to Telegram...');

            const FormData = require('form-data');
            const telegramFormData = new FormData();
            telegramFormData.append('chat_id', CHAT_ID);

            const media = [];
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                const photoKey = `photo${i}`;

                // Append photo buffer
                telegramFormData.append(photoKey, photo.content, {
                    filename: photo.filename || `photo${i}.jpg`,
                    contentType: photo.contentType || 'image/jpeg'
                });

                const mediaItem = {
                    type: 'photo',
                    media: `attach://${photoKey}`
                };

                // Add caption to first photo
                if (i === 0) {
                    mediaItem.caption = message;
                    mediaItem.parse_mode = 'HTML';
                }

                media.push(mediaItem);
            }

            telegramFormData.append('media', JSON.stringify(media));

            const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
                method: 'POST',
                body: telegramFormData,
                headers: telegramFormData.getHeaders()
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
            console.log('Telegram success with photos:', telegramResult);

        } else {
            // Send text message only
            console.log('Sending text message to Telegram...');

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
