#!/usr/bin/env node
// Database backup and migration utility
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Paths are relative to server/, not server/db/, so the data file and backups do not move.
const CURRENT_DB = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `dnd_backup_${timestamp}.db`);
  
  console.log(`📦 Creating backup: ${backupPath}`);
  
  if (fs.existsSync(CURRENT_DB)) {
    fs.copyFileSync(CURRENT_DB, backupPath);
    console.log(`✅ Backup created successfully`);
    
    // Also create SQL dump for text-based backup
    const db = new Database(CURRENT_DB, { readonly: true });
    const sqlDumpPath = path.join(BACKUP_DIR, `dnd_backup_${timestamp}.sql`);
    
    try {
      // Get all table names
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      let sqlDump = '-- Database backup created at ' + new Date().toISOString() + '\n\n';
      
      for (const table of tables) {
        const tableName = table.name;
        
        // Get CREATE TABLE statement
        const createStmt = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (createStmt && createStmt.sql) {
          sqlDump += createStmt.sql + ';\n\n';
        }
        
        // Get all data
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        if (rows.length > 0) {
          sqlDump += `-- Data for table ${tableName}\n`;
          for (const row of rows) {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(v => 
              v === null ? 'NULL' : 
              typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : 
              v
            ).join(', ');
            sqlDump += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
          }
          sqlDump += '\n';
        }
      }
      
      fs.writeFileSync(sqlDumpPath, sqlDump);
      console.log(`📄 SQL dump created: ${sqlDumpPath}`);
      
    } catch (error) {
      console.warn('⚠️  Failed to create SQL dump:', error.message);
    } finally {
      db.close();
    }
    
    return backupPath;
  } else {
    console.log('⚠️  No database file found to backup');
    return null;
  }
}

function listBackups() {
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.db'))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_DIR, file),
      created: fs.statSync(path.join(BACKUP_DIR, file)).mtime
    }))
    .sort((a, b) => b.created - a.created);
  
  console.log('\n📋 Available backups:');
  backups.forEach((backup, index) => {
    console.log(`  ${index + 1}. ${backup.name} (${backup.created.toLocaleString()})`);
  });
  
  return backups;
}

function restoreBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  console.log(`🔄 Restoring backup: ${backupPath}`);
  
  // Create backup of current DB first
  if (fs.existsSync(CURRENT_DB)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestoreBackup = path.join(BACKUP_DIR, `pre_restore_${timestamp}.db`);
    fs.copyFileSync(CURRENT_DB, preRestoreBackup);
    console.log(`📦 Current database backed up to: ${preRestoreBackup}`);
  }
  
  // Restore from backup
  fs.copyFileSync(backupPath, CURRENT_DB);
  console.log(`✅ Database restored from backup`);
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'backup':
    createBackup();
    break;
    
  case 'list':
    listBackups();
    break;
    
  case 'restore':
    const backupFile = process.argv[3];
    if (!backupFile) {
      console.error('❌ Please specify backup file to restore');
      console.log('Usage: node migrate.js restore <backup-filename>');
      process.exit(1);
    }
    const backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(BACKUP_DIR, backupFile);
    restoreBackup(backupPath);
    break;
    
  default:
    console.log(`
🗄️  Database Migration Utility

Commands:
  backup    Create a backup of current database
  list      List all available backups
  restore   Restore from a backup file

Examples:
  node migrate.js backup
  node migrate.js list
  node migrate.js restore dnd_backup_2024-10-22T10-30-00-000Z.db

Environment Variables:
  DATABASE_PATH  Path to current database (default: ./data.db)
    `);
}