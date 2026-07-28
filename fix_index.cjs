const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

if (!code.includes('manifest.json')) {
    code = code.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />\n    <link rel="manifest" href="/manifest.json" />\n    <meta name="apple-mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
    fs.writeFileSync('index.html', code);
}
