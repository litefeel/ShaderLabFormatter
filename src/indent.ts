export  class Indent {
    private indentCode: number = 32;
    private indentStr: string = "";
    private isIndentSpaces: boolean = false;
    private readonly indentMap: Map<number, string> = new Map<number, string>();

    initIndent(insertSpaces: boolean, tabSize: number): void {
        this.isIndentSpaces = insertSpaces;
        this.indentCode = (insertSpaces ? " " : "\t").charCodeAt(0);
        this.indentStr = insertSpaces ? " ".repeat(tabSize) : "\t";
        this.indentMap.clear();
        for (let i = 1; i <= 3; i++) {
            this.indentMap.set(i, this.indentStr.repeat(i));
        }
    }
    getIndent(indent: number): string {
        if (indent <= 0) {
            return "";
        }
        if (this.indentMap.has(indent)) {
            return this.indentMap.get(indent) || "";
        }
        return this.indentStr.repeat(indent);
    }
    isIndent(s: string, len: number, indent: number) {
        let count = this.indentStr === "\t" ? indent : indent * this.indentStr.length;
        if (len !== count) {
            return false;
        }
        for (var i = 0; i < len; i++) {
            if (s.charCodeAt(i) !== this.indentCode) {
                return false;
            }
        }
        return true;
    }
}
