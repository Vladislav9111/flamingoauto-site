// Функция для сброса пароля администратора к значению по умолчанию
const { hashPassword } = require('./utils/password-utils');

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Password reset request received');
    
    const { confirmReset } = JSON.parse(event.body);

    if (confirmReset !== 'YES_RESET_PASSWORD') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Подтверждение сброса не получено' })
      };
    }

    // Хешируем пароль по умолчанию
    const defaultPassword = 'flamingo2024';
    console.log('Hashing default password...');
    const hashedPassword = await hashPassword(defaultPassword);
    
    console.log('Attempting to update Netlify env var with default password...');

    // Обновляем переменную окружения через Netlify API
    const netlifyResult = await updateNetlifyEnvVar(hashedPassword);
    
    if (netlifyResult.success) {
      console.log('Password reset successful');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Пароль сброшен к значению по умолчанию',
          defaultPassword: defaultPassword,
          note: 'Используйте пароль "flamingo2024" для входа в админку. Изменения применятся при следующем деплое.',
          hashedPassword: hashedPassword
        })
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Не удалось сбросить пароль автоматически',
          error: netlifyResult.error,
          manualInstructions: [
            '1. Перейдите в Netlify Dashboard → Site settings → Environment variables',
            '2. Найдите ADMIN_PASSWORD и обновите значение на: flamingo2024',
            '3. Передеплойте сайт'
          ]
        })
      };
    }

  } catch (error) {
    console.error('Password reset error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера при сбросе пароля' })
    };
  }
};

// Функция для обновления переменной окружения в Netlify
async function updateNetlifyEnvVar(hashedPassword) {
  try {
    const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;
    
    if (!netlifyToken || !siteId) {
      console.log('Netlify API credentials not configured');
      return {
        success: false,
        error: 'Netlify API токен или Site ID не настроены'
      };
    }

    console.log('Updating Netlify environment variable...');
    
    // Обновляем переменную окружения через Netlify API
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        {
          key: 'ADMIN_PASSWORD',
          values: [hashedPassword],
          scopes: ['builds', 'functions']
        }
      ])
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Netlify API error:', response.status, errorData);
      return {
        success: false,
        error: `Netlify API error: ${response.status}`
      };
    }

    console.log('Environment variable updated successfully');
    
    return {
      success: true
    };

  } catch (error) {
    console.error('Netlify API update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}