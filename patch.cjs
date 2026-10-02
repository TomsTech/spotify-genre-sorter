const fs = require('fs');
const content = fs.readFileSync('src/lib/logger.ts', 'utf8');

const updated = content.replace(
  `    } else {
      // eslint-disable-next-line no-console
      console.log(\`[\${entry.level.toUpperCase()}] \${entry.message}\`);
    }`,
  `    } else if (entry.level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(\`[\${entry.level.toUpperCase()}] \${entry.message}\`);
    } else if (entry.level === 'debug') {
      // eslint-disable-next-line no-console
      console.debug(\`[\${entry.level.toUpperCase()}] \${entry.message}\`);
    } else {
      // eslint-disable-next-line no-console
      console.info(\`[\${entry.level.toUpperCase()}] \${entry.message}\`);
    }`
);

fs.writeFileSync('src/lib/logger.ts', updated);
