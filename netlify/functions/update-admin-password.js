// Функция для автоматического обновления пароля в Netlify
const { hashPassword, verifyPassword, isHashedPassword } = require('./utils/password-utils');

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
    console.log('Auto password update request received');
    
    const { currentPassword, newPassword } = JSON.parse(event.body);

    // Проверяем входные данные
    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Не указан текущий или новый пароль' })
      };
    }

    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Новый пароль должен содержать минимум 6 символов' })
      };
    }

    // Получаем текущий пароль из переменных окружения
    const storedPassword = process.env.ADMIN_PASSWORD || 'HDoSf4qGf2aV4Yp';
    
    console.log('Verifying current password...');
    
    // Проверяем текущий пароль
    let passwordValid = false;
    
    if (isHashedPassword(storedPassword)) {
      passwordValid = await verifyPassword(currentPassword, storedPassword);
    } else {
      passwordValid = currentPassword === storedPassword;
    }

    if (!passwordValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Неверный текущий пароль' })
      };
    }

    console.log('Current password verified, hashing new password...');
    
    // Хешируем новый пароль
    const hashedNewPassword = await hashPassword(newPassword);
    
    console.log('New password hashed, attempting to update Netlify env var...');

    // Пытаемся обновить переменную окружения через Netlify API
    const netlifyResult = await updateNetlifyEnvVar(hashedNewPassword);
    
    if (netlifyResult.success) {
      console.log('Netlify env var updated successfully');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Пароль успешно изменен и автоматически обновлен в Netlify!',
          note: 'Переменная окружения обновлена. Изменения вступят в силу при следующем деплое сайта.',
          autoUpdated: true,
          deployTriggered: false
        })
      };
    } else {
      // Если автоматическое обновление не удалось, возвращаем хеш для ручной установки
      console.log('Auto update failed, returning hash for manual setup');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Пароль зашифрован, но требует ручной установки',
          note: 'Автоматическое обновление недоступно. Установите хеш вручную в настройках Netlify.',
          autoUpdated: false,
          hashedPassword: hashedNewPassword,
          instructions: [
            '1. Перейдите в Netlify Dashboard → Site settings → Environment variables',
            '2. Обновите ADMIN_PASSWORD = приведенный ниже хеш',
            '3. Нажмите "Save" и передеплойте сайт'
          ],
          error: netlifyResult.error
        })
      };
    }

  } catch (error) {
    console.error('Auto password update error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера при обновлении пароля' })
    };
  }
};

// Функция для обновления переменной окружения в Netlify
async function updateNetlifyEnvVar(hashedPassword) {
  try {
    // Получаем необходимые данные из переменных окружения
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
      success: true,
      deployTriggered: false // Деплой не нужен - переменные применятся при следующем деплое
    };

  } catch (error) {
    console.error('Netlify API update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}