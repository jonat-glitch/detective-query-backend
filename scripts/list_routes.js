const fs = require('fs');
const path = require('path');
const routeDir = 'routes';
const files = fs.readdirSync(routeDir).filter(f => f.endsWith('.js'));
const routePattern = /router\.(get|post|put|delete)\(["'`]([^"'`,]+)/g;
const allRoutes = [];
for (const f of files) {
  const content = fs.readFileSync(path.join(routeDir, f), 'utf8');
  let m;
  while ((m = routePattern.exec(content)) !== null) {
    allRoutes.push({ file: f, method: m[1].toUpperCase(), path: m[2] });
  }
  routePattern.lastIndex = 0;
}
allRoutes.sort((a,b) => a.path.localeCompare(b.path)).forEach(r => {
  console.log(`${r.method.padEnd(7)} ${r.path.padEnd(50)} ${r.file}`);
});
console.log('\nTotal routes:', allRoutes.length);
