const path = require('path');
const { spawn } = require('child_process');

const exePath = path.join(__dirname, 'dist', 'win-unpacked', 'MiniBox.exe');
const icoPath = path.join(__dirname, 'assets', 'MiniBoxIcon2.ico');

// Try using rcedit from electron-builder
const rceditBin = path.join(__dirname, 'node_modules', 'rcedit', 'bin', 'rcedit.exe');

function setIcon() {
  return new Promise((resolve, reject) => {
    console.log('Setting icon...');
    console.log('Executable:', exePath);
    console.log('Icon:', icoPath);
    
    const proc = spawn(rceditBin, [exePath, '--set-icon', icoPath]);
    
    proc.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('Icon successfully updated!');
        resolve();
      } else {
        reject(new Error(`rcedit exited with code ${code}`));
      }
    });
  });
}

setIcon().catch(err => {
  console.error('Failed to set icon:', err.message);
  process.exit(1);
});
