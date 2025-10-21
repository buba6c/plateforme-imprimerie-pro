# Guide d'utilisation des outils de qualité du code

## 🛠️ Outils installés

### ESLint
- **Frontend**: Configuration React avec règles modernes
- **Backend**: Configuration Node.js avec bonnes pratiques

### Prettier
- **Configuration uniforme** pour tout le projet
- **Formatage automatique** du code

### SonarQube for IDE
- **Analyse en temps réel** dans VS Code
- **Détection de bugs** et vulnérabilités de sécurité

## 📋 Commandes disponibles

### Frontend (React)
```bash
cd frontend

# Vérifier le code avec ESLint
npm run lint

# Corriger automatiquement les erreurs ESLint
npm run lint:fix

# Vérifier le formatage avec Prettier
npm run format:check

# Formater le code avec Prettier
npm run format

# Vérification complète
npm run quality

# Correction complète
npm run quality:fix
```

### Backend (Node.js)
```bash
cd backend

# Vérifier le code avec ESLint
npm run lint

# Corriger automatiquement les erreurs ESLint
npm run lint:fix

# Vérifier le formatage avec Prettier
npm run format:check

# Formater le code avec Prettier
npm run format

# Vérification complète
npm run quality

# Correction complète
npm run quality:fix
```

### Projet global
```bash
# Script de vérification complète du projet
./quality-check.sh
```

## 🎯 Utilisation recommandée

### Avant de committer
1. Exécuter `./quality-check.sh`
2. Si des erreurs, corriger avec `npm run quality:fix`
3. Vérifier à nouveau avec `./quality-check.sh`

### Dans VS Code
- **ESLint** souligne automatiquement les problèmes
- **Prettier** peut formater à la sauvegarde
- **SonarQube** affiche les problèmes dans l'onglet "Problems"

### Configuration VS Code recommandée
Ajouter dans `settings.json` :
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["frontend", "backend"]
}
```

## 🔧 Règles principales

### ESLint
- **React**: Hooks rules, JSX best practices
- **Node.js**: Security rules, async/await patterns
- **Général**: No console warnings, prefer const

### Prettier
- **Largeur**: 100 caractères
- **Indentation**: 2 espaces
- **Quotes**: Simples
- **Semicolons**: Obligatoires
- **Trailing commas**: ES5

## 📊 SonarQube

### Types d'analyses
- **Bugs**: Erreurs potentielles
- **Vulnerabilités**: Problèmes de sécurité
- **Code Smells**: Mauvaises pratiques
- **Duplication**: Code dupliqué

### Utilisation
1. SonarQube analyse automatiquement les fichiers ouverts
2. Les problèmes apparaissent dans l'onglet "Problems"
3. Cliquer sur un problème pour voir la solution

## 🚀 Intégration CI/CD

Pour automatiser la vérification :
```yaml
# .github/workflows/quality.yml
name: Quality Check
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
        working-directory: frontend
      - run: npm ci
        working-directory: backend
      - run: ./quality-check.sh
```

## ⚡ Conseils

1. **Configurer l'éditeur** pour formater à la sauvegarde
2. **Utiliser les extensions VS Code** : ESLint, Prettier, SonarLint
3. **Vérifier avant commit** avec `./quality-check.sh`
4. **Corriger progressivement** les warnings existants
5. **Former l'équipe** aux bonnes pratiques