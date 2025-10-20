// Netlify Function для безопасного получения конфигурации
exports.handler = async (event, context) => {
  // Проверяем метод запроса
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Возвращаем только необходимые переменные окружения
    const config = {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      // НЕ возвращаем Telegram токены в браузер для безопасности
      hasGithubToken: !!process.env.GITHUB_TOKEN
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(config)
    };
  } catch (error) {
    console.error('Config error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({
    hasGithubToken: !!process.env.GITHUB_TOKEN,
    repoOwner: process.env.GITHUB_REPO_OWNER || null,
    repoName: process.env.GITHUB_REPO_NAME || null
  })
};
