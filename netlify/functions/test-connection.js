// Простая тестовая функция для проверки работы Netlify Functions
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  console.log('Test connection function called');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', event.headers);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Netlify Functions работают!',
      timestamp: new Date().toISOString(),
      method: event.httpMethod
    })
  };
};