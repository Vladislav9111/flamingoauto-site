const bcrypt = require('bcryptjs');

/**
 * Хеширует пароль с использованием bcrypt
 * @param {string} password - Пароль для хеширования
 * @returns {Promise<string>} - Хешированный пароль
 */
async function hashPassword(password) {
  const saltRounds = 12; // Высокий уровень безопасности
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Проверяет пароль против хеша
 * @param {string} password - Введенный пароль
 * @param {string} hash - Сохраненный хеш
 * @returns {Promise<boolean>} - Результат проверки
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Проверяет, является ли строка хешем bcrypt
 * @param {string} str - Строка для проверки
 * @returns {boolean} - true если это хеш bcrypt
 */
function isHashedPassword(str) {
  // bcrypt хеши начинаются с $2a$, $2b$, $2x$ или $2y$
  return /^\$2[abxy]\$\d+\$/.test(str);
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashedPassword
};