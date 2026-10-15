# AlterRADAR v0.12.0 — Cohérence, modèles IA et apparence

Créé et développé par **Akasche MAHINTAN**.

## Correctifs

- Le compteur « Offres & stages » correspond désormais aux offres éligibles réellement affichées. Sur la page Offres, le compteur respecte aussi les recherches et filtres actifs. Le total analysé et le nombre exclu sont indiqués séparément.
- Nouveau contrôle de niveau de diplôme issu du **profil candidat** (Bac+N), actif par défaut et modifiable dans « Règles de tri ». Il bloque les offres Bac+4/Bac+5 si le profil est Bac+3, même lorsque l'ancienne règle de niveau a été désactivée. Les mentions explicites dans le titre ont priorité sur les mentions de contexte dans la description. Les niveaux inconnus conservent leur réglage spécifique.
- La récupération initiale, les résultats historiques et les alertes de surveillance appliquent la même exclusion stricte, sans effacer les candidatures déjà enregistrées.
- Le bloc « Installer un modèle » propose désormais six modèles Qwen identifiés, avec boutons individuels. Le téléchargement ne se lance **qu'après clic**, via Ollama local. La liste des modèles installés reste prioritaire.
- Lien LinkedIn officiel du créateur ajouté dans « À propos » : https://www.linkedin.com/in/akasche-mahintan.

## Nouveautés d'apparence

Dans **Paramètres → Apparence personnalisée** :
- Thème sombre, clair ou système.
- Fond uni, dégradé ou image locale PNG/JPG/WebP (maximum 8 Mo).
- Panneaux classiques, *Liquid Glass* translucides ou *Liquid Glass* teintés.
- Teinte libre, intensité 0–100 %, option de réduction du flou et des animations.

Les images sont copiées dans le dossier de données **local** de l'application et ne sont jamais importées dans le dépôt GitHub. Les préférences sont ajoutées sans réinitialiser le profil, les documents, les candidatures ou Telegram.

## Vérifications

- **81 tests Node** réussis, dont 7 nouveaux tests pour le niveau strict, l'import d'offres, les modèles autorisés, le compteur et les contrôles d'apparence.
- **42 combinaisons responsive** (7 pages sur 6 résolutions) sans débordement horizontal.
- Test interactif du mode verre teinté, fond dégradé, import et retrait d'une image de test sur 6 largeurs.
- Les appels réels Ollama, les machines Windows/macOS et les installateurs natifs nécessitent encore des tests utilisateur / GitHub Actions.

## Installation et publication

Consulter `docs/MISE_A_JOUR_V0.12.md`. Cette archive contient les **sources** et les fichiers de mise à jour, pas les installateurs déjà compilés.
Le `package-lock.json` doit être actualisé avec Node 24 / npm 11 sur un ordinateur ayant accès au registre npm, puis committé. Le créateur doit vérifier les données avant `git push`.
