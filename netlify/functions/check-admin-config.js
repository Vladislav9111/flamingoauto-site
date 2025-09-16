// Функция для проверки конфигурации админа
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
    const adminPassword = process.env.ADMIN_PASSWORD;
    const githubToken = process.env.GITHUB_TOKEN;
    
    console.log('Admin config check requested');
    console.log('ADMIN_PASSWORD env var:', adminPassword ? 'SET' : 'NOT SET');
    console.log('GITHUB_TOKEN env var:', githubToken ? 'SET' : 'NOT SET');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        config: {
          adminPasswordSet: !!adminPassword,
          adminPasswordDefault: !adminPassword || adminPassword === 'flamingo2024',
          githubTokenSet: !!githubToken,
          defaultPassword: adminPassword || 'flamingo2024'
        },
        message: 'Конфигурация проверена'
      })
    };

  } catch (error) {
    console.error('Config check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ошибка проверки конфигурации' })
    };
  }
};