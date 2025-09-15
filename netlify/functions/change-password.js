// Netlify Function для смены пароля администратора
exports.handler = async (event, context) => {
  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { currentPassword, newPassword } = JSON.parse(event.body);

    // Проверяем входные данные
    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Не указан текущий или новый пароль' })
      };
    }

    // Получаем текущий пароль из переменных окружения
    const storedPassword = process.env.ADMIN_PASSWORD || 'flamingo2024';

    // Проверяем текущий пароль
    if (currentPassword !== storedPassword) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Неверный текущий пароль' })
      };
    }

    // Проверяем длину нового пароля
    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Новый пароль должен содержать минимум 6 символов' })
      };
    }

    // В реальном приложении здесь бы мы обновили пароль в базе данных
    // или в переменных окружения Netlify через API
    // Для демо-версии просто возвращаем успех
    
    console.log('Password change requested for admin');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
    };
  }
};