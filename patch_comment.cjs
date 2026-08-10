const fs = require('fs');
let code = fs.readFileSync('src/routes/api.ts', 'utf8');

code = code.replace(`    // Note: trackData has {id, artistIds} not {track: {id, artists: {id}[]}}
    // So we inline the logic or adjust the helper. Let's create another helper or just leave it for now.\n`, '');

fs.writeFileSync('src/routes/api.ts', code);
console.log('Success');
