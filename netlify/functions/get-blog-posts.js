// Netlify Function для получения списка постов
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const posts = [];

    // Получаем посты из content/posts (JSON файлы)
    try {
      const postsResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/posts`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'Flamingo-Auto-Admin'
        }
      });

      if (postsResponse.ok) {
        const postsFiles = await postsResponse.json();
        
        for (const file of postsFiles) {
          if (file.name.endsWith('.json')) {
            try {
              const fileResponse = await fetch(file.download_url);
              const postData = await fileResponse.json();
              posts.push({
                ...postData,
                filename: file.name,
                sha: file.sha,
                type: 'json',
                folder: 'content/posts'
              });
            } catch (error) {
              console.warn(`Failed to load JSON post ${file.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch from content/posts:', error);
    }

    // Получаем посты из content/blog (Markdown файлы)
    try {
      const blogResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/blog`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'Flamingo-Auto-Admin'
        }
      });

      if (blogResponse.ok) {
        const blogFiles = await blogResponse.json();
        
        for (const file of blogFiles) {
          if (file.name.endsWith('.md')) {
            try {
              const fileResponse = await fetch(file.download_url);
              const markdownContent = await fileResponse.text();
              
              // Парсим frontmatter из markdown
              const frontmatterMatch = markdownContent.match(/^---\n([\s\S]*?)\n---/);
              if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const content = markdownContent.replace(/^---\n[\s\S]*?\n---\n/, '');
                
                // Простой парсинг YAML frontmatter
                const post = {
                  filename: file.name,
                  sha: file.sha,
                  type: 'markdown',
                  folder: 'content/blog',
                  content: content.trim()
                };
                
                // Парсим поля frontmatter
                const lines = frontmatter.split('\n');
                for (const line of lines) {
                  const match = line.match(/^(\w+):\s*(.+)$/);
                  if (match) {
                    const [, key, value] = match;
                    post[key] = value.replace(/^["']|["']$/g, ''); // Убираем кавычки
                  }
                }
                
                // Устанавливаем дефолтные значения если нет в frontmatter
                if (!post.created && post.date) {
                  post.created = post.date;
                }
                if (!post.author) {
                  post.author = 'Flamingo Auto';
                }
                if (!post.excerpt && post.content) {
                  post.excerpt = post.content.substring(0, 150) + '...';
                }
                if (!post.locale) {
                  post.locale = 'ru';
                }
                
                posts.push(post);
              }
            } catch (error) {
              console.warn(`Failed to load markdown post ${file.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch from content/blog:', error);
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