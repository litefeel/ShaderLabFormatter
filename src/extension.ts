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

    enum TagsFormatMode {
        SingleLineExceptComments = "singleLineExceptComments",
        SingleLineExceptMultipleTags = "singleLineExceptMultipleTags",
        MultiLine = "multiLine",
    }

    const MACRO_BEGIN = /^\s*#if/;
    const MACRO_END = /^\s*#endif/;
    const MACRO_MIDDLE = /^\s*(#else|#elif)/;
    const BRACKET_LEFT = /\{(?!})|\bCBUFFER_START\b/;
    const BRACKET_RIGHT = /(?<!{)\}|\bCBUFFER_END\b/;
    const COMMENT_PATTERN = /\/\/|\/\*/;
    const TAG_ITEM_PATTERN = /"[^"]*"\s*=\s*"[^"]*"/g;

    // Get the base indentation level at a given position
    function getBaseIndentLevel(document: vscode.TextDocument, position: vscode.Position, indentUtil: Indent): number {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        const firstCharIdx = line.firstNonWhitespaceCharacterIndex;

        // Count indentation by checking how many indent units fit
        let level = 0;
        let pos = 0;
        while (pos < firstCharIdx) {
            if (indentUtil.isIndent(lineText, pos + 1, level + 1) ||
                indentUtil.isIndent(lineText, pos + 4, level + 1)) { // Check for both tab and 4-space indent
                level++;
                // Move past one indent unit
                if (lineText[pos] === '\t') {
                    pos++;
                } else {
                    // Assume spaces - skip the indent width
                    while (pos < firstCharIdx && lineText[pos] === ' ') {
                        pos++;
                    }
                    break;
                }
            } else {
                break;
            }
        }

        // Simple fallback: count leading whitespace and estimate level
        if (level === 0 && firstCharIdx > 0) {
            // Rough estimate based on typical indent width
            level = Math.floor(firstCharIdx / 4) || (lineText[0] === '\t' ? 1 : 0);
        }

        return level;
    }

    // Format Tags block as multi-line
    function formatTagsMultiLine(content: string, baseIndent: number, indentUtil: Indent): string {
        const tags = content.match(TAG_ITEM_PATTERN) || [];
        if (tags.length === 0) {
            return `Tags { }`;
        }

        const baseIndentStr = indentUtil.getIndent(baseIndent);
        const innerIndentStr = indentUtil.getIndent(baseIndent + 1);

        const lines = ['Tags', baseIndentStr + '{'];
        for (const tag of tags) {
            lines.push(innerIndentStr + tag);
        }
        lines.push(baseIndentStr + '}');

        return lines.join('\n');
    }

    // Format Tags/Fog blocks based on configuration
    function formatSingleLineBlocks(document: vscode.TextDocument, tagsMode: TagsFormatMode, indentUtil: Indent): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();

        // Regex to match Tags or Fog block (potentially multi-line)
        const blockRegex = /(Tags|Fog)\s*\{([^}]*)\}/gi;

        let match;
        while ((match = blockRegex.exec(text)) !== null) {
            const fullMatch = match[0];
            const keyword = match[1];  // "Tags" or "Fog"
            const content = match[2];
            const isFog = keyword.toLowerCase() === 'fog';
            const hasComments = COMMENT_PATTERN.test(content);
            const isMultiLine = content.includes('\n');

            // Get position in document
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);

            // Fog blocks: always format as single line (unless has comments)
            if (isFog) {
                if (hasComments || !isMultiLine) {
                    continue;
                }
                // Format Fog as single line
                const formattedContent = content
                    .split(/\s+/)
                    .filter(s => s.length > 0)
                    .join(' ');
                const formattedBlock = `${keyword} { ${formattedContent} }`;
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), formattedBlock));
                continue;
            }

            // Tags blocks: format based on mode
            const tagCount = (content.match(TAG_ITEM_PATTERN) || []).length;

            // Skip if has comments (preserve as-is in all modes)
            if (hasComments) {
                continue;
            }

            let shouldBeSingleLine = false;
            switch (tagsMode) {
                case TagsFormatMode.SingleLineExceptComments:
                    // No comments -> single line
                    shouldBeSingleLine = true;
                    break;
                case TagsFormatMode.SingleLineExceptMultipleTags:
                    // Single line only if 0 or 1 tag
                    shouldBeSingleLine = tagCount <= 1;
                    break;
                case TagsFormatMode.MultiLine:
                    // Always multi-line
                    shouldBeSingleLine = false;
                    break;
            }

            if (shouldBeSingleLine) {
                // Skip if already single line
                if (!isMultiLine) {
                    continue;
                }
                // Format as single line
                const formattedContent = content
                    .split(/\s+/)
                    .filter(s => s.length > 0)
                    .join(' ');
                const formattedBlock = `${keyword} { ${formattedContent} }`;
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), formattedBlock));
            } else {
                // Format as multi-line
                const baseIndent = getBaseIndentLevel(document, startPos, indentUtil);
                const formattedBlock = formatTagsMultiLine(content, baseIndent, indentUtil);

                // Only create edit if content actually changes
                if (fullMatch !== formattedBlock) {
                    edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), formattedBlock));
                }
            }
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
            let config = vscode.workspace.getConfiguration("shaderlabformatter");
            let macroIndentation = config.get<MacroIndentation>("indentation.conditionMacro", MacroIndentation.Indent);
            let tagsMode = config.get<TagsFormatMode>("tags.formatMode", TagsFormatMode.SingleLineExceptComments);

            // Format Tags/Fog blocks first based on configuration
            const tagsEdits = formatSingleLineBlocks(document, tagsMode, indentUtil);
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
