// Netlify Function для смены пароля администратора
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

    // Проверяем текущий пароль
    if (currentPassword !== storedPassword) {
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

    // В реальном приложении здесь бы мы обновили пароль в базе данных
    // или в переменных окружения Netlify через API
    // Для демо-версии просто возвращаем успех
    
    console.log('Password change requested for admin');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Пароль успешно изменен',
        note: 'В демо-версии изменения не сохраняются. Для продакшена настройте переменные окружения Netlify.'
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