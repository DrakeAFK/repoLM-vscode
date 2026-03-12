import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import ignore, { Ignore } from 'ignore';

interface FileInfo {
    path: string;
    size: number;
    isBinary: boolean;
    hash: string;
    tokens: number;
}

const PRESET_IGNORE_PATTERNS = [
    '.git',
    'node_modules',
    '.env',
    '.env.*',
    'vendor',
    'bin',
    'obj',
    'target',
    '.next',
    '.svelte-kit',
    '.cache',
    'dist',
    'build',
    'coverage',
    '.DS_Store',
];

const BINARY_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib', '.a', '.o',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.sqlite', '.db', '.mdb',
];

function isBinary(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.includes(ext);
}

function shouldIgnore(filePath: string, isDir: boolean): boolean {
    const parts = filePath.split(path.sep);
    for (const part of parts) {
        if (PRESET_IGNORE_PATTERNS.includes(part)) {
            return true;
        }
        if (part.endsWith('.log') || part === '.DS_Store') {
            return true;
        }
    }
    return false;
}

function loadGitIgnore(rootPath: string): Ignore {
    const ig = ignore();
    const gitIgnorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitIgnorePath)) {
        const content = fs.readFileSync(gitIgnorePath, 'utf-8');
        ig.add(content);
    }
    return ig;
}

function scanFiles(rootPath: string, gitIgnore: Ignore): FileInfo[] {
    const files: FileInfo[] = [];
    
    function walk(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(rootPath, fullPath);
            
            if (shouldIgnore(relPath, entry.isDirectory())) {
                continue;
            }
            
            // Normalize to forward slashes for cross-platform gitignore matching
            const normalizedRelPath = relPath.split(path.sep).join('/');
            if (gitIgnore.ignores(normalizedRelPath)) {
                continue;
            }
            
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const stat = fs.statSync(fullPath);
                const binary = isBinary(fullPath);
                let hash = '';
                let tokens = 0;
                
                if (!binary) {
                    const content = fs.readFileSync(fullPath);
                    hash = crypto.createHash('md5').update(content).digest('hex');
                    tokens = Math.ceil(content.toString('utf-8').length / 4);
                }
                
                files.push({
                    path: relPath,
                    size: stat.size,
                    isBinary: binary,
                    hash,
                    tokens,
                });
            }
        }
    }
    
    walk(rootPath);
    return files;
}

function getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
        '.go': 'go',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'javascript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.md': 'markdown',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.sql': 'sql',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'bash',
        '.rs': 'rust',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
        '.lua': 'lua',
        '.pl': 'perl',
        '.toml': 'toml',
        '.xml': 'xml',
    };
    return langMap[ext] || '';
}

async function generateCapsule() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }
    
    const rootPath = workspaceFolder.uri.fsPath;
    const config = vscode.workspace.getConfiguration('repolm');
    const outputFileName = config.get<string>('outputFileName') || 'project.context.md';
    const includeGitIgnore = config.get<boolean>('includeGitIgnore') ?? true;
    
    const gitIgnore = includeGitIgnore ? loadGitIgnore(rootPath) : ignore();
    const files = scanFiles(rootPath, gitIgnore);
    
    if (files.length === 0) {
        vscode.window.showInformationMessage('No files found to include');
        return;
    }
    
    const fileItems: vscode.QuickPickItem[] = files.map(f => ({
        label: f.path,
        description: `${(f.size / 1024).toFixed(1)} KB • ~${f.tokens} tokens`,
        picked: true,
    }));
    
    const selected = await vscode.window.showQuickPick(fileItems, {
        canPickMany: true,
        placeHolder: 'Select files to include in the capsule (all selected by default)',
        title: 'Select Files for Context Capsule',
    });
    
    if (!selected || selected.length === 0) {
        vscode.window.showInformationMessage('No files selected');
        return;
    }
    
    const selectedFiles = files.filter(f => selected.some(s => s.label === f.path));
    const outputPath = path.join(rootPath, outputFileName);
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating Context Capsule',
        cancellable: false,
    }, async () => {
        const timestamp = new Date().toISOString();
        let content = `# LLM Context Capsule\n\n`;
        content += `- **Project:** ${path.basename(rootPath)}\n`;
        content += `- **Timestamp:** ${timestamp}\n`;
        content += `- **Mode:** FULL\n`;
        content += `- **Tool Version:** VSCode Extension v0.1.0\n\n`;
        
        content += `## Project Overview\n\n\`\`\`\n`;
        for (const f of selectedFiles) {
            content += `${f.path}\n`;
        }
        content += `\`\`\`\n\n`;
        
        content += `## File Contents\n\n`;
        
        const sortedFiles = [...selectedFiles].sort((a, b) => a.path.localeCompare(b.path));
        
        for (const f of sortedFiles) {
            if (f.isBinary) {
                continue;
            }
            
            const fullPath = path.join(rootPath, f.path);
            let fileContent = '';
            
            try {
                fileContent = fs.readFileSync(fullPath, 'utf-8');
            } catch {
                fileContent = `[Could not read file]`;
            }
            
            const lang = getLanguage(f.path);
            content += `### FILE: ${f.path}\n`;
            content += `- **Hash:** ${f.hash}\n`;
            content += `- **Size:** ${f.size} bytes\n\n`;
            content += `\`\`\`${lang}\n${fileContent}\n\`\`\`\n\n`;
        }
        
        const manifest = {
            schemaVersion: '1.0',
            projectName: path.basename(rootPath),
            rootPath,
            timestamp,
            files: selectedFiles.map(f => ({
                path: f.path,
                hash: f.hash,
                size: f.size,
                tokens: f.tokens,
                modified: timestamp,
            })),
            toolVersion: 'v0.1.0',
        };
        
        content += `## Manifest\n\n`;
        content += `<!-- MANIFEST_START -->\n`;
        content += `\`\`\`json\n${JSON.stringify(manifest, null, 2)}\n\`\`\`\n`;
        content += `<!-- MANIFEST_END -->\n`;
        
        fs.writeFileSync(outputPath, content, 'utf-8');
        
        const doc = await vscode.window.showTextDocument(vscode.Uri.file(outputPath));
        vscode.window.showInformationMessage(`Capsule saved to ${outputFileName} (${selectedFiles.length} files)`);
    });
}

async function openCapsule() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }
    
    const config = vscode.workspace.getConfiguration('repolm');
    const outputFileName = config.get<string>('outputFileName') || 'project.context.md';
    const outputPath = path.join(workspaceFolder.uri.fsPath, outputFileName);
    
    if (!fs.existsSync(outputPath)) {
        const generate = 'Generate Now';
        const result = await vscode.window.showInformationMessage(
            `No capsule found at ${outputFileName}`,
            generate
        );
        if (result === generate) {
            await generateCapsule();
        }
        return;
    }
    
    await vscode.window.showTextDocument(vscode.Uri.file(outputPath));
}

export function activate(context: vscode.ExtensionContext) {
    const generateCommand = vscode.commands.registerCommand('repolm.generateCapsule', generateCapsule);
    const openCommand = vscode.commands.registerCommand('repolm.openCapsule', openCapsule);
    
    context.subscriptions.push(generateCommand, openCommand);
}

export function deactivate() {}
