module.exports = {
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['node', 'prettier'],
  rules: {
    // Prettier
    'prettier/prettier': [
      'error',
      {
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: true,
        quoteProps: 'as-needed',
        trailingComma: 'es5',
        bracketSpacing: true,
        arrowParens: 'avoid',
      },
    ],

    // Node.js
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
      },
    ],
    'node/no-missing-import': 'off',
    'node/no-unpublished-require': 'off',
    'node/exports-style': ['error', 'module.exports'],

    // General
    'no-console': 'off', // Console allowed in backend
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-debugger': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'no-empty': 'off', // Disabled temporarily
    'no-undef': 'off', // Disabled temporarily
    'no-case-declarations': 'warn', // Only warn for case declarations

    // Async/Await
    'require-await': 'error',
    'no-return-await': 'error',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',

    // Best Practices
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
    'no-alert': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': [
      'warn',
      {
        ignore: [-1, 0, 1, 2, 404, 500, 200, 201, 401, 403],
      },
    ],
    'no-multi-spaces': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-proto': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-void': 'error',
    'wrap-iife': 'error',
    yoda: 'error',
  },
};
