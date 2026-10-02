const js = require('@eslint/js');
const nodePlugin = require('eslint-plugin-n');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    nodePlugin.configs['flat/recommended'],
    prettierConfig,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                process: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                require: 'readonly',
                console: 'readonly',
                jest: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                beforeAll: 'readonly',
                afterEach: 'readonly',
                afterAll: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: 'req|res|next|err' }],
            'no-undef': 'error'
        }
    },
    {
        ignores: ['node_modules/', 'coverage/']
    }
];
