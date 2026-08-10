// Minimal vscode mock for testing
export namespace vscode {
  export const window = {
    createTerminal: () => {},
    createOutputChannel: () => ({ clear: () => {}, appendLine: () => {}, show: () => {} }),
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    onDidOpenTerminal: () => ({ dispose: () => {} }),
    onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
    showQuickPick: async () => undefined,
    showInformationMessage: () => {},
  };
  export const workspace = {
    workspaceFolders: [],
    onDidSaveTextDocument: () => ({ dispose: () => {} }),
    getConfiguration: () => ({ get: (key: string, def: any) => def }),
  };
  export class Disposable {
    constructor(public dispose: () => void = () => {}) {}
  }
  export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
  };
  export const window as any;
}
