// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Indent } from './indent';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "shaderlabformatter" is now active!');

    enum MacroIndentation {
        Dont = "dont",
        Indent = "indent",
        Normal = 'normal',
    }

    const MACRO_BEGIN = /^\s*#if/;
    const MACRO_END = /^\s*#endif/;
    const MACRO_MIDDLE = /^\s*(#else|#elif)/;
    const BRACKET_LEFT = /\{(?!})|\bCBUFFER_START\b/;
    const BRACKET_RIGHT = /(?<!{)\}|\bCBUFFER_END\b/;
    const COMMENT_PATTERN = /\/\/|\/\*/;

    // Format Tags/Fog blocks as single line (if no comments inside)
    function formatSingleLineBlocks(document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();

        // Regex to match Tags or Fog block (potentially multi-line)
        const blockRegex = /(Tags|Fog)\s*\{([^}]*)\}/gi;

        let match;
        while ((match = blockRegex.exec(text)) !== null) {
            const fullMatch = match[0];
            const keyword = match[1];  // "Tags" or "Fog"
            const content = match[2];

            // Skip if contains comments
            if (COMMENT_PATTERN.test(content)) {
                continue;
            }

            // Skip if already on single line (no newlines)
            if (!content.includes('\n')) {
                continue;
            }

            // Format: join content into single line with spaces
            const formattedContent = content
                .split(/\s+/)
                .filter(s => s.length > 0)
                .join(' ');

            const formattedBlock = `${keyword} { ${formattedContent} }`;

            // Get position in document
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);

            edits.push(vscode.TextEdit.replace(
                new vscode.Range(startPos, endPos),
                formattedBlock
            ));
        }

        return edits;
    }

    let indentUtil: Indent = new Indent();

    function isComment(line: string) {
        return line.startsWith("//");
    }

    function createFormattingProvider() {
        return {
            provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken) {

            indentUtil.initIndent(options.insertSpaces, options.tabSize);
            let config = vscode.workspace.getConfiguration("shaderlabformatter.indentation");
            let macroIndentation = config.get<MacroIndentation>("conditionMacro", MacroIndentation.Indent);

            // Format Tags/Fog blocks first (merge to single line if no comments)
            const tagsEdits = formatSingleLineBlocks(document);
            if (tagsEdits.length > 0) {
                return tagsEdits;
            }

            const result: vscode.TextEdit[] = [];
            const lineCount = document.lineCount;
            var indent = 0;
            for (var lineIdx = 0; lineIdx < lineCount; lineIdx++) {
                var line = document.lineAt(lineIdx);
                if (line.range.isEmpty) {
                    continue;
                }
                const lineText = line.text;
                const bracketLeft = BRACKET_LEFT.test(lineText);
                const bracketRight = BRACKET_RIGHT.test(lineText);
                const macroBegin = MACRO_BEGIN.test(lineText);
                const macroEnd = MACRO_END.test(lineText);

                const macroMiddle = MACRO_MIDDLE.test(lineText);
                if (!bracketLeft && bracketRight) {
                    indent--;
                }
                let nowIndent = indent;
                if (macroEnd || macroMiddle || macroBegin) {
                    switch (macroIndentation) {
                        case MacroIndentation.Dont:
                            nowIndent = 0;
                            break;
                        case MacroIndentation.Indent:
                            if (macroEnd) {
                                indent--;
                                nowIndent = indent;
                            } else if (macroMiddle) {
                                nowIndent = indent - 1;
                            }
                            break;
                        case MacroIndentation.Normal:
                            // do nothing
                            break;
                    }
                }

                var firstCharIdx = line.firstNonWhitespaceCharacterIndex;
                if (!indentUtil.isIndent(lineText, firstCharIdx, nowIndent)) {
                    var pos = new vscode.Position(lineIdx, 0);
                    result.push(vscode.TextEdit.delete(new vscode.Range(lineIdx, 0, lineIdx, firstCharIdx)));
                    result.push(vscode.TextEdit.insert(line.range.start, indentUtil.getIndent(nowIndent)));
                }

                if (bracketLeft && !bracketRight) {
                    indent++;
                }
                if (macroBegin && macroIndentation === MacroIndentation.Indent) {
                    indent++;
                }
            }
            return result;
        }
        };
    }

    // Register formatter for multiple language IDs
    const languageIds = ['shaderlab', 'UnityShader', 'shader', 'hlsl'];
    const disposables = languageIds.map(langId =>
        vscode.languages.registerDocumentFormattingEditProvider(langId, createFormattingProvider())
    );

    context.subscriptions.push(...disposables);
}

// This method is called when your extension is deactivated
export function deactivate() {}
