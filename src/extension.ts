// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { print } from 'util';
import { ProviderResult } from 'vscode';
import { open } from 'inspector';
import { Indent } from './indent';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "shaderlabformatter" is now active!');


    const LEFT_BRACKET = /#if|\{(?!})/;
    const RIGHT_BRACKET = /#endif|(?<!{)\}/;
    const TEMP_LEFT_BRACKET = /#else|#elif/;
    let indentUtil: Indent = new Indent();

    function isComment(line: string) {
        return line.startsWith("//");
    }

    let disposable2 = vscode.languages.registerDocumentFormattingEditProvider('shaderlab', {

        provideDocumentFormattingEdits(document: vscode.TextDocument, options, token) {

            indentUtil.initIndent(options.insertSpaces, options.tabSize);

            // vscode.window.showInformationMessage('Hello World!');
            const result: vscode.TextEdit[] = [];
            const lineCount = document.lineCount;
            var indent = 0;
            for (var lineIdx = 0; lineIdx < lineCount; lineIdx++) {
                var line = document.lineAt(lineIdx);
                if (line.range.isEmpty) {
                    continue;
                }
                const lineText = line.text;
                const increaseIndent = LEFT_BRACKET.test(lineText);
                const decreaseIndent = RIGHT_BRACKET.test(lineText);
                const decreaseIndentOnlyOne = TEMP_LEFT_BRACKET.test(lineText);
                if (!increaseIndent && decreaseIndent) {
                    indent--;
                }
                if (decreaseIndentOnlyOne) {
                    indent--;
                }

                var firstCharIdx = line.firstNonWhitespaceCharacterIndex;
                if (!indentUtil.isIndent(lineText, firstCharIdx, indent)) {
                    var pos = new vscode.Position(lineIdx, 0);
                    result.push(vscode.TextEdit.delete(new vscode.Range(lineIdx, 0, lineIdx, firstCharIdx)));
                    result.push(vscode.TextEdit.insert(line.range.start, indentUtil.getIndent(indent)));
                }

                if (increaseIndent && !decreaseIndent) {
                    indent++;
                }
                if (decreaseIndentOnlyOne) {
                    indent++;
                }
            }
            return result;
        }
    });

    context.subscriptions.push(disposable2);
}

// this method is called when your extension is deactivated
export function deactivate() { }
