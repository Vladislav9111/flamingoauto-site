// Netlify Function для смены пароля администратора
const { hashPassword, verifyPassword, isHashedPassword } = require('./utils/password-utils');

exports.handler = async (event, context) => {
  // CORS headers
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

  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Change password request received');
    console.log('Request body:', event.body);
    
    const { currentPassword, newPassword } = JSON.parse(event.body);

    // Проверяем входные данные
    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Не указан текущий или новый пароль' })
      };
    }

    // Получаем текущий пароль из переменных окружения
    const storedPassword = process.env.ADMIN_PASSWORD || 'flamingo2024';
    
    console.log('Stored password from env:', storedPassword ? 'SET' : 'NOT SET');
    console.log('Password is hashed:', isHashedPassword(storedPassword));

    // Проверяем текущий пароль (поддерживаем как хешированные, так и обычные пароли)
    let passwordValid = false;
    
    if (isHashedPassword(storedPassword)) {
      // Проверяем хешированный пароль
      passwordValid = await verifyPassword(currentPassword, storedPassword);
      console.log('Verified hashed password:', passwordValid);
    } else {
      // Проверяем обычный пароль (для обратной совместимости)
      passwordValid = currentPassword === storedPassword;
      console.log('Verified plain password:', passwordValid);
    }

    if (!passwordValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Неверный текущий пароль' })
      };
    }

    // Проверяем длину нового пароля
    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Новый пароль должен содержать минимум 6 символов' })
      };
    }

    // Хешируем новый пароль
    console.log('Password change requested for admin');
    console.log('Current password check passed');
    console.log('New password length:', newPassword.length);
    console.log('Hashing new password...');
    
    const hashedNewPassword = await hashPassword(newPassword);
    console.log('New password hashed successfully');
    
    // В реальном приложении здесь бы мы сохранили хешированный пароль
    // в базе данных или обновили переменную окружения через Netlify API
    
    // Для демо-версии возвращаем хешированный пароль в ответе
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Пароль успешно изменен и зашифрован',
        note: 'Новый пароль зашифрован с помощью bcrypt. Для продакшена сохраните хеш в переменных окружения.',
        hashedPassword: hashedNewPassword,
        instructions: 'Скопируйте хеш выше и установите его как ADMIN_PASSWORD в настройках Netlify'
      })
    };

  } catch (error) {
    console.error('Password change error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
    };
  }
};