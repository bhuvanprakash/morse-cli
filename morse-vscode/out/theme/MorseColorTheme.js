"use strict";
/**
 * Morse Color Theme
 * Custom VS Code color theme for Morse CLI
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
exports.morseDarkTheme = exports.morseLightTheme = exports.MORSE_LIGHT_THEME = void 0;
exports.registerMorseColorThemes = registerMorseColorThemes;
exports.applyMorseTheme = applyMorseTheme;
exports.getCurrentMorseTheme = getCurrentMorseTheme;
const vscode = __importStar(require("vscode"));
/** Partial mock for theme contribution; not a full ExtensionContext */
exports.MORSE_LIGHT_THEME = {
    extensionPath: '',
    globalState: {},
    workspaceState: {},
    subscriptions: [],
    asAbsolutePath: (_relativePath) => '',
    storageUri: undefined,
    globalStorageUri: undefined,
    logUri: undefined,
    environmentVariableCollection: {},
    extension: undefined,
};
/**
 * Light theme colors - inspired by Morse code dots and dashes
 */
exports.morseLightTheme = {
    name: 'Morse Light',
    type: 'light',
    colors: {
        // Base colors - warm paper-like background
        'editor.background': '#FFFEF5',
        'editor.foreground': '#2D2A26',
        'editorCursor.foreground': '#5C4B37',
        'editor.lineHighlightBackground': '#F5F2E8',
        'editor.selectionBackground': '#E8DFC8',
        'editor.inactiveSelectionBackground': '#F0EBDB',
        // Editor widget - elevated surface
        'editorWidget.background': '#FFFEF5',
        'editorWidget.border': '#E5DFD0',
        'editorSuggestWidget.background': '#FFFEF5',
        'editorSuggestWidget.border': '#E5DFD0',
        'editorSuggestWidget.foreground': '#2D2A26',
        'editorSuggestWidget.selectedBackground': '#E8DFC8',
        // Gutter - subtle guide
        'editorGutter.background': '#FFFEF5',
        'editorGutter.modifiedBackground': '#D4A373',
        'editorGutter.addedBackground': '#6B9080',
        'editorGutter.deletedBackground': '#C1666B',
        // Line numbers - muted but readable
        'editorLineNumber.foreground': '#A69882',
        'editorLineNumber.activeForeground': '#5C4B37',
        // Indent guides - subtle structure
        'editorIndentGuide.background': '#E8E2D4',
        'editorIndentGuide.activeBackground': '#CFC3AE',
        // Bracket matching - highlighted connection
        'editorBracketMatch.background': '#D4C4A8',
        'editorBracketMatch.border': '#5C4B37',
        // Find match - search highlighting
        'editor.findMatchBackground': '#F9E498',
        'editor.findMatchHighlightBackground': '#F5E6B8',
        // Word highlight - contextual reference
        'editor.wordHighlightBackground': '#EDE4CF',
        'editor.wordHighlightStrongBackground': '#DED1B3',
        // Scrollbar - navigation aid
        'scrollbar.shadow': '#00000010',
        'scrollbarSlider.background': '#C9BEAA80',
        'scrollbarSlider.hoverBackground': '#B8A99080',
        'scrollbarSlider.activeBackground': '#A6988280',
        // Minimap - code overview
        'minimap.background': '#F5F2E8',
        // Overview ruler - navigation marker
        'editorOverviewRuler.border': '#E5DFD0',
        'editorOverviewRuler.findMatchForeground': '#F9E498',
        'editorOverviewRuler.errorForeground': '#C1666B',
        'editorOverviewRuler.warningForeground': '#D4A373',
        'editorOverviewRuler.infoForeground': '#6B9080',
        // Activity bar - main navigation
        'activityBar.background': '#5C4B37',
        'activityBar.foreground': '#FFFEF5',
        'activityBar.inactiveForeground': '#B8A990',
        'activityBarBadge.background': '#D4A373',
        'activityBarBadge.foreground': '#FFFEF5',
        // Sidebar - file explorer
        'sideBar.background': '#F5F2E8',
        'sideBar.foreground': '#2D2A26',
        'sideBar.border': '#E5DFD0',
        'sideBarSectionHeader.background': '#EDE4CF',
        // Panel - output terminal
        'panel.background': '#FFFEF5',
        'panel.border': '#E5DFD0',
        'panelTitle.activeBorder': '#5C4B37',
        // Status bar - bottom info
        'statusBar.background': '#5C4B37',
        'statusBar.foreground': '#FFFEF5',
        'statusBar.border': '#4A3D2D',
        'statusBar.noFolderBackground': '#6B5D4D',
        'statusBar.debuggingBackground': '#C1666B',
        // Title bar - window controls
        'titleBar.activeBackground': '#FFFEF5',
        'titleBar.activeForeground': '#2D2A26',
        'titleBar.border': '#E5DFD0',
        'titleBar.inactiveBackground': '#F5F2E8',
        'titleBar.inactiveForeground': '#A69882',
        // Tabs - document navigation
        'tab.activeBackground': '#FFFEF5',
        'tab.activeForeground': '#2D2A26',
        'tab.border': '#E5DFD0',
        'tab.inactiveBackground': '#F5F2E8',
        'tab.inactiveForeground': '#A69882',
        'tab.hoverBackground': '#EDE4CF',
        // Tree - structured view
        'tree.indentGuidesStroke': '#CFC3AE',
        // List - selection display
        'list.activeSelectionBackground': '#E8DFC8',
        'list.hoverBackground': '#F0EBDB',
        'list.inactiveSelectionBackground': '#EDE4CF',
        // Input - user entry
        'input.background': '#FFFEF5',
        'input.border': '#E5DFD0',
        'input.foreground': '#2D2A26',
        'input.placeholderForeground': '#A69882',
        'inputValidation.errorBackground': '#F5E6E6',
        'inputValidation.errorBorder': '#C1666B',
        'inputValidation.infoBackground': '#E6F0F0',
        'inputValidation.infoBorder': '#6B9080',
        'inputValidation.warningBackground': '#F5F0E6',
        'inputValidation.warningBorder': '#D4A373',
        // Dropdown - selection
        'dropdown.background': '#FFFEF5',
        'dropdown.border': '#E5DFD0',
        'dropdown.foreground': '#2D2A26',
        // Button - action trigger
        'button.background': '#5C4B37',
        'button.foreground': '#FFFEF5',
        'button.hoverBackground': '#4A3D2D',
        'button.secondaryBackground': '#E5DFD0',
        'button.secondaryForeground': '#2D2A26',
        // Checkbox - binary choice
        'checkbox.background': '#FFFEF5',
        'checkbox.border': '#E5DFD0',
        'checkbox.foreground': '#2D2A26',
        // Radio button - exclusive choice
        'radioButton.background': '#FFFEF5',
        'radioButton.foreground': '#2D2A26',
        // Progress bar - loading indicator
        'progressBar.background': '#5C4B37',
        // Badge - notification count
        'badge.background': '#C1666B',
        'badge.foreground': '#FFFEF5',
        // Tooltip - contextual help
        'tooltip.background': '#2D2A26',
        'tooltip.foreground': '#FFFEF5',
        'tooltip.border': '#5C4B37',
        // Snippet - code template
        'snippetTabReplacement.background': '#EDE4CF',
        'snippetFinalTabstopActiveBackground': '#D4C4A8',
        // Symbol icons - semantic indicators
        'symbolIcon.classForeground': '#D4A373',
        'symbolIcon.functionForeground': '#6B9080',
        'symbolIcon.methodForeground': '#6B9080',
        'symbolIcon.variableForeground': '#2D2A26',
        'symbolIcon.constantForeground': '#C1666B',
        'symbolIcon.propertyForeground': '#2D2A26',
        'symbolIcon.enumeratorForeground': '#D4A373',
        'symbolIcon.fileForeground': '#5C4B37',
        'symbolIcon.folderForeground': '#D4A373',
        'symbolIcon.keywordForeground': '#9B6B6B',
        'symbolIcon.operatorForeground': '#5C4B37',
        'symbolIcon.typeParameterForeground': '#D4A373',
        // Git colors - version control
        'gitDecoration.modifiedResourceForeground': '#D4A373',
        'gitDecoration.deletedResourceForeground': '#C1666B',
        'gitDecoration.addedResourceForeground': '#6B9080',
        'gitDecoration.untrackedResourceForeground': '#6B9080',
        'gitDecoration.ignoredResourceForeground': '#A69882',
        'gitDecoration.conflictingResourceForeground': '#9B6B6B',
        // Error/Warning/Info - severity indicators
        'errorForeground': '#C1666B',
        'warningForeground': '#D4A373',
        'infoForeground': '#6B9080',
        // Text colors - documentation
        'textBlockQuote.background': '#F5F2E8',
        'textBlockQuote.border': '#E5DFD0',
        'textCodeBlock.background': '#F5F2E8',
        'textLink.activeForeground': '#4A3D2D',
        'textLink.foreground': '#5C4B37',
        'textPreformat.foreground': '#5C4B37',
        // Terminal colors - command line
        'terminal.foreground': '#2D2A26',
        'terminal.ansiBlack': '#2D2A26',
        'terminal.ansiRed': '#C1666B',
        'terminal.ansiGreen': '#6B9080',
        'terminal.ansiYellow': '#D4A373',
        'terminal.ansiBlue': '#6B8E9B',
        'terminal.ansiMagenta': '#9B6B6B',
        'terminal.ansiCyan': '#6B9080',
        'terminal.ansiWhite': '#FFFEF5',
        'terminal.ansiBrightBlack': '#5C4B37',
        'terminal.ansiBrightRed': '#E67E7E',
        'terminal.ansiBrightGreen': '#8BC4A4',
        'terminal.ansiBrightYellow': '#E8C08A',
        'terminal.ansiBrightBlue': '#8BAFC4',
        'terminal.ansiBrightMagenta': '#BC8FA8',
        'terminal.ansiBrightCyan': '#8BC4A4',
        'terminal.ansiBrightWhite': '#FFFEF5',
    },
    tokenColors: [
        {
            name: 'Comment',
            scope: ['comment', 'punctuation.definition.comment'],
            settings: {
                foreground: '#A69882',
                fontStyle: 'italic',
            },
        },
        {
            name: 'String',
            scope: ['string', 'string.quoted', 'string.template'],
            settings: {
                foreground: '#6B9080',
            },
        },
        {
            name: 'Number',
            scope: ['constant.numeric'],
            settings: {
                foreground: '#C1666B',
            },
        },
        {
            name: 'Boolean',
            scope: ['constant.language.boolean'],
            settings: {
                foreground: '#C1666B',
            },
        },
        {
            name: 'Keyword',
            scope: ['keyword', 'storage.type', 'storage.modifier'],
            settings: {
                foreground: '#9B6B6B',
                fontStyle: 'bold',
            },
        },
        {
            name: 'Operator',
            scope: ['keyword.operator'],
            settings: {
                foreground: '#5C4B37',
            },
        },
        {
            name: 'Punctuation',
            scope: ['punctuation'],
            settings: {
                foreground: '#A69882',
            },
        },
        {
            name: 'Type',
            scope: ['entity.name.type', 'storage.type'],
            settings: {
                foreground: '#D4A373',
            },
        },
        {
            name: 'Class name',
            scope: ['entity.name.class', 'entity.name.type.class'],
            settings: {
                foreground: '#D4A373',
            },
        },
        {
            name: 'Function',
            scope: ['entity.name.function', 'support.function'],
            settings: {
                foreground: '#6B9080',
            },
        },
        {
            name: 'Method',
            scope: ['entity.name.function.method'],
            settings: {
                foreground: '#6B9080',
            },
        },
        {
            name: 'Variable',
            scope: ['variable', 'variable.other'],
            settings: {
                foreground: '#2D2A26',
            },
        },
        {
            name: 'Parameter',
            scope: ['variable.parameter'],
            settings: {
                foreground: '#5C4B37',
                fontStyle: 'italic',
            },
        },
        {
            name: 'Property',
            scope: ['variable.object.property', 'property'],
            settings: {
                foreground: '#2D2A26',
            },
        },
        {
            name: 'Constant',
            scope: ['constant', 'variable.constant'],
            settings: {
                foreground: '#C1666B',
            },
        },
        {
            name: 'Tag',
            scope: ['entity.name.tag', 'tag'],
            settings: {
                foreground: '#9B6B6B',
            },
        },
        {
            name: 'Attribute',
            scope: ['entity.other.attribute-name'],
            settings: {
                foreground: '#D4A373',
            },
        },
        {
            name: 'HTML Tag',
            scope: ['meta.tag', 'meta.tag.html'],
            settings: {
                foreground: '#9B6B6B',
            },
        },
        {
            name: 'HTML Attribute',
            scope: ['entity.other.attribute-name.html'],
            settings: {
                foreground: '#D4A373',
            },
        },
        {
            name: 'JSON Property',
            scope: ['string.json'],
            settings: {
                foreground: '#6B9080',
            },
        },
        {
            name: 'Markdown Heading',
            scope: ['markup.heading'],
            settings: {
                foreground: '#5C4B37',
                fontStyle: 'bold',
            },
        },
        {
            name: 'Markdown Link',
            scope: ['markup.underline.link'],
            settings: {
                foreground: '#5C4B37',
            },
        },
        {
            name: 'Regex',
            scope: ['string.regexp'],
            settings: {
                foreground: '#9B6B6B',
            },
        },
    ],
};
/**
 * Dark theme colors - inspired by Morse code transmission
 */
exports.morseDarkTheme = {
    name: 'Morse Dark',
    type: 'dark',
    colors: {
        // Base colors - deep transmission background
        'editor.background': '#1A1814',
        'editor.foreground': '#E8E2D4',
        'editorCursor.foreground': '#D4C4A8',
        'editor.lineHighlightBackground': '#252117',
        'editor.selectionBackground': '#3D362A',
        'editor.inactiveSelectionBackground': '#2D281F',
        // Editor widget - elevated surface
        'editorWidget.background': '#1E1B17',
        'editorWidget.border': '#3D362A',
        'editorSuggestWidget.background': '#1E1B17',
        'editorSuggestWidget.border': '#3D362A',
        'editorSuggestWidget.foreground': '#E8E2D4',
        'editorSuggestWidget.selectedBackground': '#3D362A',
        // Gutter - subtle guide
        'editorGutter.background': '#1A1814',
        'editorGutter.modifiedBackground': '#D4A373',
        'editorGutter.addedBackground': '#8BC4A4',
        'editorGutter.deletedBackground': '#E67E7E',
        // Line numbers - muted but readable
        'editorLineNumber.foreground': '#6B5D4D',
        'editorLineNumber.activeForeground': '#B8A990',
        // Indent guides - subtle structure
        'editorIndentGuide.background': '#2D281F',
        'editorIndentGuide.activeBackground': '#3D362A',
        // Bracket matching - highlighted connection
        'editorBracketMatch.background': '#3D362A',
        'editorBracketMatch.border': '#D4C4A8',
        // Find match - search highlighting
        'editor.findMatchBackground': '#5C4B3760',
        'editor.findMatchHighlightBackground': '#5C4B3740',
        // Word highlight - contextual reference
        'editor.wordHighlightBackground': '#3D362A',
        'editor.wordHighlightStrongBackground': '#4A3D2D',
        // Scrollbar - navigation aid
        'scrollbar.shadow': '#00000030',
        'scrollbarSlider.background': '#4A3D2D60',
        'scrollbarSlider.hoverBackground': '#5C4B3780',
        'scrollbarSlider.activeBackground': '#6B5D4DA0',
        // Minimap - code overview
        'minimap.background': '#1A1814',
        // Overview ruler - navigation marker
        'editorOverviewRuler.border': '#3D362A',
        'editorOverviewRuler.findMatchForeground': '#D4A373',
        'editorOverviewRuler.errorForeground': '#E67E7E',
        'editorOverviewRuler.warningForeground': '#D4A373',
        'editorOverviewRuler.infoForeground': '#8BC4A4',
        // Activity bar - main navigation
        'activityBar.background': '#252117',
        'activityBar.foreground': '#E8E2D4',
        'activityBar.inactiveForeground': '#6B5D4D',
        'activityBarBadge.background': '#D4A373',
        'activityBarBadge.foreground': '#1A1814',
        // Sidebar - file explorer
        'sideBar.background': '#1E1B17',
        'sideBar.foreground': '#E8E2D4',
        'sideBar.border': '#2D281F',
        'sideBarSectionHeader.background': '#252117',
        // Panel - output terminal
        'panel.background': '#1A1814',
        'panel.border': '#2D281F',
        'panelTitle.activeBorder': '#D4A373',
        // Status bar - bottom info
        'statusBar.background': '#252117',
        'statusBar.foreground': '#E8E2D4',
        'statusBar.border': '#2D281F',
        'statusBar.noFolderBackground': '#2D281F',
        'statusBar.debuggingBackground': '#E67E7E',
        // Title bar - window controls
        'titleBar.activeBackground': '#1E1B17',
        'titleBar.activeForeground': '#E8E2D4',
        'titleBar.border': '#2D281F',
        'titleBar.inactiveBackground': '#1A1814',
        'titleBar.inactiveForeground': '#6B5D4D',
        // Tabs - document navigation
        'tab.activeBackground': '#1A1814',
        'tab.activeForeground': '#E8E2D4',
        'tab.border': '#2D281F',
        'tab.inactiveBackground': '#1E1B17',
        'tab.inactiveForeground': '#6B5D4D',
        'tab.hoverBackground': '#252117',
        // Tree - structured view
        'tree.indentGuidesStroke': '#3D362A',
        // List - selection display
        'list.activeSelectionBackground': '#3D362A',
        'list.hoverBackground': '#2D281F',
        'list.inactiveSelectionBackground': '#252117',
        // Input - user entry
        'input.background': '#1E1B17',
        'input.border': '#3D362A',
        'input.foreground': '#E8E2D4',
        'input.placeholderForeground': '#6B5D4D',
        'inputValidation.errorBackground': '#3D2A2A',
        'inputValidation.errorBorder': '#E67E7E',
        'inputValidation.infoBackground': '#2A3D2A',
        'inputValidation.infoBorder': '#8BC4A4',
        'inputValidation.warningBackground': '#3D3A2A',
        'inputValidation.warningBorder': '#D4A373',
        // Dropdown - selection
        'dropdown.background': '#1E1B17',
        'dropdown.border': '#3D362A',
        'dropdown.foreground': '#E8E2D4',
        // Button - action trigger
        'button.background': '#D4A373',
        'button.foreground': '#1A1814',
        'button.hoverBackground': '#E8C08A',
        'button.secondaryBackground': '#3D362A',
        'button.secondaryForeground': '#E8E2D4',
        // Checkbox - binary choice
        'checkbox.background': '#1E1B17',
        'checkbox.border': '#3D362A',
        'checkbox.foreground': '#E8E2D4',
        // Radio button - exclusive choice
        'radioButton.background': '#1E1B17',
        'radioButton.foreground': '#E8E2D4',
        // Progress bar - loading indicator
        'progressBar.background': '#D4A373',
        // Badge - notification count
        'badge.background': '#E67E7E',
        'badge.foreground': '#1A1814',
        // Tooltip - contextual help
        'tooltip.background': '#252117',
        'tooltip.foreground': '#E8E2D4',
        'tooltip.border': '#3D362A',
        // Snippet - code template
        'snippetTabReplacement.background': '#2D281F',
        'snippetFinalTabstopActiveBackground': '#3D362A',
        // Symbol icons - semantic indicators
        'symbolIcon.classForeground': '#E8C08A',
        'symbolIcon.functionForeground': '#8BC4A4',
        'symbolIcon.methodForeground': '#8BC4A4',
        'symbolIcon.variableForeground': '#E8E2D4',
        'symbolIcon.constantForeground': '#E67E7E',
        'symbolIcon.propertyForeground': '#E8E2D4',
        'symbolIcon.enumeratorForeground': '#E8C08A',
        'symbolIcon.fileForeground': '#D4C4A8',
        'symbolIcon.folderForeground': '#E8C08A',
        'symbolIcon.keywordForeground': '#BC8FA8',
        'symbolIcon.operatorForeground': '#B8A990',
        'symbolIcon.typeParameterForeground': '#E8C08A',
        // Git colors - version control
        'gitDecoration.modifiedResourceForeground': '#D4A373',
        'gitDecoration.deletedResourceForeground': '#E67E7E',
        'gitDecoration.addedResourceForeground': '#8BC4A4',
        'gitDecoration.untrackedResourceForeground': '#8BC4A4',
        'gitDecoration.ignoredResourceForeground': '#6B5D4D',
        'gitDecoration.conflictingResourceForeground': '#BC8FA8',
        // Error/Warning/Info - severity indicators
        'errorForeground': '#E67E7E',
        'warningForeground': '#D4A373',
        'infoForeground': '#8BC4A4',
        // Text colors - documentation
        'textBlockQuote.background': '#252117',
        'textBlockQuote.border': '#3D362A',
        'textCodeBlock.background': '#252117',
        'textLink.activeForeground': '#E8C08A',
        'textLink.foreground': '#D4C4A8',
        'textPreformat.foreground': '#D4C4A8',
        // Terminal colors - command line
        'terminal.foreground': '#E8E2D4',
        'terminal.ansiBlack': '#1A1814',
        'terminal.ansiRed': '#E67E7E',
        'terminal.ansiGreen': '#8BC4A4',
        'terminal.ansiYellow': '#E8C08A',
        'terminal.ansiBlue': '#8BAFC4',
        'terminal.ansiMagenta': '#BC8FA8',
        'terminal.ansiCyan': '#8BC4A4',
        'terminal.ansiWhite': '#E8E2D4',
        'terminal.ansiBrightBlack': '#6B5D4D',
        'terminal.ansiBrightRed': '#FF9E9E',
        'terminal.ansiBrightGreen': '#B8E4C8',
        'terminal.ansiBrightYellow': '#F5D9A8',
        'terminal.ansiBrightBlue': '#B8D4E8',
        'terminal.ansiBrightMagenta': '#D8B8D0',
        'terminal.ansiBrightCyan': '#B8E4C8',
        'terminal.ansiBrightWhite': '#FFFEF5',
    },
    tokenColors: [
        {
            name: 'Comment',
            scope: ['comment', 'punctuation.definition.comment'],
            settings: {
                foreground: '#6B5D4D',
                fontStyle: 'italic',
            },
        },
        {
            name: 'String',
            scope: ['string', 'string.quoted', 'string.template'],
            settings: {
                foreground: '#8BC4A4',
            },
        },
        {
            name: 'Number',
            scope: ['constant.numeric'],
            settings: {
                foreground: '#E67E7E',
            },
        },
        {
            name: 'Boolean',
            scope: ['constant.language.boolean'],
            settings: {
                foreground: '#E67E7E',
            },
        },
        {
            name: 'Keyword',
            scope: ['keyword', 'storage.type', 'storage.modifier'],
            settings: {
                foreground: '#BC8FA8',
                fontStyle: 'bold',
            },
        },
        {
            name: 'Operator',
            scope: ['keyword.operator'],
            settings: {
                foreground: '#B8A990',
            },
        },
        {
            name: 'Punctuation',
            scope: ['punctuation'],
            settings: {
                foreground: '#6B5D4D',
            },
        },
        {
            name: 'Type',
            scope: ['entity.name.type', 'storage.type'],
            settings: {
                foreground: '#E8C08A',
            },
        },
        {
            name: 'Class name',
            scope: ['entity.name.class', 'entity.name.type.class'],
            settings: {
                foreground: '#E8C08A',
            },
        },
        {
            name: 'Function',
            scope: ['entity.name.function', 'support.function'],
            settings: {
                foreground: '#8BC4A4',
            },
        },
        {
            name: 'Method',
            scope: ['entity.name.function.method'],
            settings: {
                foreground: '#8BC4A4',
            },
        },
        {
            name: 'Variable',
            scope: ['variable', 'variable.other'],
            settings: {
                foreground: '#E8E2D4',
            },
        },
        {
            name: 'Parameter',
            scope: ['variable.parameter'],
            settings: {
                foreground: '#B8A990',
                fontStyle: 'italic',
            },
        },
        {
            name: 'Property',
            scope: ['variable.object.property', 'property'],
            settings: {
                foreground: '#E8E2D4',
            },
        },
        {
            name: 'Constant',
            scope: ['constant', 'variable.constant'],
            settings: {
                foreground: '#E67E7E',
            },
        },
        {
            name: 'Tag',
            scope: ['entity.name.tag', 'tag'],
            settings: {
                foreground: '#BC8FA8',
            },
        },
        {
            name: 'Attribute',
            scope: ['entity.other.attribute-name'],
            settings: {
                foreground: '#E8C08A',
            },
        },
        {
            name: 'HTML Tag',
            scope: ['meta.tag', 'meta.tag.html'],
            settings: {
                foreground: '#BC8FA8',
            },
        },
        {
            name: 'HTML Attribute',
            scope: ['entity.other.attribute-name.html'],
            settings: {
                foreground: '#E8C08A',
            },
        },
        {
            name: 'JSON Property',
            scope: ['string.json'],
            settings: {
                foreground: '#8BC4A4',
            },
        },
        {
            name: 'Markdown Heading',
            scope: ['markup.heading'],
            settings: {
                foreground: '#D4C4A8',
                fontStyle: 'bold',
            },
        },
        {
            name: 'Markdown Link',
            scope: ['markup.underline.link'],
            settings: {
                foreground: '#D4C4A8',
            },
        },
        {
            name: 'Regex',
            scope: ['string.regexp'],
            settings: {
                foreground: '#BC8FA8',
            },
        },
    ],
};
/**
 * Register Morse color themes with VS Code
 */
function registerMorseColorThemes(context) {
    // Register light theme
    const lightThemeData = vscode.workspace.getConfiguration().get('theme')
        ? exports.morseLightTheme
        : exports.morseLightTheme;
    vscode.workspace.registerTextDocumentContentProvider('morse-theme-light', {
        provideTextDocumentContent: () => {
            return JSON.stringify(lightThemeData, null, 2);
        }
    });
    // Register dark theme
    vscode.workspace.registerTextDocumentContentProvider('morse-theme-dark', {
        provideTextDocumentContent: () => {
            return JSON.stringify(exports.morseDarkTheme, null, 2);
        }
    });
    // Set as current theme based on VS Code's current theme kind
    const themeKind = vscode.window.activeColorTheme.kind;
    if (themeKind === vscode.ColorThemeKind.Dark) {
        vscode.workspace.updateWorkspaceFolders(0, undefined, {
            name: 'Morse Dark',
            uri: vscode.Uri.parse('morse-theme-dark://Morse%20Dark')
        });
    }
    else {
        vscode.workspace.updateWorkspaceFolders(0, undefined, {
            name: 'Morse Light',
            uri: vscode.Uri.parse('morse-theme-light://Morse%20Light')
        });
    }
}
/**
 * Apply a Morse color theme
 */
async function applyMorseTheme(dark) {
    const theme = dark ? exports.morseDarkTheme : exports.morseLightTheme;
    // Get all current theme settings
    const config = vscode.workspace.getConfiguration('workbench');
    // Apply colors
    for (const [key, value] of Object.entries(theme.colors)) {
        await vscode.workspace.getConfiguration('editor').update(key, value, vscode.ConfigurationTarget.Global);
    }
    // Apply token colors via color customizations
    const tokenColors = theme.tokenColors.map(tc => ({
        scope: tc.scope,
        settings: tc.settings
    }));
    await vscode.workspace.getConfiguration('editor').update('tokenColorCustomizations', { textMateRules: tokenColors }, vscode.ConfigurationTarget.Global);
}
/**
 * Get the current Morse theme type
 */
function getCurrentMorseTheme() {
    const currentTheme = vscode.window.activeColorTheme;
    if (currentTheme.label?.includes('Morse')) {
        return currentTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
    }
    return null;
}
//# sourceMappingURL=MorseColorTheme.js.map