const fs = require('fs');
let appJs = fs.readFileSync('src/frontend/app.js', 'utf8');

// We need to be careful with JS string concatenation vs literal template strings.
// Let's look for button elements that don't have aria-labels or titles and are genuinely icon-only.

const btnRegex = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
let newAppJs = "";
let lastIndex = 0;
let match;

while ((match = btnRegex.exec(appJs)) !== null) {
  const btnAttrs = match[1];
  const btnContent = match[2].trim();
  const fullMatch = match[0];
  const matchIndex = match.index;

  newAppJs += appJs.slice(lastIndex, matchIndex);

  const isIconOnly = /^(?:[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F004}-\u{1F0CF}\u{1F170}-\u{1F251}\u{1F700}-\u{1F773}\u{1F780}-\u{1F8FF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25FD}\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2705}\u{270A}-\u{270D}\u{2728}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2795}-\u{2797}\u{27B0}\u{27BF}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{2122}\u{00A9}\u{00AE}]|<svg[^>]*>[\s\S]*?<\/svg>|&\w+;|\\u\w+|)$/u.test(btnContent);
  const isCloseButton = /^(?:×|&times;|✕|\\u2715|x|X)$/.test(btnContent);

  // Exclude buttons with SwedishMode ternary operators because they contain literal JS code, not actual button content text in JS files building DOM elements
  const isJSStringOp = btnContent.includes('swedishMode') || btnContent.includes('+');

  if ((isIconOnly || isCloseButton) && !isJSStringOp && !btnAttrs.includes('aria-label') && !btnAttrs.includes('title')) {
     let replacementAttrs = btnAttrs;
     let label = "Button";
     if (isCloseButton || btnContent.includes('×') || btnContent.includes('&times;')) label = "Close";
     else if (btnContent.includes('⚙️')) label = "Settings";
     else if (btnContent.includes('👁️')) label = "View";
     else if (btnContent.includes('🙈')) label = "Hide";
     else if (btnContent.includes('🗑️')) label = "Delete";
     else if (btnContent.includes('🔍')) label = "Search";
     else if (btnContent.includes('🔄')) label = "Refresh";
     else if (btnContent.includes('♥') || btnContent.includes('💛')) label = "Favorite";
     else if (btnContent.includes('✨')) label = "Sparkle";
     else if (btnContent.includes('👑')) label = "Crown";

     // IMPORTANT: The aria-label is inserted as a static string, NO template literals here
     const newTag = `<button${replacementAttrs} aria-label="${label}">${match[2]}</button>`;
     newAppJs += newTag;
  } else {
     newAppJs += fullMatch;
  }

  lastIndex = btnRegex.lastIndex;
}

newAppJs += appJs.slice(lastIndex);

fs.writeFileSync('src/frontend/app.js', newAppJs, 'utf8');
