console.log('We will replace \`const keyMeta = list.keys.find(k => k.name === keyName);\` with \`const keyMeta = list.keys[0]?.name === keyName ? list.keys[0] : undefined;\`');
