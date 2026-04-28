const fs=require('fs');
let c=fs.readFileSync('E:/nano_canvas/src/contexts/CanvasContext.tsx','utf8');
c=c.replace(/,\s*} from 'react';/g,'} from \'react\';');
fs.writeFileSync('E:/nano_canvas/src/contexts/CanvasContext.tsx',c);
