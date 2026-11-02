const os = require('os');
const nets = os.networkInterfaces();
let ipAddress = '127.0.0.1';

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      ipAddress = net.address;
      break;
    }
  }
}
console.log(ipAddress);