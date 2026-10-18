# GUIDE D'UTILISATION — BOUTIQUE MANAGER (WINDOWS 11 HORS LIGNE)
**Application Desktop Professionnelle de Gestion Commerciale, Stock, Caisses & Mobile Money**
*(Cosmétique, Hygiène corporelle & Articles divers • Conakry, République de Guinée)*

---

## 📌 TABLE DES MATIÈRES
1. [Présentation & Caractéristiques Fondamentales](#1-présentation--caractéristiques-fondamentales)
2. [Installation sur Windows 11](#2-installation-sur-windows-11)
3. [Profils Utilisateurs & Rôles](#3-profils-utilisateurs--rôles)
4. [Guide du Caissier (POS, Ticket Thermique & Rendu de Monnaie)](#4-guide-du-caissier)
5. [Gestion Mobile Money (Orange Money & MTN MoMo)](#5-gestion-mobile-money)
6. [Gestion des Caisses, Sessions & Dépenses Quotidiennes](#6-gestion-des-caisses-sessions--dépenses)
7. [Gestion des Produits, Entrées & Sorties de Stock](#7-gestion-des-produits-entrées--sorties-de-stock)
8. [Crédits Clients, Dettes Fournisseurs & Règlements](#8-crédits-clients-dettes-fournisseurs)
9. [Inventaire Physique & Régularisation des Écarts](#9-inventaire-physique--régularisation)
10. [Rapports Financiers, Statistiques & Exports Hors Ligne](#10-rapports-financiers-statistiques--exports)
11. [Sauvegardes sur Clé USB, Sécurité & Journal d'Audit](#11-sauvegardes-sécurité--audit)
12. [Foire Aux Questions (FAQ) & Dépannage](#12-faq--dépannage)

---

## 1. PRÉSENTATION & CARACTÉRISTIQUES FONDAMENTALES

**Boutique Manager** est une véritable application desktop native Windows 11 (64 bits), conçue pour les boutiques de vente au détail (produits cosmétiques, produits d'hygiène, articles divers) et les points de transaction Mobile Money.

* **100% Hors Ligne** : Fonctionne sans aucune connexion Internet. Zéro serveur distant, zéro cloud obligatoire, zéro abonnement récurrent.
* **Base de Données Locale Sécurisée** : Moteur SQLite relationnel avec mode haute concurrence Write-Ahead Logging (WAL) et intégrité référentielle stricte (`PRAGMA foreign_keys = ON`).
* **Emplacement des Données Utilisateur** : La base de données est stockée de manière pérenne dans le répertoire Windows de l'utilisateur :
  `%APPDATA%\boutique-manager\boutique.db` (les données sont préservées après redémarrage de la machine ou mise à jour).
* **Devise Officielle** : Franc Guinéen (GNF), géré en unités monétaires entières sans décimales parasites.
* **Séparation Comptable Rigoureuse** : Les capitaux de transfert confiés par les clients pour Orange Money et MTN MoMo ne sont jamais mélangés au chiffre d'affaires des ventes de marchandises. Seules les commissions réelles constituent des produits d'exploitation pour la boutique.
* **Architecture Sécurisée Electron** : `contextIsolation` activé, `nodeIntegration` désactivé, communications IPC strictement encadrées par un pont `preload.js` certifié.

---

## 2. INSTALLATION SUR WINDOWS 11

### A. Fichier d'installation fourni
L'installateur exécutable Windows est généré dans le répertoire `release/` du projet :
📁 **`release\Boutique Manager-Setup-1.0.0.exe`** (Taille : ~137 Mo)

Une version portable sans installation est également disponible dans :
📁 **`release\win-unpacked\Boutique Manager.exe`**

### B. Procédure d'installation :
1. Double-cliquez sur `Boutique Manager-Setup-1.0.0.exe`.
2. Choisissez le dossier d'installation souhaité (par défaut : `C:\Users\<Nom>\AppData\Local\Programs\boutique-manager`).
3. L'installateur crée automatiquement :
   * Un raccourci sur le **Bureau Windows**.
   * Une entrée dans le **Menu Démarrer** sous le nom **Boutique Manager**.
4. Cliquez sur **Terminer** pour lancer l'application.
5. À la première ouverture, l'application initialise automatiquement la base de données locale dans `%APPDATA%\boutique-manager\boutique.db` ainsi que les 4 comptes utilisateurs de base et les caisses.

---

## 3. PROFILS UTILISATEURS & RÔLES

L'application intègre 4 rôles préconfigurés avec des mots de passe sécurisés hachés via `bcrypt` :

| Rôle | Identifiant | Mot de passe | Droits et Permissions |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin` | `admin123` | **Accès Total** : Gestion des comptes, journal d'audit, sauvegardes USB, restauration, purge des données, forçage d'inventaire, configuration générale. |
| **Gérant** | `gerant` | `gerant123` | **Supervision** : Ventes, réceptions de marchandises, gestion des stocks, gestion des caisses et portefeuilles, dépenses, analyse de rentabilité et rapports. |
| **Caissier(ère)** | `caissier` | `caissier123` | **Point de Vente** : Ouverture/clôture de session de caisse, encaissements comptoir (espèces/OM/MoMo/crédit), calcul de monnaie, dépôts/retraits d'argent, impression thermique. |
| **Gestionnaire Stock** | `stock` | `stock123` | **Réserve** : Catalogue des articles, enregistrement des réceptions fournisseurs, sorties d'avaries/expirations, sessions de comptage physique d'inventaire. |

> 💡 *Les mots de passe peuvent être modifiés à tout moment dans l'onglet **Paramètres & Sécurité** par l'administrateur.*

---

## 4. GUIDE DU CAISSIER

### A. Ouverture de Caisse au Démarrage
1. Rendez-vous dans **Caisses & Dépenses** > **Ouvrir Service (Fond de Caisse)**.
2. Comptez physiquement les billets présents dans le tiroir-caisse (ex : `300 000 GNF`).
3. Renseignez ce fond initial et validez. La caisse est maintenant active pour la journée.

### B. Vente au Comptoir (POS)
1. Cliquez sur **Vente & Caisse (POS)**.
2. **Sélection des articles** :
   * Par recherche directe (nom du produit, référence ou scan code-barres).
   * Par clic sur les catégories tactiles (Maquillage, Parfums, Crèmes, Savons, Shampoings, Bébé, Hygiène...).
3. **Gestion du panier** :
   * Boutons `+` et `-` pour ajuster les quantités vendues.
   * Remise commerciale en GNF si applicable.
4. **Client** :
   * Sélectionner *Comptoir anonyme* pour un passage standard.
   * Ou choisir un client enregistré (obligatoire en cas de vente à crédit).
5. **Mode de Règlement** :
   * **Espèces** : Saisissez le montant remis par l'acheteur. La monnaie à rendre s'affiche instantanément en vert.
   * **Orange Money / MTN MoMo** : Saisissez la référence du transfert reçu sur le téléphone de la boutique.
   * **Paiement Mixte** : Combinez espèces et mobile money.
   * **Crédit Client** : Vérifiez la limite de crédit autorisée du client avant validation.
6. **Validation & Ticket** :
   * Cliquez sur **Valider la Vente**. Le stock est décrémenté atomiquement et la caisse créditée.
   * Une fenêtre de ticket de caisse s'ouvre : cliquez sur **Imprimer le Ticket** pour imprimer directement sur imprimante thermique 80mm ou au format PDF.

---

## 5. GESTION MOBILE MONEY

Boutique Manager intègre un module dédié pour les transferts Orange Money et MTN MoMo.

### A. Enregistrer un Dépôt Client
1. Cliquez sur **Mobile Money** > **Nouveau Dépôt**.
2. Renseignez :
   * Le service : *Orange Money* ou *MTN Mobile Money*.
   * Le nom et le numéro de téléphone du client.
   * Le montant à envoyer (ex : `500 000 GNF`).
   * Les frais facturés au client et la **commission réelle conservée par la boutique** (ex : `3 000 GNF`).
   * La référence de la transaction SMS.
3. Validez l'opération après avoir envoyé le transfert depuis votre terminal marchand.
4. **Comptabilisation** :
   * Le solde du compte Mobile Money de la boutique diminue de `500 000 GNF`.
   * La caisse physique reçoit les `503 000 GNF` d'espèces remis par le client.
   * Seule la commission (`3 000 GNF`) est enregistrée en résultat d'exploitation.

### B. Enregistrer un Retrait Client
1. Cliquez sur **Mobile Money** > **Nouveau Retrait**.
2. Après réception du SMS confirmant le retrait effectué par le client sur votre compte marchand, enregistrez la transaction.
3. Remettez les espèces au client.
4. Le solde Mobile Money de la boutique augmente du montant retiré, la caisse physique diminue des espèces données, et la commission de retrait est comptabilisée en bénéfice.

---

## 6. GESTION DES CAISSES, SESSIONS & DÉPENSES

### A. Les différents comptes de trésorerie
L'application gère 4 registres distincts :
1. **Caisse Principale (Espèces)** : Tiroir-caisse physique du comptoir.
2. **Orange Money Boutique** : Portefeuille électronique marchand Orange.
3. **MTN Mobile Money Boutique** : Portefeuille électronique marchand MTN.
4. **Coffre-Fort Réserve** : Réserve de sécurité pour les excédents.

### B. Transferts inter-caisses
Pour alimenter un compte Mobile Money à partir du tiroir physique, ou verser les excédents de caisse dans le coffre-fort :
* Cliquez sur **Transférer entre Caisses**.
* Choisissez la caisse source, la caisse cible, le montant et le motif.
* Les soldes sont mis à jour sans double comptage des revenus.

### C. Enregistrement des Dépenses d'Exploitation
* Cliquez sur **Nouvelle Dépense**.
* Choisissez le poste : Loyer, Électricité (EDG), Transport marchandises, Salaires, Emballage/sachets, Entretien, etc.
* Sélectionnez la caisse qui paie la dépense.
* Le solde de la caisse est débité et la dépense est intégrée au compte de résultat.

### D. Clôture de Caisse en Fin de Journée
1. Cliquez sur **Clôturer Service**.
2. L'application calcule le **Solde Théorique Attendu** :
   $$\text{Solde Théorique} = \text{Fond Initial} + \text{Entrées Ventes/Dépôts} - \text{Sorties Dépenses/Retraits}$$
3. Le caissier saisit le **Montant Réel Physiquement Compté**.
4. En cas d'écart (excédent ou manquant), la **justification est obligatoire** pour responsabiliser l'équipe et consigner l'anomalie dans le rapport.

---

## 7. GESTION DES PRODUITS, ENTRÉES & SORTIES DE STOCK

### A. Fiche Produit Complète
Chaque article dispose de :
* Référence unique (ex : `PRF-001`, `CR-012`, `MAQ-045`) et code-barres.
* Nom, marque, description et photo optionnelle.
* Catégorie (Maquillage, Parfums, Crèmes, Savons, Soins capillaires, Bébés, Hygiène intime, Articles divers...).
* Fournisseur attitré.
* **Prix d'achat unitaire** et **Prix de vente unitaire**.
* Quantité en stock et **seuil d'alerte de stock faible**.
* Date d'expiration et numéro de lot (alertes automatiques pour produits périssables).

### B. Réception de Marchandises (Achats Fournisseurs)
1. Cliquez sur **Approvisionnements & Achats** > **Nouvelle Réception**.
2. Sélectionnez le fournisseur et saisissez le numéro de facture.
3. Ajoutez les articles reçus avec les quantités et prix d'achat.
4. Indiquez le montant payé immédiatement et la caisse débitée.
5. Si paiement partiel : le reste est automatiquement inscrit comme **dette fournisseur**.
6. Le stock des articles augmente automatiquement à la validation.

### C. Sorties de Stock Hors Vente
En cas de produit abîmé, expiré, volé ou utilisé pour la démonstration :
1. Cliquez sur **Sorties de Stock**.
2. Sélectionnez le motif : *Avarie/Endommagé*, *Produit expiré*, *Perte/Vol*, *Utilisation interne*, *Retour fournisseur*.
3. Validez la quantité. Le stock diminue et le mouvement est tracé pour inventaire.

---

## 8. CRÉDITS CLIENTS, DETTES FOURNISSEURS

* **Clients & Créances** : Fiche individuelle par client avec historique des achats, solde de dette restant, plafond de crédit autorisé, et bouton d'enregistrement des règlements partiels ou totaux.
* **Fournisseurs & Dettes** : Suivi des montants dus à chaque fournisseur de Madina ou de l'étranger, avec journal des versements effectués.

---

## 9. INVENTAIRE PHYSIQUE & RÉGULARISATION

Pour réaliser un contrôle physique périodique :
1. Rendez-vous dans **Inventaire**.
2. Créez une nouvelle session de comptage.
3. Pour chaque produit, saisissez le comptage physique réel constaté dans les rayons.
4. L'application met en évidence les écarts (surplus ou pertes).
5. Saisissez la justification de l'écart.
6. Cliquez sur **Valider et Régulariser le Stock** : les quantités théoriques sont réalignées sur le comptage physique avec enregistrement d'un mouvement d'ajustement.

---

## 10. RAPPORTS FINANCIERS & STATISTIQUES HORS LIGNE

Le module **Rapports & Statistiques** permet d'analyser :
* Le chiffre d'affaires par période (jour, semaine, mois, année).
* Le bénéfice commercial net estimé (Ventes - Coût d'achat des produits vendus).
* Le montant total des dépenses et le bénéfice net d'exploitation.
* La valeur marchande et d'achat du stock en magasin.
* Le total des commissions générées par Orange Money et MTN MoMo.
* Impression directe hors ligne et exports de rapports.

---

## 11. SAUVEGARDES SUR CLÉ USB, SÉCURITÉ & AUDIT

### A. Sauvegarde sur Clé USB ou Disque Externe
Pour prévenir tout risque de panne matérielle sur l'ordinateur :
1. Insérez une clé USB dans votre ordinateur Windows 11.
2. Allez dans **Paramètres & Sécurité** > onglet **Sauvegardes & Production**.
3. Cliquez sur **"Sauvegarder sur Clé USB / Disque"**.
4. Sélectionnez votre clé USB (ex : Lecteur `E:\` ou `D:\Sauvegardes`).
5. L'application effectue une sauvegarde atomique sans interruption (`boutique_backup_YYYY-MM-DD.db`).

### B. Restauration d'une Sauvegarde
1. Dans l'onglet **Sauvegardes**, cliquez sur **"Restaurer depuis un Fichier (.db)"**.
2. Sélectionnez le fichier de sauvegarde présent sur votre clé USB.
3. Le système vérifie automatiquement l'intégrité du fichier (`PRAGMA integrity_check`) avant tout remplacement, puis recharge la base.

### C. Journal d'Audit Immuable
Chaque opération sensible (suppression de produit, annulation de vente, régularisation d'écart de caisse, création d'utilisateur, sauvegarde) est enregistrée avec la date, l'heure, l'utilisateur responsable et le détail technique.

---

## 12. FAQ & DÉPANNAGE

**Q : L'application a-t-elle besoin d'une connexion Internet pour fonctionner ?**
> Non. Boutique Manager est 100% autonome et hors ligne. Toutes les opérations, calculs et sauvegardes se font localement.

**Q : Où se trouve physiquement la base de données de ma boutique ?**
> Dans le dossier Windows protégé : `C:\Users\<VotreNom>\AppData\Roaming\boutique-manager\boutique.db`. Vous pouvez ouvrir ce dossier en un clic via le bouton *"Ouvrir l'Emplacement Windows"* dans les paramètres.

**Q : Que faire si je change d'ordinateur ?**
> 1. Sur l'ancien ordinateur, faites une sauvegarde sur clé USB via le bouton *"Sauvegarder sur Clé USB"*.
> 2. Sur le nouvel ordinateur, installez l'application via `Boutique Manager-Setup-1.0.0.exe`.
> 3. Cliquez sur *"Restaurer depuis un Fichier (.db)"* et sélectionnez la sauvegarde de votre clé USB. Vous retrouvez instantanément l'intégralité de vos données, produits, comptes et historiques.
