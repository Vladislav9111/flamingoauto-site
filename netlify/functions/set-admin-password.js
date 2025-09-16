// Функция для установки конкретного пароля администратора
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
    console.log('Set password request received');
    
    const { newPassword, confirmPassword } = JSON.parse(event.body);

    if (!newPassword || !confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Не указан пароль или подтверждение' })
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Пароли не совпадают' })
      };
    }

    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Пароль должен содержать минимум 6 символов' })
      };
    }

    // Хешируем новый пароль
    console.log('Hashing new password...');
    const hashedPassword = await hashPassword(newPassword);
    
    console.log('Attempting to update Netlify env var with new password...');

    // Обновляем переменную окружения через Netlify API
    const netlifyResult = await updateNetlifyEnvVar(hashedPassword);
    
    if (netlifyResult.success) {
      console.log('Password set successful');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Пароль успешно установлен и зашифрован',
          password: newPassword,
          note: 'Используйте новый пароль для входа в админку. Изменения применятся при следующем деплое.',
          hashedPassword: hashedPassword
        })
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Не удалось установить пароль автоматически',
          error: netlifyResult.error,
          hashedPassword: hashedPassword,
          manualInstructions: [
            '1. Перейдите в Netlify Dashboard → Site settings → Environment variables',
            '2. Найдите ADMIN_PASSWORD и обновите значение на приведенный выше хеш',
            '3. Передеплойте сайт'
          ]
        })
      };
    }

  } catch (error) {
    console.error('Set password error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера при установке пароля' })
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