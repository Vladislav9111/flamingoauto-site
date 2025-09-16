// Функция для проверки и помощи в настройке автообновления
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Auto-update setup check requested');
    
    // Проверяем наличие необходимых переменных окружения
    const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Определяем статус настройки
    const setupStatus = {
      netlifyTokenSet: !!netlifyToken,
      siteIdSet: !!siteId,
      adminPasswordSet: !!adminPassword,
      autoUpdateReady: !!(netlifyToken && siteId)
    };

    // Генерируем инструкции на основе текущего состояния
    const instructions = generateInstructions(setupStatus);
    
    // Определяем общий статус
    let overallStatus = 'incomplete';
    let statusMessage = 'Требуется настройка';
    
    if (setupStatus.autoUpdateReady) {
      overallStatus = 'ready';
      statusMessage = 'Автообновление настроено и готово к работе';
    } else if (setupStatus.netlifyTokenSet || setupStatus.siteIdSet) {
      overallStatus = 'partial';
      statusMessage = 'Частичная настройка - требуются дополнительные переменные';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: overallStatus,
        message: statusMessage,
        setup: setupStatus,
        instructions: instructions,
        nextSteps: getNextSteps(setupStatus)
      })
    };

  } catch (error) {
    console.error('Setup check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ошибка проверки настройки автообновления' })
    };
  }
};

function generateInstructions(status) {
  const instructions = [];
  
  if (!status.netlifyTokenSet) {
    instructions.push({
      step: 1,
      title: 'Создайте Netlify Access Token',
      description: 'Перейдите в Netlify Dashboard → User settings → Applications → Personal access tokens',
      action: 'Создайте токен с описанием "Admin Password Auto Update"'
    });
  }

  if (!status.siteIdSet) {
    instructions.push({
      step: status.netlifyTokenSet ? 2 : 1,
      title: 'Найдите Site ID',
      description: 'В настройках сайта найдите Site details → Site ID',
      action: 'Скопируйте значение Site ID'
    });
  }

  if (!status.netlifyTokenSet || !status.siteIdSet) {
    const stepNum = instructions.length + 1;
    instructions.push({
      step: stepNum,
      title: 'Установите переменные окружения',
      description: 'Site settings → Environment variables',
      action: 'Добавьте NETLIFY_ACCESS_TOKEN и NETLIFY_SITE_ID'
    });

    instructions.push({
      step: stepNum + 1,
      title: 'Передеплойте сайт',
      description: 'Deploys → Trigger deploy → Deploy site',
      action: 'Дождитесь завершения деплоя'
    });
  }

  return instructions;
}

function getNextSteps(status) {
  if (status.autoUpdateReady) {
    return [
      'Протестируйте автообновление на странице test-netlify-functions.html',
      'Попробуйте сменить пароль в админке',
      'Убедитесь, что получаете сообщение "автоматически обновлен"'
    ];
  }

  if (!status.netlifyTokenSet && !status.siteIdSet) {
    return [
      'Создайте Personal Access Token в Netlify',
      'Найдите Site ID в настройках сайта',
      'Добавьте обе переменные в Environment variables',
      'Передеплойте сайт'
    ];
  }

  if (!status.netlifyTokenSet) {
    return [
      'Создайте Personal Access Token в Netlify Dashboard',
      'Добавьте NETLIFY_ACCESS_TOKEN в Environment variables',
      'Передеплойте сайт'
    ];
  }

  if (!status.siteIdSet) {
    return [
      'Найдите Site ID в настройках сайта',
      'Добавьте NETLIFY_SITE_ID в Environment variables',
      'Передеплойте сайт'
    ];
  }

  return ['Передеплойте сайт для применения изменений'];
}