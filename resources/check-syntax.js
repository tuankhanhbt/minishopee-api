var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var rootDirectory = path.join(__dirname, '..');
var targets = ['app.js', 'bin/www', 'controllers', 'routes', 'schemas', 'utils'];

function collectJavaScriptFiles(targetPath) {
  var absolutePath = path.join(rootDirectory, targetPath);

  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  var stats = fs.statSync(absolutePath);

  if (stats.isFile()) {
    return absolutePath.endsWith('.js') || path.basename(absolutePath) === 'www' ? [absolutePath] : [];
  }

  return fs.readdirSync(absolutePath).reduce(function (files, entryName) {
    return files.concat(collectJavaScriptFiles(path.join(targetPath, entryName)));
  }, []);
}

var filesToCheck = targets.reduce(function (files, target) {
  return files.concat(collectJavaScriptFiles(target));
}, []);

filesToCheck.sort();

for (var index = 0; index < filesToCheck.length; index += 1) {
  var result = childProcess.spawnSync(process.execPath, ['--check', filesToCheck[index]], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Syntax check passed for ' + filesToCheck.length + ' JavaScript files.');
