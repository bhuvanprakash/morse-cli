"use strict";
/**
 * Morse File Icon Theme
 * Custom file icons for Morse-related files
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.morseFileIcons = void 0;
exports.registerMorseFileIconTheme = registerMorseFileIconTheme;
exports.applyIconMappings = applyIconMappings;
exports.getFileIcon = getFileIcon;
exports.getFolderIcon = getFolderIcon;
exports.isMorseFile = isMorseFile;
exports.getMorseFilePatterns = getMorseFilePatterns;
exports.setMorseFileIcons = setMorseFileIcons;
exports.isMorseFileIconsEnabled = isMorseFileIconsEnabled;
const vscode = __importStar(require("vscode"));
/**
 * Morse file icon mappings
 */
exports.morseFileIcons = {
    iconDefinitions: {
        // Morse-specific icons
        '_morse_config': {
            iconPath: './icons/morse.svg',
            fontColor: '#D4A373',
        },
        '_morse_session': {
            iconPath: './icons/session.svg',
            fontColor: '#6B9080',
        },
        '_morse_agent': {
            iconPath: './icons/agent.svg',
            fontColor: '#9B6B6B',
        },
        // Root folders
        '_root_folder': {
            iconPath: './icons/root.svg',
        },
        '_root_folder_open': {
            iconPath: './icons/root-open.svg',
        },
        // Folder icons
        '_folder': {
            iconPath: './icons/folder.svg',
        },
        '_folder_open': {
            iconPath: './icons/folder-open.svg',
        },
        // Common file extensions mapped to custom icons
    },
    fileExtensions: {
        // Morse config files
        'morse': '_morse_config',
        'morserc': '_morse_config',
        'morseyml': '_morse_config',
        // Session files
        'morsesession': '_morse_session',
        'morsechat': '_morse_session',
        // Agent files
        'morseagent': '_morse_agent',
        // Common programming languages
        'ts': 'typescript',
        'tsx': 'typescriptreact',
        'js': 'javascript',
        'jsx': 'javascriptreact',
        'py': 'python',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'kt': 'kotlin',
        'cs': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'c',
        'hpp': 'cpp',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'scala': 'scala',
        'vue': 'vue',
        'svelte': 'svelte',
        // Web technologies
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'svg': 'svg',
        // Config files
        'toml': 'config',
        'ini': 'config',
        'conf': 'config',
        'config': 'config',
        // Documentation
        'md': 'markdown',
        'markdown': 'markdown',
        'txt': 'text',
        'rst': 'restructuredtext',
        // Data formats
        'sql': 'database',
        'db': 'database',
        'sqlite': 'database',
        // Shell scripts
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'fish': 'shell',
        'ps1': 'powershell',
        // Container & cloud
        'dockerfile': 'dockerfile',
        'docker': 'docker',
        'tf': 'terraform',
        'tfvars': 'terraform',
        // Build tools
        'makefile': 'makefile',
        'cmake': 'cmake',
        // Certificate & keys
        'pem': 'key',
        'key': 'key',
        'crt': 'key',
        'cer': 'key',
        // Archives
        'zip': 'zip',
        'tar': 'zip',
        'gz': 'zip',
        'rar': 'zip',
        // Images (default)
        'png': 'image',
        'jpg': 'image',
        'jpeg': 'image',
        'gif': 'image',
        'bmp': 'image',
        'ico': 'image',
        'webp': 'image',
        // Fonts
        'woff': 'font',
        'woff2': 'font',
        'ttf': 'font',
        'otf': 'font',
        'eot': 'font',
    },
    fileNames: {
        // Morse-specific files
        'morse.json': '_morse_config',
        '.morserc': '_morse_config',
        '.morserc.json': '_morse_config',
        '.morserc.yml': '_morse_config',
        '.morserc.yaml': '_morse_config',
        'morse.config.json': '_morse_config',
        'morse.config.yml': '_morse_config',
        'morse.config.yaml': '_morse_config',
        '.morse': '_morse_config',
        // Session files
        '.morse-sessions': '_morse_session',
        'sessions.json': '_morse_session',
        // Agent files
        'agents.json': '_morse_agent',
        'morse-agents': '_morse_agent',
        // Git
        '.gitignore': 'git',
        '.gitattributes': 'git',
        '.gitmodules': 'git',
        // Docker
        'dockerfile': 'dockerfile',
        'docker-compose.yml': 'docker-compose',
        'docker-compose.yaml': 'docker-compose',
        // Package managers
        'package.json': 'npm',
        'package-lock.json': 'npm',
        'yarn.lock': 'yarn',
        'pnpm-lock.yaml': 'pnpm',
        // Python
        'requirements.txt': 'python',
        'pyproject.toml': 'python',
        'poetry.lock': 'python',
        'setup.py': 'python',
        'setup.cfg': 'python',
        'Pipfile': 'python',
        'Pipfile.lock': 'python',
        // Node
        '.eslintrc': 'eslint',
        '.eslintrc.json': 'eslint',
        '.eslintrc.js': 'eslint',
        '.prettierrc': 'prettier',
        '.prettierrc.json': 'prettier',
        'tsconfig.json': 'tsconfig',
        'tslint.json': 'tslint',
        // Build files
        'makefile': 'makefile',
        'CMakeLists.txt': 'cmake',
        'cargo.toml': 'rust',
        'cargo.lock': 'rust',
        // Config files
        '.env': 'env',
        '.env.local': 'env',
        '.env.development': 'env',
        '.env.production': 'env',
        '.env.example': 'env',
        'app.json': 'json',
        'now.json': 'vercel',
        'netlify.toml': 'netlify',
        // Documentation
        'readme': 'readme',
        'readme.md': 'readme',
        'readme.txt': 'readme',
        'changelog': 'changelog',
        'changelog.md': 'changelog',
        'contributing': 'contributing',
        'license': 'license',
        // Testing
        'jest.config.js': 'jest',
        'vitest.config.ts': 'vitest',
        'pytest.ini': 'pytest',
        // CI/CD
        '.github': 'github',
        '.gitlab-ci.yml': 'gitlab',
        'bitbucket-pipelines.yml': 'bitbucket',
    },
    folderNames: {
        // Morse folders
        '.morse': '_morse_config',
        'morse-sessions': '_morse_session',
        'morse-agents': '_morse_agent',
        'morse-plugins': '_morse_agent',
        // Config folders
        'config': 'config',
        'configs': 'config',
        '.config': 'config',
        // Source code
        'src': 'source',
        'lib': 'library',
        'app': 'app',
        'packages': 'package',
        // Build output
        'dist': 'dist',
        'build': 'build',
        'out': 'out',
        'target': 'target',
        'bin': 'binary',
        'obj': 'object',
        // Test folders
        'test': 'test',
        'tests': 'test',
        '__tests__': 'test',
        'spec': 'test',
        'e2e': 'test',
        'integration': 'test',
        'mocks': 'test',
        // Documentation
        'docs': 'docs',
        'documentation': 'docs',
        '.docs': 'docs',
        // Assets
        'assets': 'assets',
        'static': 'assets',
        'public': 'public',
        'media': 'media',
        'images': 'images',
        'icons': 'icons',
        'fonts': 'fonts',
        // Node specific
        'node_modules': 'node_modules',
        // Python specific
        'venv': 'virtual',
        'env': 'virtual',
        '.venv': 'virtual',
        '__pycache__': 'python-cache',
        '.pytest_cache': 'python-cache',
        // Git
        '.git': 'git',
        // CI/CD
        '.github': 'github',
        '.gitlab-ci': 'gitlab',
        'workflows': 'github-actions',
        // Docker
        'docker': 'docker',
        // Misc
        'scripts': 'script',
        'tools': 'tool',
        'vendor': 'bower',
        'temp': 'temp',
        'tmp': 'temp',
        'cache': 'cache',
    },
    folderNamesExpanded: {
        // Same as folderNames but for expanded state
        '.morse': '_morse_config',
        'morse-sessions': '_morse_session',
        'morse-agents': '_morse_agent',
        'morse-plugins': '_morse_agent',
        'config': 'config',
        'configs': 'config',
        '.config': 'config',
        'src': 'source',
        'lib': 'library',
        'app': 'app',
        'packages': 'package',
        'dist': 'dist',
        'build': 'build',
        'out': 'out',
        'target': 'target',
        'test': 'test',
        'tests': 'test',
        '__tests__': 'test',
        'spec': 'test',
        'docs': 'docs',
        'documentation': 'docs',
        'assets': 'assets',
        'static': 'assets',
        'public': 'public',
        'node_modules': 'node_modules',
        '.git': 'git',
    },
    languageIds: {
        // Custom language IDs for Morse
        'morse': 'morse',
        'morse-session': 'morse',
        'morse-agent': 'morse',
        // Standard language IDs
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'go': 'go',
        'rust': 'rust',
        'java': 'java',
        'csharp': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
    },
};
/**
 * Register the Morse file icon theme (contributed via package.json; no runtime registration API in VS Code)
 */
function registerMorseFileIconTheme(_context) {
    applyIconMappings();
}
/**
 * Apply the file icon mappings
 */
function applyIconMappings() {
    // Configure VS Code to use Morse icons
    const config = vscode.workspace.getConfiguration('workbench');
    // Get current icon theme setting
    const currentIconTheme = config.get('iconTheme');
    // Set to Morse icons if not already set
    if (currentIconTheme !== 'morse-file-icons') {
        config.update('iconTheme', 'morse-file-icons', vscode.ConfigurationTarget.Global);
    }
}
/**
 * Get the icon definition for a file
 */
function getFileIcon(filePath) {
    const path = filePath.toLowerCase();
    // Check file extensions
    for (const [ext, icon] of Object.entries(exports.morseFileIcons.fileExtensions || {})) {
        if (path.endsWith(`.${ext}`)) {
            return icon;
        }
    }
    // Check file names
    const fileName = path.split(/[/\\]/).pop() || '';
    for (const [name, icon] of Object.entries(exports.morseFileIcons.fileNames || {})) {
        if (fileName === name) {
            return icon;
        }
    }
    return undefined;
}
/**
 * Get the icon definition for a folder
 */
function getFolderIcon(folderName, expanded = false) {
    const name = folderName.toLowerCase();
    const mappings = expanded
        ? exports.morseFileIcons.folderNamesExpanded
        : exports.morseFileIcons.folderNames;
    return mappings?.[name];
}
/**
 * Check if a file should use Morse-specific icon
 */
function isMorseFile(filePath) {
    const path = filePath.toLowerCase();
    // Check for Morse config files
    if (path.includes('.morse') ||
        path.includes('morse.json') ||
        path.includes('morserc')) {
        return true;
    }
    // Check for Morse session files
    if (path.includes('session') &&
        (path.endsWith('.json') || path.endsWith('.morse'))) {
        return true;
    }
    return false;
}
/**
 * Get all Morse-specific file patterns
 */
function getMorseFilePatterns() {
    return [
        '**/.morse/**',
        '**/.morserc',
        '**/.morserc.*',
        '**/morse.config.*',
        '**/*morse*.json',
        '**/*session*.json',
        '**/morse-sessions/**',
        '**/morse-agents/**',
    ];
}
/**
 * Enable or disable Morse file icons
 */
function setMorseFileIcons(enabled) {
    const config = vscode.workspace.getConfiguration('workbench');
    if (enabled) {
        config.update('iconTheme', 'morse-file-icons', vscode.ConfigurationTarget.Global);
    }
    else {
        // Reset to default
        config.update('iconTheme', 'vs-seti', vscode.ConfigurationTarget.Global);
    }
}
/**
 * Get current Morse file icon theme status
 */
function isMorseFileIconsEnabled() {
    const config = vscode.workspace.getConfiguration('workbench');
    return config.get('iconTheme') === 'morse-file-icons';
}
//# sourceMappingURL=MorseFileIconTheme.js.map