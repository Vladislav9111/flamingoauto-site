// Функция для генерации хешированного пароля
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
    console.log('Hash password request received');
    
    const { password } = JSON.parse(event.body);

    if (!password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Пароль не указан' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Пароль должен содержать минимум 6 символов' })
      };
    }

    console.log('Hashing password...');
    const hashedPassword = await hashPassword(password);
    console.log('Password hashed successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Пароль успешно зашифрован',
        hashedPassword: hashedPassword,
        instructions: [
          '1. Скопируйте хеш выше',
          '2. Перейдите в настройки Netlify → Environment variables',
          '3. Установите ADMIN_PASSWORD = скопированный хеш',
          '4. Передеплойте сайт'
        ]
      })
    };

  } catch (error) {
    console.error('Hash password error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ошибка при хешировании пароля' })
    };
  }
};