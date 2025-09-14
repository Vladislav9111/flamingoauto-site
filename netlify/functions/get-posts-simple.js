const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  try {
    console.log('🔄 Простая функция загрузки постов...');
    
    // Пробуем разные пути
    const possiblePaths = [
      path.join(process.cwd(), 'content', 'blog'),
      path.join(__dirname, '..', '..', 'content', 'blog'),
      path.join('/opt/build/repo', 'content', 'blog'),
      path.join('/var/task', 'content', 'blog'),
      path.join('/opt/buildhome/repo', 'content', 'blog'),
      // Добавляем больше вариантов
      path.join(process.env.LAMBDA_TASK_ROOT || '', '..', '..', 'content', 'blog'),
      path.join('/tmp', 'content', 'blog')
    ];

    console.log('🔍 Ищем папку с постами...');
    console.log('process.cwd():', process.cwd());
    console.log('__dirname:', __dirname);
    console.log('LAMBDA_TASK_ROOT:', process.env.LAMBDA_TASK_ROOT);
    
    // Проверяем что вообще есть в корне
    try {
      const rootFiles = fs.readdirSync(process.cwd());
      console.log('📁 Файлы в корне:', rootFiles.slice(0, 10));
    } catch (e) {
      console.log('❌ Не могу прочитать корень:', e.message);
    }

    let postsDirectory = null;
    for (const testPath of possiblePaths) {
      console.log('Проверяем путь:', testPath);
      if (fs.existsSync(testPath)) {
        postsDirectory = testPath;
        console.log('✅ Найдена папка:', postsDirectory);
        break;
      }
    }

    if (!postsDirectory) {
      console.log('❌ Папка с постами не найдена');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify([]),
      };
    }

    // Читаем файлы
    const files = fs.readdirSync(postsDirectory);
    console.log('📁 Все файлы в папке:', files);
    
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    console.log('📝 Markdown файлы:', markdownFiles);
    console.log('📁 Найдено .md файлов:', markdownFiles.length);

    const posts = markdownFiles.map(filename => {
      try {
        const filePath = path.join(postsDirectory, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Простой парсинг frontmatter без gray-matter
        const lines = content.split('\n');
        const frontmatter = {};
        let contentStart = 0;
        
        if (lines[0] === '---') {
          for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '---') {
              contentStart = i + 1;
              break;
            }
            const line = lines[i];
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
              const key = line.substring(0, colonIndex).trim();
              let value = line.substring(colonIndex + 1).trim();
              // Убираем кавычки
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
              }
              frontmatter[key] = value;
            }
          }
        }
        
        const bodyContent = lines.slice(contentStart).join('\n');
        
        return {
          id: filename.replace('.md', ''),
          title: frontmatter.title || 'Без названия',
          content: bodyContent || '',
          author: frontmatter.author || 'Flamingo Auto',
          date: frontmatter.date || new Date().toISOString(),
          locale: frontmatter.locale || frontmatter.lang || 'all',
          published: frontmatter.published !== 'false' && frontmatter.published !== false,
          excerpt: frontmatter.excerpt || ''
        };
      } catch (error) {
        console.error('Ошибка обработки файла', filename, ':', error);
        return null;
      }
    }).filter(post => post && post.published);

    // Сортируем по дате
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
      body: JSON.stringify({ error: error.message }),
    };
  }
};