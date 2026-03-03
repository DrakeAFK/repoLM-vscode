# RepoLM

Generate LLM Context Capsules from your project for use with LLMs.

## Features

- Generate a context capsule from selected files
- Automatically respects `.gitignore`
- Configurable output filename
- Open generated capsules directly in VSCode

## Commands

- `RepoLM: Generate Context Capsule` - Generate a Context Capsule from selected files
- `RepoLM: Open Capsule` - Open the generated context capsule

## Installation & Development

### Prerequisites

- Node.js 18+
- VSCode 1.75+

### Install Dependencies

```bash
npm install
```

### Run Extension in Development Mode

1. Open the project in VSCode
2. Press `F5` to launch the extension in a new VSCode window
3. Use the commands via the Command Palette (`Cmd+Shift+P`)

### Build for Distribution

To build the extension into a `.vsix` package:

```bash
npm run vscode:prepublish
```

This compiles the TypeScript to JavaScript in the `out/` directory.

### Install Extension Manually

1. Build the extension (see above)
2. Open the Extensions panel in VSCode (`Cmd+Shift+X`)
3. Click the `...` menu in the top-right corner
4. Select "Install from VSIX..."
5. Navigate to and select the `.vsix` file (if generated), or:
   - Use `Extensions: Install from Location...` and point to the project folder
   - Or simply open the project folder and press `F5` to test

For a quick test without packaging:
1. Press `F5` in the project to launch a new VSCode window with the extension loaded
2. The extension will be installed temporarily in the debug instance

## Configuration

- `repolm.outputFileName` - Output filename for the context capsule (default: `project.context.md`)
- `repolm.includeGitIgnore` - Respect `.gitignore` when scanning files (default: `true`)
