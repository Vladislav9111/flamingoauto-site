exports.handler = async (event, context) => {
  try {
    console.log('🔄 Загружаем посты через GitHub API...');
    
    const owner = 'Vladislav9111';
    const repo = 'flamingoauto-site';
    const path = 'content/blog';
    
    // Получаем список файлов в папке content/blog
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    
    if (!response.ok) {
      console.error('❌ Ошибка GitHub API:', response.status);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify([]),
      };
    }

    const files = await response.json();
    const mdFiles = files.filter(file => file.name.endsWith('.md'));
    console.log('📝 Найдено .md файлов:', mdFiles.length);

    const posts = [];

    // Загружаем содержимое каждого файла
    for (const file of mdFiles) {
      try {
        const fileResponse = await fetch(file.download_url);
        const content = await fileResponse.text();
        
        // Парсим frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        
        if (!frontmatterMatch) {
          console.log('⚠️ Файл без frontmatter:', file.name);
          continue;
        }

        const frontmatterText = frontmatterMatch[1];
        const bodyContent = frontmatterMatch[2];
        
        // Парсим YAML frontmatter
        const frontmatter = {};
        frontmatterText.split('\n').forEach(line => {
          const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
          if (match) {
            const [, key, value] = match;
            frontmatter[key] = value.replace(/"/g, ''); // Убираем кавычки
          }
        });

        // Создаем объект поста
        const post = {
          id: file.name.replace('.md', ''),
          title: frontmatter.title || 'Без названия',
          content: bodyContent.trim(),
          author: frontmatter.author || 'Flamingo Auto',
          date: frontmatter.date || new Date().toISOString(),
          locale: frontmatter.locale || frontmatter.lang || 'all',
          published: frontmatter.published !== 'false' && frontmatter.published !== false,
          excerpt: frontmatter.excerpt || ''
        };

        // Добавляем только опубликованные посты
        if (post.published) {
          posts.push(post);
        }

      } catch (error) {
        console.error('❌ Ошибка загрузки файла', file.name, ':', error);
      }
    }

    // Сортируем по дате (новые первыми)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('✅ Возвращаем постов:', posts.length);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(posts),
    };

  } catch (error) {
    console.error('❌ Ошибка функции:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
    };
  }
};