// Simple multipart form data builder
function createFormData(fields, files) {
    const boundary = `----formdata-${Date.now()}`;
    const chunks = [];

    // Add text fields
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(`--${boundary}\r\n`);
        chunks.push(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
        chunks.push(`${value}\r\n`);
    }

    // Add files
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const photoKey = `photo${i}`;

        chunks.push(`--${boundary}\r\n`);
        chunks.push(`Content-Disposition: form-data; name="${photoKey}"; filename="${file.filename || `photo${i}.jpg`}"\r\n`);
        chunks.push(`Content-Type: ${file.contentType || 'image/jpeg'}\r\n\r\n`);
        chunks.push(file.content);
        chunks.push('\r\n');
    }

    chunks.push(`--${boundary}--\r\n`);

    return {
        boundary,
        body: Buffer.concat(chunks.map(chunk =>
            typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        ))
    };
}

// Simple multipart parser for Netlify Functions
function parseMultipart(body, boundary) {
    console.log('Parsing multipart with boundary:', boundary);

    // Split by boundary
    const boundaryStr = `--${boundary}`;
    const parts = body.split(boundaryStr);
    const result = { fields: {}, files: [] };

    console.log('Found parts:', parts.length);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part || part.trim() === '' || part.trim() === '--' || part.trim() === '--\r\n') {
            continue;
        }

        // Find the double CRLF that separates headers from content
        const doubleCrlfIndex = part.indexOf('\r\n\r\n');
        if (doubleCrlfIndex === -1) {
            console.log(`Part ${i}: No double CRLF found, skipping`);
            continue;
        }

        const headers = part.substring(0, doubleCrlfIndex);
        const content = part.substring(doubleCrlfIndex + 4);

        // Remove trailing CRLF from content
        const cleanContent = content.replace(/\r\n$/, '');

        // Parse headers
        const headerLines = headers.split('\r\n');
        let name = '';
        let filename = '';
        let contentType = '';

        for (const line of headerLines) {
            if (line.includes('Content-Disposition')) {
                const nameMatch = line.match(/name="([^"]+)"/);
                const filenameMatch = line.match(/filename="([^"]+)"/);
                if (nameMatch) name = nameMatch[1];
                if (filenameMatch) filename = filenameMatch[1];
            }
            if (line.includes('Content-Type')) {
                contentType = line.split(':')[1].trim();
            }
        }

        console.log(`Part ${i}: name="${name}", filename="${filename}", contentType="${contentType}"`);

        if (filename && name) {
            // It's a file
            result.files.push({
                fieldname: name,
                filename: filename,
                contentType: contentType || 'application/octet-stream',
                content: Buffer.from(cleanContent, 'binary')
            });
            console.log(`Added file: ${filename}, size: ${cleanContent.length}`);
        } else if (name) {
            // It's a field
            result.fields[name] = cleanContent;
            console.log(`Added field: ${name} = ${cleanContent.substring(0, 50)}...`);
        }
    }

    console.log('Parse result:', {
        fields: Object.keys(result.fields),
        files: result.files.length
    });

    return result;
}

exports.handler = async (event, context) => {
    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
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
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Server configuration error',
                    details: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in environment variables'
                })
            };
        }

        // Check content type and parse accordingly
        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        console.log('Content-Type:', contentType);
        console.log('Event body type:', typeof event.body);
        console.log('Event body length:', event.body ? event.body.length : 0);

        let formData;
        let photos = [];

        if (contentType.includes('application/json')) {
            // JSON data (no photos)
            console.log('Parsing JSON data...');
            formData = JSON.parse(event.body);
        } else if (contentType.includes('multipart/form-data')) {
            // Parse multipart data
            console.log('Parsing multipart data...');
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                console.error('No boundary found in content-type:', contentType);
                throw new Error('No boundary found in multipart data');
            }

            console.log('Using boundary:', boundary);

            // Convert base64 body to buffer if needed
            let bodyBuffer;
            if (event.isBase64Encoded) {
                console.log('Converting base64 body to buffer...');
                bodyBuffer = Buffer.from(event.body, 'base64');
            } else {
                console.log('Using body as string...');
                bodyBuffer = Buffer.from(event.body, 'binary');
            }

            console.log('Body buffer length:', bodyBuffer.length);

            const parsed = parseMultipart(bodyBuffer.toString('binary'), boundary);
            formData = parsed.fields;

            // Extract photos
            for (const file of parsed.files) {
                if (file.fieldname && file.fieldname.startsWith('photo')) {
                    photos.push(file);
                }
            }

            console.log('Parsed multipart:', {
                fields: Object.keys(formData),
                photos: photos.length,
                photoSizes: photos.map(p => p.content.length)
            });
        } else {
            console.log('Unknown content type, trying JSON...');
            try {
                formData = JSON.parse(event.body);
            } catch (e) {
                console.error('Failed to parse as JSON:', e.message);
                throw new Error('Invalid request format');
            }
        }

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
        if (photos.length > 0) {
            console.log(`Sending message with ${photos.length} photos to Telegram...`);

            // Prepare media array
            const media = [];
            for (let i = 0; i < photos.length; i++) {
                const mediaItem = {
                    type: 'photo',
                    media: `attach://photo${i}`
                };

                // Add caption to first photo
                if (i === 0) {
                    mediaItem.caption = message;
                    mediaItem.parse_mode = 'HTML';
                }

                media.push(mediaItem);
            }

            // Create form data
            const formFields = {
                chat_id: CHAT_ID,
                media: JSON.stringify(media)
            };

            const formData = createFormData(formFields, photos);

            const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${formData.boundary}`
                },
                body: formData.body
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
            headers: corsHeaders,
            body: JSON.stringify({ success: true, message: 'Message sent successfully' })
        };

    } catch (error) {
        console.error('Function error:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to send message',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
