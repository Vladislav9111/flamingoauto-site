// Netlify Function для создания постов в блоге
exports.handler = async (event, context) => {
  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const post = JSON.parse(event.body);
    
    // Валидация
    if (!post.title || !post.excerpt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Title and excerpt are required' })
      };
    }

    // GitHub API запрос
    const fileName = `content/posts/${post.id}.json`;
    const content = JSON.stringify(post, null, 2);
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');

    const githubResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Flamingo-Auto-Admin'
      },
      body: JSON.stringify({
        message: `Add blog post: ${post.title}`,
        content: encodedContent,
        committer: {
          name: 'Flamingo Auto',
          email: 'admin@flamingoauto.eu'
        }
      })
    });

    if (!githubResponse.ok) {
      const error = await githubResponse.json();
      throw new Error(error.message || 'GitHub API error');
    }

    const result = await githubResponse.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        filename: fileName,
        sha: result.content.sha 
      })
    };

  } catch (error) {
    console.error('Create post error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
};