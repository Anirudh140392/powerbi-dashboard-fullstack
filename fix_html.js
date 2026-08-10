const fs = require('fs');

let html = fs.readFileSync('backend/src/sales_enablement.html', 'utf8');

// 1. Remove margin:0 auto; on table and add align="center"
html = html.replace(
    /class="email-shell"\s*style="width:100%;max-width:676px;margin:0 auto;"/g,
    'align="center"\n       class="email-shell"\n       style="width:100%;max-width:676px;"'
);

// 2. Replace the severity badge table's margin-top:6px with a spacer table
html = html.replace(
    /<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">/g,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n<tr><td style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>\n</table>\n<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
);

// 3. Add bgcolor attribute to tags with background-color
html = html.replace(/<(body|center|table|td)\b([^>]*)style="([^"]*?background-color:\s*(#[a-fA-F0-9]{3,6})[^"]*)"([^>]*)>/gi, (match, tag, attr1, style, color, attr2) => {
    // If it already has bgcolor, skip
    if (/bgcolor=/i.test(match)) return match;
    
    // Construct the new tag
    return `<${tag} bgcolor="${color}"${attr1}style="${style}"${attr2}>`;
});

// Also handle the case where style has line breaks (e.g., across multiple lines)
// wait, the previous regex might not catch multiline attributes if [^>]* doesn't match newlines well? Actually [^>]* matches newlines in JS? No, it does! 
// But let's check if there are cases like background-color:\n#fff.
// The safe way in JS is to use [\s\S] instead of . if needed, but [^>] matches newlines.

fs.writeFileSync('backend/src/sales_enablement_fixed.html', html);
console.log("Fixed!");
