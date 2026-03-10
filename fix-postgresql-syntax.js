const fs = require('fs');
const path = require('path');

// Function to convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertSqliteToPostgres(sqlQuery) {
  let paramCount = 0;
  return sqlQuery.replace(/\?/g, () => {
    paramCount++;
    return `$${paramCount}`;
  });
}

// Function to process a repository file
function processRepositoryFile(filePath) {
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Find all SQL queries with ? placeholders
  const sqlRegex = /(['"`])((?:(?!\1)[^\\]|\\.)*)(\?(?:(?:(?!\1)[^\\]|\\.)*\?)*)((?:(?!\1)[^\\]|\\.)*)\1/g;
  
  content = content.replace(sqlRegex, (match, quote, before, questionMarks, after) => {
    if (questionMarks.includes('?')) {
      const converted = convertSqliteToPostgres(before + questionMarks + after);
      modified = true;
      return quote + converted + quote;
    }
    return match;
  });
  
  // Also handle template literals with SQL
  const templateRegex = /`([^`]*\?[^`]*)`/g;
  content = content.replace(templateRegex, (match, sqlContent) => {
    if (sqlContent.includes('?')) {
      const converted = convertSqliteToPostgres(sqlContent);
      modified = true;
      return '`' + converted + '`';
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed for ${filePath}`);
  }
}

// Get all repository files
const repositoriesDir = path.join(__dirname, 'repositories');
const files = fs.readdirSync(repositoriesDir)
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(repositoriesDir, file));

console.log('Converting SQLite syntax to PostgreSQL syntax...\n');

files.forEach(processRepositoryFile);

console.log('\n✅ All repository files processed!');
console.log('\nNote: Please review the changes manually to ensure correctness.');