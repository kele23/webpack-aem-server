const RepoReader = require('../repo-reader');
const fs = require('fs');
const path = require('path');

class StaticRepositoryReader extends RepoReader {
    constructor(basePath, repoDir) {
        super(basePath);
        this.sourceDir = repoDir;
    }

    get(repoPath, ctx) {
        const value = this._getFromCtx(repoPath, ctx);
        if (value && !value.tobecontinue) return value;

        let basePath = repoPath;
        if (repoPath.indexOf('jcr:content') >= 0) {
            basePath = repoPath.substring(0, repoPath.indexOf('jcr:content') - 1);
        }

        //json extension
        let finalPath = this.sourceDir + basePath + '.json';
        let binaryFile = false;
        if (!fs.existsSync(finalPath)) {
            //folder and json extension
            finalPath = this.sourceDir + basePath + '/index.json';
            if (!fs.existsSync(finalPath)) {
                //take as binary file
                finalPath = this.sourceDir + basePath;
                binaryFile = true;
                if (!fs.existsSync(finalPath)) {
                    return null;
                }
            }
        }

        let data = null;
        if (binaryFile) {
            //binary file or folder
            data = {
                'sling:resourceType': fs.statSync(finalPath).isDirectory() ? 'sling/Folder' : 'nt/file',
                tobecontinue: false,
            };
        } else {
            // json file ( read it )
            const source = this._checkNesting(fs.readFileSync(finalPath, 'utf8'), finalPath);
            data = {
                ...JSON.parse(source),
                tobecontinue: false,
            };

            // read sibling items
            if (fs.existsSync(this.sourceDir + basePath) && fs.statSync(this.sourceDir + basePath).isDirectory()) {
                const names = fs
                    .readdirSync(this.sourceDir + basePath, { withFileTypes: true })
                    .map((dirent) => dirent.name)
                    .filter((name) => name != 'index.json')
                    .map((name) => (name.endsWith('.json') ? name.substring(0, name.indexOf('.json')) : name));

                for (let name of names) {
                    data[name] = { tobecontinue: true };
                }
            }
        }

        this._addToCtx(data, basePath, ctx);
        return this._getFromCtx(repoPath, ctx);
    }

    getSystemPath(repoPath) {
        let basePath = repoPath;
        if (repoPath.indexOf('jcr:content') >= 0) {
            basePath = repoPath.substring(0, repoPath.indexOf('jcr:content') - 1);
        }

        let finalPath = this.sourceDir + basePath + '.json';
        if (!fs.existsSync(finalPath)) {
            //folder and json extension
            finalPath = this.sourceDir + basePath + '/index.json';
            if (!fs.existsSync(finalPath)) {
                //take as binary file
                finalPath = this.sourceDir + basePath;
                if (!fs.existsSync(finalPath)) {
                    return null;
                }
            }
        }
        return finalPath;
    }

    _checkNesting(source, fsPath) {
        const dir = path.dirname(fsPath);
        return source.replace(/"##REF:([^"]+)"/g, (match, $1) => {
            const filePath = path.join(dir, $1);
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
            return 'null';
        });
    }
}

module.exports = StaticRepositoryReader;
