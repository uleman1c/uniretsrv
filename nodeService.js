import { Service } from 'node-windows'
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'index.js');

const dirs = __dirname.split(path.sep)

const serviceName = dirs[dirs.length - 1]

// Create a new service object
var svc = new Service({
  name:'node ' + serviceName,
  description: 'The node js ' + serviceName + ' web server.',
  script: filePath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
  //, workingDirectory: '...'
  //, allowServiceLogon: true
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();


