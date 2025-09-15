// Netlify Function для удаления поста
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { filename, sha, title } = JSON.parse(event.body);
    
    // Валидация
    if (!filename || !sha) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Filename and SHA are required' })
      };
    }

    // Определяем папку по расширению файла
    const folder = filename.endsWith('.json') ? 'content/posts' : 'content/blog';
    
    // GitHub API запрос для удаления файла
    const githubResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/${folder}/${filename}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Flamingo-Auto-Admin'
      },
      body: JSON.stringify({
        message: `Delete blog post: ${title || filename}`,
        sha: sha,
        committer: {
          name: 'Flamingo Auto Admin',
          email: 'admin@flamingoauto.eu'
        }
      })
    });

    if (!githubResponse.ok) {
      const error = await githubResponse.json();
      throw new Error(error.message || 'GitHub API error');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Post deleted successfully' 
      })
    };

  } catch (error) {
    console.error('Delete post error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
};