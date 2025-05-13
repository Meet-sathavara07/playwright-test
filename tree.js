const fs = require('fs');
const path = require('path');

function tree(dir, level = 0, isLast = true) {
  const files = fs.readdirSync(dir);

  files.forEach((file, index) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Determine if this is the last item at the current level
    const isLastItem = index === files.length - 1;
    const prefix = `${'│   '.repeat(level)}${isLastItem ? '└── ' : '├── '}`;
    
    // Print the current file or directory
    console.log(`${prefix}${file}`);
    
    // Check if it's a directory
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git') {
        // If it's node_modules or .git, print it but don't recurse into it
        console.log(`${'│   '.repeat(level + 1)}└── ...`);
      } else {
        // Recurse into the directory
        tree(filePath, level + 1, isLastItem);
      }
    }
  });

  // Handle end-of-level formatting without adding extra lines
  if (level > 0 && files.length > 0) {
    // Print a continuation line if not the last directory in the tree
    if (!isLast) {
      console.log(`${'│   '.repeat(level - 1)}│`);
    }
  }
}

const directoryPath = path.resolve(process.argv[2] || '.');
console.log(path.basename(directoryPath) + '/');
tree(directoryPath);
