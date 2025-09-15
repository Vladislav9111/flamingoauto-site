// Netlify Function для получения списка постов
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Проверяем наличие GitHub токена
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GitHub token not configured');
    }

    // Получаем список файлов из папки content/posts (только JSON)
    const response = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/posts`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'Flamingo-Auto-Admin'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);
      
      if (response.status === 404) {
        // Папка не существует, возвращаем пустой массив
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify([])
        };
      }
      
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    const files = await response.json();
    const posts = [];

    // Получаем содержимое каждого JSON файла
    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const fileResponse = await fetch(file.download_url);
          const postData = await fileResponse.json();
          posts.push({
            ...postData,
            filename: file.name,
            sha: file.sha
          });
        } catch (error) {
          console.warn(`Failed to load post ${file.name}:`, error);
        }
      }
    }

    // Сортируем по дате создания (новые первыми)
    posts.sort((a, b) => new Date(b.created) - new Date(a.created));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(posts)
    };

  } catch (error) {
    console.error('Get posts error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
};