// Netlify-specific multipart parser
function parseNetlifyMultipart(event) {
    console.log('🔍 Starting Netlify multipart parsing...');

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    console.log('Content-Type header:', contentType);

    if (!contentType.includes('multipart/form-data')) {
        throw new Error('Not multipart/form-data');
    }

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
        throw new Error('No boundary found in Content-Type');
    }

    const boundary = boundaryMatch[1].replace(/"/g, ''); // Remove quotes if present
    console.log('Extracted boundary:', boundary);

    // Get body as buffer
    let bodyBuffer;
    if (event.isBase64Encoded) {
        console.log('Converting base64 body...');
        bodyBuffer = Buffer.from(event.body, 'base64');
    } else {
        console.log('Using raw body...');
        bodyBuffer = Buffer.from(event.body, 'utf8');
    }

    console.log('Body buffer length:', bodyBuffer.length);

    // Parse multipart
    const result = { fields: {}, files: [] };
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    // Split by boundary
    const parts = [];
    let start = 0;
    let pos = bodyBuffer.indexOf(boundaryBuffer, start);

    while (pos !== -1) {
        if (start > 0) {
            parts.push(bodyBuffer.slice(start, pos));
        }
        start = pos + boundaryBuffer.length;
        pos = bodyBuffer.indexOf(boundaryBuffer, start);
    }

    // Add final part if exists
    const endPos = bodyBuffer.indexOf(endBoundaryBuffer, start);
    if (endPos !== -1 && start < endPos) {
        parts.push(bodyBuffer.slice(start, endPos));
    }

    console.log(`Found ${parts.length} parts`);

    // Process each part
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.length === 0) continue;

        // Find headers/content separator (\r\n\r\n)
        const separator = Buffer.from('\r\n\r\n');
        const sepIndex = part.indexOf(separator);

        if (sepIndex === -1) {
            console.log(`Part ${i}: No header separator found`);
            continue;
        }

        const headers = part.slice(0, sepIndex).toString('utf8');
        const content = part.slice(sepIndex + 4);

        // Remove trailing \r\n from content
        let cleanContent = content;
        if (cleanContent.length >= 2 &&
            cleanContent[cleanContent.length - 2] === 0x0D &&
            cleanContent[cleanContent.length - 1] === 0x0A) {
            cleanContent = cleanContent.slice(0, -2);
        }

        console.log(`Part ${i}: Headers length: ${headers.length}, Content length: ${cleanContent.length}`);

        // Parse headers
        let name = '';
        let filename = '';
        let contentType = '';

        const headerLines = headers.split('\r\n');
        for (const line of headerLines) {
            if (line.toLowerCase().includes('content-disposition')) {
                const nameMatch = line.match(/name="([^"]+)"/);
                const filenameMatch = line.match(/filename="([^"]+)"/);
                if (nameMatch) name = nameMatch[1];
                if (filenameMatch) filename = filenameMatch[1];
            }
            if (line.toLowerCase().includes('content-type')) {
                contentType = line.split(':')[1]?.trim() || '';
            }
        }

        console.log(`Part ${i}: name="${name}", filename="${filename}", contentType="${contentType}"`);

        if (filename && name) {
            // It's a file
            result.files.push({
                fieldname: name,
                filename: filename,
                contentType: contentType || 'application/octet-stream',
                content: cleanContent
            });
            console.log(`✅ Added file: ${filename} (${cleanContent.length} bytes)`);
        } else if (name) {
            // It's a field
            result.fields[name] = cleanContent.toString('utf8');
            console.log(`✅ Added field: ${name} = "${result.fields[name].substring(0, 50)}..."`);
        }
    }

    console.log(`✅ Parsing complete: ${Object.keys(result.fields).length} fields, ${result.files.length} files`);
    return result;
}

// Telegram-specific multipart form data builder
function createTelegramFormData(fields, files) {
    const boundary = `----formdata-${Date.now()}`;
    const chunks = [];

    console.log('🔨 Building Telegram form data...');
    console.log('📋 Fields:', Object.keys(fields));
    console.log('📁 Files:', files.length);

    // Add text fields
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(`--${boundary}\r\n`);
        chunks.push(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
        chunks.push(`${value}\r\n`);
        console.log(`✅ Added field: ${key}`);
    }

    // Add files
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Use the fieldname from the file, or default naming
        const fieldName = file.fieldname || `photo${i}`;
        const fileName = file.filename || `photo${i}.jpg`;
        const contentType = file.contentType || 'image/jpeg';

        chunks.push(`--${boundary}\r\n`);
        chunks.push(`Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`);
        chunks.push(`Content-Type: ${contentType}\r\n\r\n`);
        chunks.push(file.content);
        chunks.push('\r\n');

        console.log(`✅ Added file: ${fieldName} (${fileName}) - ${file.content.length} bytes`);
    }

    chunks.push(`--${boundary}--\r\n`);

    const body = Buffer.concat(chunks.map(chunk =>
        typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
    ));

    console.log(`🔨 Form data built: ${body.length} bytes total`);

    return {
        boundary,
        body
    };
}



exports.handler = async (event, context) => {
    console.log('🚀 Function entry point reached');

    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    console.log('HTTP Method:', event.httpMethod);

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight OK' })
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed:', event.httpMethod);
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed', method: event.httpMethod })
        };
    }

    try {
        console.log('🚀 Telegram function v2.0 started');

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        console.log('Environment check:', {
            hasBotToken: !!BOT_TOKEN,
            hasChatId: !!CHAT_ID,
            botTokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
            chatIdLength: CHAT_ID ? CHAT_ID.length : 0,
            httpMethod: event.httpMethod,
            contentType: event.headers['content-type'] || event.headers['Content-Type'] || 'none'
        });

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('❌ Missing environment variables');
            const errorResponse = {
                error: 'Server configuration error',
                details: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in environment variables',
                debug: {
                    hasBotToken: !!BOT_TOKEN,
                    hasChatId: !!CHAT_ID,
                    allTelegramVars: Object.keys(process.env).filter(key => key.includes('TELEGRAM'))
                }
            };

            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify(errorResponse)
            };
        }

        // Parse request data
        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        console.log('📥 Content-Type:', contentType);

        let formData;
        let photos = [];

        if (contentType.includes('multipart/form-data')) {
            console.log('📦 Parsing multipart form data...');
            try {
                const parsed = parseNetlifyMultipart(event);
                formData = parsed.fields;

                // Extract photos
                for (const file of parsed.files) {
                    if (file.fieldname && file.fieldname.startsWith('photo')) {
                        photos.push(file);
                    }
                }

                console.log('✅ Multipart parsed successfully:', {
                    fields: Object.keys(formData).length,
                    photos: photos.length
                });

            } catch (parseError) {
                console.error('❌ Multipart parsing failed:', parseError.message);
                throw new Error(`Failed to parse multipart data: ${parseError.message}`);
            }
        } else if (contentType.includes('application/json')) {
            console.log('📄 Parsing JSON data...');
            try {
                formData = JSON.parse(event.body);
                console.log('✅ JSON parsed successfully');
            } catch (jsonError) {
                console.error('❌ JSON parsing failed:', jsonError.message);
                throw new Error(`Failed to parse JSON: ${jsonError.message}`);
            }
        } else {
            console.log('🔄 Unknown content type, attempting JSON fallback...');
            try {
                formData = JSON.parse(event.body);
                console.log('✅ JSON fallback successful');
            } catch (fallbackError) {
                console.error('❌ All parsing methods failed');
                throw new Error('Invalid request format - unable to parse body');
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
            console.log(`📸 Sending message with ${photos.length} photos to Telegram...`);

            // Log photo details
            photos.forEach((photo, i) => {
                console.log(`Photo ${i}:`, {
                    fieldname: photo.fieldname,
                    filename: photo.filename,
                    contentType: photo.contentType,
                    size: photo.content.length
                });
            });

            try {
                // Try sending photos one by one first (simpler approach)
                if (photos.length === 1) {
                    console.log('📤 Sending single photo...');

                    // Use our custom form builder for single photo
                    const singlePhotoFields = {
                        chat_id: CHAT_ID,
                        caption: message,
                        parse_mode: 'HTML'
                    };

                    // Rename photo for sendPhoto API
                    const photoForSingle = [{
                        fieldname: 'photo',
                        filename: photos[0].filename || 'photo.jpg',
                        contentType: photos[0].contentType || 'image/jpeg',
                        content: photos[0].content
                    }];

                    const singlePhotoFormData = createTelegramFormData(singlePhotoFields, photoForSingle);

                    const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': `multipart/form-data; boundary=${singlePhotoFormData.boundary}`
                        },
                        body: singlePhotoFormData.body
                    });

                    if (!telegramResponse.ok) {
                        const errorText = await telegramResponse.text();
                        console.error('❌ Single photo send failed:', errorText);
                        throw new Error(`Telegram sendPhoto error: ${telegramResponse.status} - ${errorText}`);
                    }

                    const result = await telegramResponse.json();
                    console.log('✅ Single photo sent successfully:', result);

                } else {
                    console.log('📤 Sending multiple photos as media group...');

                    // Prepare media array for sendMediaGroup
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

                    // Create form data for sendMediaGroup
                    const formFields = {
                        chat_id: CHAT_ID,
                        media: JSON.stringify(media)
                    };

                    console.log('📋 Media array:', media);
                    console.log('📋 Form fields:', formFields);

                    const telegramFormData = createTelegramFormData(formFields, photos);

                    console.log('📦 Form data boundary:', telegramFormData.boundary);
                    console.log('📦 Form data size:', telegramFormData.body.length);

                    const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': `multipart/form-data; boundary=${telegramFormData.boundary}`
                        },
                        body: telegramFormData.body
                    });

                    console.log('📡 Telegram response status:', telegramResponse.status);

                    if (!telegramResponse.ok) {
                        const errorText = await telegramResponse.text();
                        console.error('❌ Media group send failed:', {
                            status: telegramResponse.status,
                            statusText: telegramResponse.statusText,
                            error: errorText
                        });
                        throw new Error(`Telegram sendMediaGroup error: ${telegramResponse.status} - ${errorText}`);
                    }

                    const telegramResult = await telegramResponse.json();
                    console.log('✅ Media group sent successfully:', telegramResult);
                }

            } catch (photoError) {
                console.error('❌ Photo sending failed, falling back to text only:', photoError.message);

                // Fallback: send text message only
                const fallbackPayload = {
                    chat_id: CHAT_ID,
                    text: message + `\n\n⚠️ Не удалось отправить ${photos.length} фотографий. Ошибка: ${photoError.message}`,
                    parse_mode: 'HTML'
                };

                const fallbackResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(fallbackPayload)
                });

                if (fallbackResponse.ok) {
                    console.log('✅ Fallback text message sent');
                } else {
                    const fallbackError = await fallbackResponse.text();
                    console.error('❌ Even fallback failed:', fallbackError);
                    throw new Error(`Complete failure: ${fallbackError}`);
                }
            }

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
