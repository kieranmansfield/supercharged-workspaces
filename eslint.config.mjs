import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import tsparser from '@typescript-eslint/parser'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default [
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'main.js',
			'srcOLD',
			'src-stable/**',
			'*.config.*',
			'tsconfig.json',
			'src/old ui',
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked.map((config) => ({
		...config,
		files: ['**/*.ts', '**/*.tsx'],
	})),
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				module: 'readonly',
				require: 'readonly',
				exports: 'writable',
				global: 'readonly',
			},
		},
		plugins: {
			obsidianmd,
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-prototype-builtins': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-base-to-string': [
				'error',
				{
					ignoredTypeNames: ['ZettelId'],
				},
			],
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
			'obsidianmd/commands/no-default-hotkeys': 'error',
			'obsidianmd/commands/no-command-in-command-id': 'error',
			'obsidianmd/commands/no-command-in-command-name': 'error',
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
		},
	},
]
