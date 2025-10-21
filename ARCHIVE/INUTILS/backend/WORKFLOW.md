# Workflow des statuts dossiers

Ce tableau décrit les transitions de statuts autorisées pour chaque rôle, ainsi que les cas où un commentaire est requis.

| Rôle                | Statut actuel     | Statut cible         | Autorisé | Commentaire requis |
|---------------------|------------------|----------------------|----------|--------------------|
| **Préparateur**     | en_cours         | en_cours             | Oui      | Non               |
| Préparateur         | a_revoir         | en_cours             | Oui      | Non               |
| **Imprimeur Roland**| en_cours         | a_revoir             | Oui      | Oui               |
| Imprimeur Roland    | en_cours         | en_impression        | Oui      | Non               |
| Imprimeur Roland    | en_impression    | termine              | Oui      | Non               |
| **Imprimeur Xerox** | en_cours         | a_revoir             | Oui      | Oui               |
| Imprimeur Xerox     | en_cours         | en_impression        | Oui      | Non               |
| Imprimeur Xerox     | en_impression    | termine              | Oui      | Non               |
| **Livreur**         | termine          | en_livraison         | Oui      | Non               |
| Livreur             | en_livraison     | livre                | Oui      | Non               |
| **Admin**           | *                | *                    | Oui      | Non (sauf a_revoir)|

- **a_revoir** nécessite toujours un commentaire.
- Un imprimeur ne peut agir que sur les dossiers de son type (roland/xerox).
- Les transitions non listées sont interdites.

## Règles générales
- Les statuts valides sont : en_cours, a_revoir, en_impression, termine, en_livraison, livre.
- Les transitions sont strictement contrôlées par le rôle et le type de dossier.
- L'admin peut forcer n'importe quelle transition.

## Exemple d'appel API

```http
PATCH /api/dossiers/:id/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "a_revoir",
  "comment": "Erreur sur le fichier fourni."
}
```

Réponse possible :
```json
{
  "message": "Statut mis à jour avec succès",
  "dossier": { ... },
  "old_status": "en_cours",
  "new_status": "a_revoir"
}
```

En cas d'erreur :
```json
{
  "error": "Commentaire obligatoire pour marquer un dossier à revoir",
  "code": "COMMENT_REQUIRED"
}
```
