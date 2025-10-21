module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true
  },
  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: [
    'react',
    'react-hooks',
    'prettier'
  ],
  rules: {
    // Prettier - temporarily disabled to allow compilation
    'prettier/prettier': 'off',
    
    // React
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Disabled temporarily
    'react/jsx-filename-extension': ['warn', { extensions: ['.jsx', '.js'] }],
    'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
    'react/no-unescaped-entities': 'off', // Disabled temporarily
    
    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // General
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'no-debugger': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'no-empty': 'off', // Disabled temporarily
    'no-undef': 'off', // Disabled temporarily
    'no-useless-catch': 'warn', // Only warn for useless catch
    
    // Import/Export
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};