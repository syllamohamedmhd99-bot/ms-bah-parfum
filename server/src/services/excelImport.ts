import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import db, { logAudit } from '../database.js';

export interface ParsedProductItem {
  row: number;
  name: string;
  category: string;
  selling_price: number | null;
  purchase_price: number | null;
  stock_quantity: number;
  alert_threshold: number;
  needs_completion: boolean;
  duplicate_type?: 'internal' | 'existing_db' | null;
  existing_product?: any;
  duplicate_action?: 'create' | 'update' | 'skip';
}

export interface IgnoredLine {
  row: number;
  reason: string;
  content?: string;
}

export interface ExcelPreviewResult {
  fileName: string;
  totalRows: number;
  totalDetected: number;
  validPriceCount: number;
  needsCompletionCount: number;
  duplicatesCount: number;
  ignoredLinesCount: number;
  categoriesDetected: { name: string; count: number }[];
  products: ParsedProductItem[];
  ignoredLines: IgnoredLine[];
}

export interface ImportReport {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  needsCompletionCount: number;
  duplicatesCount: number;
  ignoredLinesCount: number;
  backupPath: string | null;
  categoriesCreated: string[];
  importedProducts: { id: number; code: string; name: string; category: string; sale_price: number; status: string }[];
  errors: string[];
}

/**
 * Nettoie et normalise le nom d'une catégorie
 */
export function cleanCategoryName(raw: string): string {
  let s = (raw || '').trim();
  // Enlever les numéros en tête ("1.", "1 -", "1 )", etc.)
  s = s.replace(/^\d+\s*[\.\-\)]\s*/, '');
  // Enlever la plage de prix si présente ("- Prix : ... GNF")
  s = s.replace(/\s*-\s*Prix\s*:.*$/i, '');
  s = s.trim();

  const upper = s.toUpperCase();
  if (upper.includes('PARFUM')) return 'Parfums';
  if (upper.includes('SAVON') || upper.includes('GEL DOUCHE')) return 'Savons et gels douche';
  if (upper.includes('LAIT') || upper.includes('CRÈME') || upper.includes('CREME')) return 'Laits corps et crèmes';
  if (upper.includes('CHEVEUX')) return 'Soins cheveux';
  if (upper.includes('ACCESSOIRE') || upper.includes('TÉLÉPHONE') || upper.includes('TELEPHONE') || upper.includes('ÉLECTRONIQUE') || upper.includes('ELECTRONIQUE')) {
    return 'Accessoires téléphone et électronique';
  }
  if (upper.includes('HYGIENE') || upper.includes('HYGIÈNE')) return 'Hygiène';
  if (upper.includes('MAISON')) return 'Maison';

  // Première lettre en majuscule si nouvelle catégorie
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Normalise une chaîne pour comparaison insensible à la casse et aux accents
 */
export function normalizeString(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parse un classeur Excel depuis un Buffer ou un chemin de fichier
 */
export async function parseExcelWorkbook(source: Buffer | string, originalFileName: string = 'catalogue.xlsx'): Promise<ExcelPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  if (typeof source === 'string') {
    await workbook.xlsx.readFile(source);
  } else {
    await workbook.xlsx.load(source as any);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Le fichier Excel ne contient aucune feuille de calcul.');
  }

  let currentCategory = 'Divers';
  const products: ParsedProductItem[] = [];
  const ignoredLines: IgnoredLine[] = [];
  const categoriesMap: Record<string, number> = {};

  // Charger les produits existants en base SQLite pour détecter les doublons existants
  const existingDbProducts = db.prepare(`
    SELECT p.id, p.code, p.name, p.sale_price, p.stock_quantity, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_archived = 0
  `).all() as any[];

  const existingDbMap = new Map<string, any>();
  for (const ep of existingDbProducts) {
    const key = `${normalizeString(ep.name)}_${normalizeString(ep.category_name || '')}`;
    existingDbMap.set(key, ep);
    existingDbMap.set(normalizeString(ep.name), ep);
  }

  const internalNameMap = new Map<string, ParsedProductItem>();

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Dans ce format, col 2 = Titre/ID, col 3 = Nom, col 4 = Prix_Vente
    // Gérer aussi si col 1 = ID, col 2 = Nom, col 3 = Prix (colonnes décalées)
    let c1 = row.getCell(1).value;
    let c2 = row.getCell(2).value;
    let c3 = row.getCell(3).value;
    let c4 = row.getCell(4).value;

    const str1 = c1 !== null && c1 !== undefined ? String(c1).trim() : '';
    const str2 = c2 !== null && c2 !== undefined ? String(c2).trim() : '';
    const str3 = c3 !== null && c3 !== undefined ? String(c3).trim() : '';
    const str4 = c4 !== null && c4 !== undefined ? String(c4).trim() : '';

    // Ligne vide
    if (!str1 && !str2 && !str3 && !str4) {
      ignoredLines.push({ row: rowNumber, reason: 'Ligne vide' });
      return;
    }

    // Détection des titres de sections / Catégories
    // Ex: "1. PARFUMS - Prix : ...", "MAISON", "HYGIENE", "6. AUTRES CATÉGORIES"
    const isSectionHeader =
      str2.match(/^\d+\s*[\.\)]\s*[A-ZÀ-Ÿ]/i) ||
      str1.match(/^\d+\s*[\.\)]\s*[A-ZÀ-Ÿ]/i) ||
      str2.toUpperCase() === 'MAISON' ||
      str2.toUpperCase() === 'HYGIENE' ||
      str2.toUpperCase() === 'HYGIÈNE' ||
      str2.toUpperCase() === 'AUTRES CATÉGORIES';

    if (isSectionHeader) {
      const rawTitle = str2 || str1;
      currentCategory = cleanCategoryName(rawTitle);
      ignoredLines.push({
        row: rowNumber,
        reason: `Titre de section détecté`,
        content: `"${rawTitle}" -> Catégorie: ${currentCategory}`
      });
      return;
    }

    // En-têtes de colonnes du sous-tableau (ID, Nom_Produit, Prix_Vente)
    const isColumnHeader =
      str2.toUpperCase() === 'ID' ||
      str1.toUpperCase() === 'ID' ||
      str3.toUpperCase().includes('NOM_PRODUIT') ||
      str3.toUpperCase().includes('PRODUITS') ||
      str4.toUpperCase().includes('PRIX_VENTE') ||
      str3.toUpperCase() === 'NOM' ||
      str4.toUpperCase() === 'PRIX';

    if (isColumnHeader) {
      ignoredLines.push({
        row: rowNumber,
        reason: "En-tête de colonnes",
        content: `${str2} | ${str3} | ${str4}`
      });
      return;
    }

    // Déterminer le nom du produit et le prix
    let productName = '';
    let rawPriceVal: any = null;

    if (str3) {
      productName = str3;
      rawPriceVal = c4;
    } else if (str2 && !str2.match(/^\d+$/)) {
      // Colonne décalée vers C2
      productName = str2;
      rawPriceVal = c3 || c4;
    } else if (str1 && !str1.match(/^\d+$/)) {
      productName = str1;
      rawPriceVal = c2 || c3 || c4;
    }

    // Nettoyer le nom
    productName = productName.replace(/\s+/g, ' ').trim();

    if (!productName) {
      ignoredLines.push({
        row: rowNumber,
        reason: 'Nom de produit absent',
        content: `C1:${str1} C2:${str2} C3:${str3} C4:${str4}`
      });
      return;
    }

    // Parser le prix en GNF (entier sans décimales bizarres)
    let sellingPrice: number | null = null;
    if (rawPriceVal !== null && rawPriceVal !== undefined && rawPriceVal !== '') {
      if (typeof rawPriceVal === 'number') {
        sellingPrice = Math.round(rawPriceVal);
      } else {
        const cleanStr = String(rawPriceVal)
          .replace(/\s+/g, '')
          .replace(/GNF/gi, '')
          .replace(/\./g, '')
          .replace(/,/g, '.');
        const parsed = parseFloat(cleanStr);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          sellingPrice = Math.round(parsed);
        }
      }
    }

    const needsCompletion = sellingPrice === null || sellingPrice <= 0;

    // Détecter les doublons
    const normKey = `${normalizeString(productName)}_${normalizeString(currentCategory)}`;
    const normNameOnly = normalizeString(productName);

    let duplicateType: 'internal' | 'existing_db' | null = null;
    let existingProd: any = null;
    let defaultAction: 'create' | 'update' | 'skip' = 'create';

    if (existingDbMap.has(normKey)) {
      duplicateType = 'existing_db';
      existingProd = existingDbMap.get(normKey);
      defaultAction = 'update';
    } else if (existingDbMap.has(normNameOnly)) {
      duplicateType = 'existing_db';
      existingProd = existingDbMap.get(normNameOnly);
      defaultAction = 'create'; // Catégorie différente -> proposer nouveau ou mise à jour
    } else if (internalNameMap.has(normNameOnly)) {
      duplicateType = 'internal';
      existingProd = internalNameMap.get(normNameOnly);
      defaultAction = 'skip';
    }

    const item: ParsedProductItem = {
      row: rowNumber,
      name: productName,
      category: currentCategory,
      selling_price: sellingPrice,
      purchase_price: null,
      stock_quantity: 0, // Zéro par défaut, à alimenter par inventaire/réception
      alert_threshold: 5,
      needs_completion: needsCompletion,
      duplicate_type: duplicateType,
      existing_product: existingProd ? {
        id: existingProd.id,
        code: existingProd.code,
        name: existingProd.name,
        category: existingProd.category_name,
        sale_price: existingProd.sale_price
      } : undefined,
      duplicate_action: duplicateType ? defaultAction : 'create'
    };

    products.push(item);
    if (!internalNameMap.has(normNameOnly)) {
      internalNameMap.set(normNameOnly, item);
    }
    categoriesMap[currentCategory] = (categoriesMap[currentCategory] || 0) + 1;
  });

  const categoriesDetected = Object.entries(categoriesMap).map(([name, count]) => ({ name, count }));
  const duplicatesCount = products.filter(p => p.duplicate_type !== null && p.duplicate_type !== undefined).length;
  const needsCompletionCount = products.filter(p => p.needs_completion).length;
  const validPriceCount = products.filter(p => !p.needs_completion).length;

  return {
    fileName: originalFileName,
    totalRows: worksheet.rowCount,
    totalDetected: products.length,
    validPriceCount,
    needsCompletionCount,
    duplicatesCount,
    ignoredLinesCount: ignoredLines.length,
    categoriesDetected,
    products,
    ignoredLines
  };
}

/**
 * Génère un code de produit unique avec un préfixe lisible selon la catégorie
 */
function generateProductCode(categoryName: string, index: number): string {
  let prefix = 'PRD';
  const c = cleanCategoryName(categoryName).toUpperCase();
  if (c.includes('PARFUM')) prefix = 'PRF';
  else if (c.includes('SAVON')) prefix = 'SAV';
  else if (c.includes('LAIT') || c.includes('CRÈME')) prefix = 'LAI';
  else if (c.includes('CHEVEUX')) prefix = 'CHV';
  else if (c.includes('ACCESSOIRE') || c.includes('TÉLÉPHONE')) prefix = 'TEL';
  else if (c.includes('HYGIÈNE') || c.includes('HYGIENE')) prefix = 'HYG';
  else if (c.includes('MAISON')) prefix = 'MAI';

  return `${prefix}-${String(index).padStart(4, '0')}`;
}

/**
 * Exécute l'importation validée dans SQLite au sein d'une transaction atomique
 */
export function executeImportTransaction(
  items: ParsedProductItem[],
  user: { id?: number; fullName?: string; username?: string } = { username: 'admin' },
  sourceName: string = 'Récupération automatique.xlsx'
): ImportReport {
  // 1. Créer une sauvegarde automatique avant toute modification importante
  let backupPath: string | null = null;
  try {
    const dbFilePath = process.env.DB_PATH || path.resolve(process.cwd(), 'data/boutique.db');
    const backupsDir = path.join(path.dirname(dbFilePath), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(backupsDir, `boutique_pre_import_${timestamp}.db`);
    db.backup(backupPath);
  } catch (backupErr) {
    console.warn('[IMPORT EXCEL] Avertissement: la sauvegarde automatique a échoué:', backupErr);
  }

  // 2. Préparer les requêtes SQL
  const getCatStmt = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)');
  const insertCatStmt = db.prepare('INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)');
  const getCodeStmt = db.prepare('SELECT id FROM products WHERE code = ?');
  const insertProductStmt = db.prepare(`
    INSERT INTO products (
      code, name, category_id, purchase_price, sale_price,
      stock_quantity, alert_threshold, is_archived,
      import_source, import_date, needs_completion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), ?)
  `);
  const updateProductStmt = db.prepare(`
    UPDATE products
    SET name = ?, category_id = ?, sale_price = ?,
        needs_completion = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  // Assurer les colonnes d'importation dans products (idempotent)
  try { db.exec("ALTER TABLE products ADD COLUMN import_source TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE products ADD COLUMN import_date DATETIME"); } catch (e) {}
  try { db.exec("ALTER TABLE products ADD COLUMN needs_completion INTEGER DEFAULT 0"); } catch (e) {}

  const report: ImportReport = {
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    needsCompletionCount: 0,
    duplicatesCount: 0,
    ignoredLinesCount: 0,
    backupPath,
    categoriesCreated: [],
    importedProducts: [],
    errors: []
  };

  const categoriesCache = new Map<string, number>();

  // Fonction helper pour obtenir ou créer une catégorie
  const getOrCreateCategory = (catName: string): number => {
    const cleanName = cleanCategoryName(catName);
    if (categoriesCache.has(cleanName)) {
      return categoriesCache.get(cleanName)!;
    }
    const existing = getCatStmt.get(cleanName) as any;
    if (existing) {
      categoriesCache.set(cleanName, existing.id);
      return existing.id;
    }
    // Créer la catégorie
    const icon = cleanName.includes('Parfum') ? 'Sparkles' :
                 cleanName.includes('Savon') ? 'Droplets' :
                 cleanName.includes('Lait') ? 'Heart' :
                 cleanName.includes('Cheveux') ? 'Scissors' :
                 cleanName.includes('Accessoire') ? 'Smartphone' :
                 cleanName.includes('Maison') ? 'Home' : 'Tag';

    const info = insertCatStmt.run(cleanName, `Importé depuis ${sourceName}`, icon);
    const newId = Number(info.lastInsertRowid);
    categoriesCache.set(cleanName, newId);
    report.categoriesCreated.push(cleanName);
    return newId;
  };

  // Compteur global pour génération de code SKU
  let codeSeq = (db.prepare('SELECT COUNT(*) as c FROM products').get() as any)?.c || 0;

  // 3. TRANSACTION ATOMIQUE SQLITE
  const transaction = db.transaction((productList: ParsedProductItem[]) => {
    for (const item of productList) {
      try {
        const action = item.duplicate_action || 'create';

        if (action === 'skip') {
          report.skippedCount++;
          continue;
        }

        const categoryId = getOrCreateCategory(item.category);
        const salePrice = item.selling_price !== null && item.selling_price > 0 ? item.selling_price : 0;
        const needsComp = salePrice === 0 ? 1 : 0;

        if (needsComp === 1) {
          report.needsCompletionCount++;
        }

        if (action === 'update' && item.existing_product?.id) {
          // Mise à jour sécurisée du produit existant
          updateProductStmt.run(
            item.name.trim(),
            categoryId,
            salePrice,
            needsComp,
            item.existing_product.id
          );
          report.updatedCount++;
          report.importedProducts.push({
            id: item.existing_product.id,
            code: item.existing_product.code,
            name: item.name.trim(),
            category: item.category,
            sale_price: salePrice,
            status: needsComp ? 'Mis à jour (À compléter)' : 'Mis à jour'
          });
        } else {
          // Création d'un nouveau produit avec code SKU unique
          codeSeq++;
          let productCode = generateProductCode(item.category, codeSeq);
          while (getCodeStmt.get(productCode)) {
            codeSeq++;
            productCode = generateProductCode(item.category, codeSeq);
          }

          const res = insertProductStmt.run(
            productCode,
            item.name.trim(),
            categoryId,
            item.purchase_price || 0,
            salePrice,
            item.stock_quantity || 0,
            item.alert_threshold || 5,
            sourceName,
            needsComp
          );

          const newId = Number(res.lastInsertRowid);
          report.importedCount++;
          report.importedProducts.push({
            id: newId,
            code: productCode,
            name: item.name.trim(),
            category: item.category,
            sale_price: salePrice,
            status: needsComp ? 'Créé (À compléter)' : 'Créé'
          });
        }
      } catch (itemErr: any) {
        console.error(`Erreur import article "${item.name}":`, itemErr);
        report.errors.push(`Ligne ${item.row} (${item.name}): ${itemErr.message}`);
        throw itemErr; // Déclenche le ROLLBACK de la transaction
      }
    }
  });

  // Exécution de la transaction atomique
  transaction(items);

  // Journal d'audit de l'importation
  logAudit(
    user.id || 1,
    user.fullName || user.username || 'admin',
    'EXCEL_IMPORT',
    'PRODUCT_CATALOG',
    null,
    `Importation Excel réussie depuis "${sourceName}": ${report.importedCount} créés, ${report.updatedCount} mis à jour, ${report.skippedCount} ignorés, ${report.needsCompletionCount} à compléter.`
  );

  return report;
}
