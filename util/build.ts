import fs from 'fs-extra';
import childProcess from 'child_process';

try {
    // Remove current build
    fs.removeSync('./dist/');
    childProcess.exec('tsc --p tsconfig.prod.json');
} catch (err) {
    console.log(err);
}
