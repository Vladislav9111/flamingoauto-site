exports.handler = async (event, context) => {
  try {
    console.log('🔧 Test function called');
    
    // Простой тест без зависимостей
    const testPosts = [
      {
        id: 'test-1',
        title: 'Тестовая статья 1',
        content: 'Это тестовая статья для проверки работы функции',
        author: 'Test Author',
        date: new Date().toISOString(),
        locale: 'ru',
        published: true
      },
      {
        id: 'test-2', 
        title: 'Test Article 2',
        content: 'This is a test article in Estonian',
        author: 'Test Author',
        date: new Date().toISOString(),
        locale: 'et',
        published: true
      }
    ];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Test function works!',
        posts: testPosts,
        environment: {
          nodeVersion: process.version,
          cwd: process.cwd(),
          __dirname: __dirname
        }
      }),
    };
  } catch (error) {
    console.error('❌ Test function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack
      }),
    };
  }
};