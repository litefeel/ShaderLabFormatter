# ShaderLab Formatter



![GitHub License](https://img.shields.io/github/license/litefeel/ShaderLabFormatter)
![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/LiteFeel.shaderlabformatter)
![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/stars/LiteFeel.shaderlabformatter)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/LiteFeel.shaderlabformatter)
![Visual Studio Marketplace Installs](https://img.shields.io/vscode-marketplace/i/LiteFeel.shaderlabformatter)
[![Donate](https://img.shields.io/badge/donate-paypal-brightgreen.svg)](https://www.paypal.me/litefeel)


An VSCode plugin for formatting of ShaderLab


## Configuration

`shaderlabformatter.indentation.conditionMacro` - indentation for condition macro.

The value:
* `dont` - do not indent the condition macros
* `indent` - indent the condition macros like bracket
* `normal` - indent the condition macros like normal code

`shaderlabformatter.tags.formatMode` - Controls how Tags blocks are formatted. Fog blocks always remain single-line.

The value:
* `singleline` - Prefer single line, only keep multi-line when comments exist in Tags block
* `multiline` - Each tag on its own line
* `multiline-if-multiple` - Prefer single line, keep multi-line when there are more than one tag
