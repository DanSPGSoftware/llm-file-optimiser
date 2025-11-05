#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { FileExtractor } from './fileExtractor.js';
import { ClaudeClient } from './claudeClient.js';
import { FileWriter } from './fileWriter.js';
import { CLI } from './cli.js';
import prompts from 'prompts';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Verification mode - checks accuracy of optimized files against originals
 */
class FileVerifier {
  constructor() {
    this.extractor = new FileExtractor();
    this.claudeClient = null;
    this.writer = null;
    this.cli = new CLI();

    this.rawFolder = process.env.INPUT_FOLDER || './input-files';
    this.optimizedFolder = process.env.OUTPUT_FOLDER || './output-files';
    this.exportFormat = process.env.EXPORT_FORMAT || 'txt';
  }

  /**
   * Initialize the verifier
   */
  async initialize() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in .env file. Please add your Claude API key.');
    }

    this.claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);
    this.writer = new FileWriter(this.exportFormat);

    this.rawFolder = path.resolve(this.rawFolder);
    this.optimizedFolder = path.resolve(this.optimizedFolder);
  }

  /**
   * Main verification workflow
   */
  async verifyFiles() {
    try {
      await this.initialize();

      console.clear();
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║         VERIFY MODE - Accuracy Checker                ║');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      console.log('This mode compares optimized files with their original');
      console.log('versions to verify accuracy and completeness.\n');

      // Scan both directories recursively
      console.log(chalk.gray('Scanning directories recursively...'));
      const rawFiles = await this.scanRawFilesRecursive(this.rawFolder);
      const optimizedItems = await this.scanOptimizedFilesRecursive(this.optimizedFolder);

      // Count total optimized items (files + split folders)
      const optimizedFilesCount = optimizedItems.filter(i => i.type === 'file').length;
      const splitFoldersCount = optimizedItems.filter(i => i.type === 'split').length;

      console.log(`\n📁 Raw files: ${rawFiles.length}`);
      console.log(`📁 Optimized items: ${optimizedItems.length} (${optimizedFilesCount} files, ${splitFoldersCount} split folders)\n`);

      // Match optimized files with raw originals
      const matches = this.matchFiles(rawFiles, optimizedItems);

      if (matches.length === 0) {
        console.log(chalk.yellow('⚠ No matching file pairs found.'));
        console.log(chalk.gray('Make sure optimized files have "_optimized" suffix.'));
        return;
      }

      console.log(chalk.green(`✓ Found ${matches.length} file pair(s) to verify\n`));

      // Display matches
      console.log(chalk.cyan('File Pairs to Verify:'));
      matches.forEach((match, i) => {
        // Show relative path if in subfolder
        const rawDisplay = match.rawFile.relativePath.includes(path.sep)
          ? match.rawFile.relativePath
          : match.rawFile.name;

        if (match.isSplit) {
          const optDisplay = match.optimizedItem.relativePath.includes(path.sep)
            ? `${match.optimizedItem.relativePath}/`
            : `${match.optimizedItem.name}/`;
          console.log(`${i + 1}. ${chalk.white(rawDisplay)} → ${chalk.magenta(optDisplay)} ${chalk.gray(`(${match.optimizedItem.fileCount} split files)`)}`);
        } else {
          const optDisplay = match.optimizedItem.relativePath.includes(path.sep)
            ? match.optimizedItem.relativePath
            : match.optimizedItem.name;
          console.log(`${i + 1}. ${chalk.white(rawDisplay)} → ${chalk.white(optDisplay)}`);
        }
      });
      console.log('');

      // Verify each pair with navigation
      const results = {
        passed: 0,
        failed: 0,
        reOptimized: 0,
        skipped: 0
      };

      let i = 0;
      while (i < matches.length) {
        const match = matches[i];

        // Show relative path if in subfolder
        const rawDisplay = match.rawFile.relativePath.includes(path.sep)
          ? match.rawFile.relativePath
          : match.rawFile.name;

        console.log('\n' + '═'.repeat(60));
        console.log(`📄 File ${i + 1}/${matches.length}: ${rawDisplay}`);

        if (match.isSplit) {
          const optDisplay = match.optimizedItem.relativePath.includes(path.sep)
            ? `${match.optimizedItem.relativePath}/`
            : `${match.optimizedItem.name}/`;
          console.log(`   Optimized: ${optDisplay} (${match.optimizedItem.fileCount} split files)`);
        } else {
          const optDisplay = match.optimizedItem.relativePath.includes(path.sep)
            ? match.optimizedItem.relativePath
            : match.optimizedItem.name;
          console.log(`   Optimized: ${optDisplay}`);
        }
        console.log('═'.repeat(60));

        // Ask what to do with this file
        const action = await this.promptFileNavigation(i);

        if (action === 'verify') {
          const result = await this.verifyFilePair(match);

          if (result === 'passed') results.passed++;
          else if (result === 'failed') results.failed++;
          else if (result === 're-optimized') results.reOptimized++;
          else if (result === 'skipped') results.skipped++;

          i++; // Move to next file
        } else if (action === 'skip') {
          console.log(chalk.gray('\n⏭ Skipping...'));
          results.skipped++;
          i++; // Move to next file
        } else if (action === 'back') {
          if (i > 0) {
            i--; // Go back to previous file
            console.log(chalk.blue('\n⬅ Going back to previous file...'));
          } else {
            console.log(chalk.yellow('\n⚠ Already at first file'));
          }
        } else if (action === 'exit') {
          console.log(chalk.gray('\n👋 Exiting verification...'));
          break;
        }
      }

      // Display summary
      console.log('\n' + '═'.repeat(60));
      console.log(chalk.bold('Verification Complete'));
      console.log('═'.repeat(60));
      console.log(chalk.green(`✓ Passed: ${results.passed}`));
      console.log(chalk.red(`✗ Failed: ${results.failed}`));
      console.log(chalk.blue(`⟳ Re-optimized: ${results.reOptimized}`));
      console.log(chalk.gray(`⏭ Skipped: ${results.skipped}`));
      console.log('═'.repeat(60) + '\n');

    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error.message);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Verify a single file pair (with retry loop)
   */
  async verifyFilePair(match) {
    try {
      // Extract raw content once
      console.log(chalk.gray('\n  Extracting raw content...'));
      const rawContent = await this.extractor.extractContent(match.rawFile.path);

      // Retry loop - keep verifying until passes or user skips
      let attemptCount = 0;
      const maxAttempts = 10; // Safety limit

      while (attemptCount < maxAttempts) {
        attemptCount++;

        if (attemptCount > 1) {
          console.log(chalk.cyan(`\n  🔄 Verification Attempt ${attemptCount}`));
        }

        // Extract optimized content
        console.log(chalk.gray('  Extracting optimized content...'));
        let optimizedContent;

        if (match.isSplit) {
          // Combine all split files
          console.log(chalk.gray(`  Combining ${match.optimizedItem.fileCount} split files...`));
          optimizedContent = await this.combineSplitFiles(match.optimizedItem.files);
        } else {
          // Single optimized file
          optimizedContent = await fs.readFile(match.optimizedItem.path, 'utf-8');
        }

        // Remove metadata header from optimized content if present
        const cleanOptimized = this.cleanOptimizedContent(optimizedContent);

        // Run accuracy validation
        console.log(chalk.gray('  Running accuracy check...'));
        const validation = await this.claudeClient.validateAccuracy(
          rawContent.text,
          cleanOptimized
        );

        // Display results
        console.log('\n  📊 Validation Results:');
        console.log(`     Accurate: ${validation.accurate ? chalk.green('✓ Yes') : chalk.red('✗ No')}`);
        console.log(`     Summary: ${validation.summary}`);

        if (validation.missingInfo && validation.missingInfo.length > 0) {
          console.log(chalk.yellow('     Missing Information:'));
          validation.missingInfo.forEach(info => {
            console.log(chalk.yellow(`       • ${info}`));
          });
        }

        if (validation.concerns && validation.concerns.length > 0) {
          console.log(chalk.yellow('     Concerns:'));
          validation.concerns.forEach(concern => {
            console.log(chalk.yellow(`       • ${concern}`));
          });
        }

        if (validation.accurate) {
          console.log(chalk.green('\n  ✓ Accuracy check PASSED'));
          if (attemptCount > 1) {
            console.log(chalk.green(`  ✓ File passed after ${attemptCount} attempt(s)`));
            return 're-optimized';
          }
          return 'passed';
        } else {
          console.log(chalk.red('\n  ✗ Accuracy check FAILED'));

          // Offer to re-optimize
          const action = await this.promptFailureAction();

          if (action === 'guided') {
            // Re-optimize with guided prompt
            const guidedPrompt = this.buildGuidedPrompt(validation);
            const result = await this.reOptimizeFile(match, rawContent, guidedPrompt);

            if (result === 'failed') {
              console.log(chalk.red('\n  ✗ Re-optimization failed'));
              return 'failed';
            }
            // Continue loop to re-verify

          } else if (action === 're-optimize') {
            const result = await this.reOptimizeFile(match, rawContent);

            if (result === 'failed') {
              console.log(chalk.red('\n  ✗ Re-optimization failed'));
              return 'failed';
            }
            // Continue loop to re-verify

          } else if (action === 'custom-prompt') {
            const customPrompt = await this.cli.promptCustomPrompt(
              this.claudeClient.getDefaultOptimizationPrompt()
            );
            const result = await this.reOptimizeFile(match, rawContent, customPrompt);

            if (result === 'failed') {
              console.log(chalk.red('\n  ✗ Re-optimization failed'));
              return 'failed';
            }
            // Continue loop to re-verify

          } else {
            // User chose to skip
            console.log(chalk.gray('\n  ⏭ Skipped re-optimization'));
            return 'skipped';
          }
        }
      }

      // Should never reach here, but just in case
      console.log(chalk.red(`\n  ✗ Max attempts (${maxAttempts}) reached`));
      return 'failed';

    } catch (error) {
      console.error(chalk.red(`\n  ✗ Error verifying file: ${error.message}`));
      return 'failed';
    }
  }

  /**
   * Re-optimize a failed file
   */
  async reOptimizeFile(match, rawContent, customPrompt = null) {
    try {
      console.log(chalk.blue('\n  ⟳ Re-optimizing file...'));

      // Re-optimize
      const optimizedContent = await this.claudeClient.optimizeContent(
        rawContent.text,
        customPrompt
      );

      // Save the re-optimized file
      console.log(chalk.gray('  Generating summary...'));
      const summary = await this.claudeClient.generateSummary(optimizedContent);

      console.log(chalk.gray('  Saving re-optimized file...'));
      await this.writer.saveOptimizedContent(
        match.rawFile.path,
        optimizedContent,
        summary,
        this.optimizedFolder
      );

      console.log(chalk.green('  ✓ File saved. Re-checking accuracy...'));
      return 'success';

    } catch (error) {
      console.error(chalk.red(`\n  ✗ Error re-optimizing: ${error.message}`));
      return 'failed';
    }
  }

  /**
   * Prompt for action on failed validation
   */
  async promptFailureAction() {
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: chalk.green('[g] Re-optimize with GUIDED prompt (uses accuracy feedback to fix issues)'), value: 'guided' },
        { title: chalk.blue('[r] Re-optimize with default prompt (standard re-optimization)'), value: 're-optimize' },
        { title: chalk.yellow('[c] Re-optimize with custom prompt (you write the prompt)'), value: 'custom-prompt' },
        { title: chalk.gray('[s] Skip and continue (keep existing version)'), value: 'skip' }
      ],
      initial: 0
    });

    if (!response.action) {
      return 'skip';
    }

    // Confirm re-optimization actions
    if (response.action === 'guided') {
      const confirmed = await this.cli.promptContinue('Re-optimize using accuracy feedback to guide Claude?');
      return confirmed ? 'guided' : 'skip';
    } else if (response.action === 're-optimize') {
      const confirmed = await this.cli.promptContinue('Re-optimize this file with default prompt?');
      return confirmed ? 're-optimize' : 'skip';
    } else if (response.action === 'custom-prompt') {
      const confirmed = await this.cli.promptContinue('Re-optimize this file with custom prompt?');
      return confirmed ? 'custom-prompt' : 'skip';
    }

    return response.action;
  }

  /**
   * Prompt for file navigation (verify/skip/back/exit)
   */
  async promptFileNavigation(currentIndex) {
    const choices = [
      { title: chalk.green('[v] Verify this file'), value: 'verify' },
      { title: chalk.gray('[s] Skip this file'), value: 'skip' }
    ];

    // Add back option if not at first file
    if (currentIndex > 0) {
      choices.push({ title: chalk.blue('[b] Back to previous file'), value: 'back' });
    }

    choices.push({ title: chalk.red('[x] Exit verification'), value: 'exit' });

    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      initial: 0
    });

    return response.action || 'skip';
  }

  /**
   * Build guided re-optimization prompt using validation feedback
   */
  buildGuidedPrompt(validation) {
    const defaultPrompt = this.claudeClient.getDefaultOptimizationPrompt();

    let guidedPrompt = defaultPrompt + '\n\n---IMPORTANT FEEDBACK---\n';
    guidedPrompt += 'The previous optimization was checked for accuracy and had the following issues:\n\n';

    if (validation.missingInfo && validation.missingInfo.length > 0) {
      guidedPrompt += '**MISSING INFORMATION:**\n';
      validation.missingInfo.forEach(info => {
        guidedPrompt += `- ${info}\n`;
      });
      guidedPrompt += '\n';
    }

    if (validation.concerns && validation.concerns.length > 0) {
      guidedPrompt += '**CONCERNS:**\n';
      validation.concerns.forEach(concern => {
        guidedPrompt += `- ${concern}\n`;
      });
      guidedPrompt += '\n';
    }

    guidedPrompt += `**ASSESSMENT:** ${validation.summary}\n\n`;
    guidedPrompt += 'CRITICAL: Please re-optimize the document making sure to include ALL the missing information and address ALL concerns listed above. ';
    guidedPrompt += 'Do not summarize or omit any details - preserve EVERY piece of information from the original.';

    return guidedPrompt;
  }

  /**
   * Combine split topic files into single content
   */
  async combineSplitFiles(files) {
    const contents = [];

    // Sort files alphabetically for consistent ordering
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

    for (const file of sortedFiles) {
      const content = await fs.readFile(file.path, 'utf-8');
      // Clean metadata from each file
      const cleaned = this.cleanOptimizedContent(content);
      contents.push(cleaned);
    }

    // Combine with separator
    return contents.join('\n\n' + '='.repeat(60) + '\n\n');
  }

  /**
   * Clean optimized content (remove metadata headers)
   */
  cleanOptimizedContent(content) {
    // Remove SUMMARY header from txt files
    let cleaned = content.replace(/^SUMMARY:.*?\n={80,}\n\n/s, '');

    // Remove frontmatter from markdown files
    cleaned = cleaned.replace(/^---\n.*?\n---\n\n/s, '');

    return cleaned;
  }

  /**
   * Recursively scan raw files directory
   */
  async scanRawFilesRecursive(dirPath, basePath = dirPath, files = []) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden/temp files
        if (entry.name.startsWith('.') || entry.name.startsWith('~$')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanRawFilesRecursive(fullPath, basePath, files);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.docx', '.pdf', '.txt', '.md'].includes(ext)) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(basePath, fullPath);

            files.push({
              name: entry.name,
              path: fullPath,
              relativePath: relativePath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Recursively scan optimized files directory (including subfolders for split files)
   */
  async scanOptimizedFilesRecursive(dirPath, basePath = dirPath, items = []) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden/temp files
        if (entry.name.startsWith('.') || entry.name.startsWith('~$')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.txt', '.md', '.docx'].includes(ext)) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(basePath, fullPath);

            items.push({
              type: 'file',
              name: entry.name,
              path: fullPath,
              relativePath: relativePath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime
            });
          }
        } else if (entry.isDirectory()) {
          // Check if this folder contains optimized files (potential split folder)
          const subfiles = await this.scanSubfolder(fullPath);

          if (subfiles.length > 0) {
            // This is a split folder
            const relativePath = path.relative(basePath, fullPath);
            items.push({
              type: 'split',
              name: entry.name,
              folderPath: fullPath,
              relativePath: relativePath,
              files: subfiles,
              fileCount: subfiles.length
            });
          } else {
            // Empty or nested directory - scan recursively
            await this.scanOptimizedFilesRecursive(fullPath, basePath, items);
          }
        }
      }

      return items;
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Scan optimized files directory (including subfolders for split files)
   */
  async scanOptimizedFiles(dirPath) {
    const items = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden/temp files
        if (entry.name.startsWith('.') || entry.name.startsWith('~$')) {
          continue;
        }

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.txt', '.md', '.docx'].includes(ext)) {
            const fullPath = path.join(dirPath, entry.name);
            const stats = await fs.stat(fullPath);

            items.push({
              type: 'file',
              name: entry.name,
              path: fullPath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime
            });
          }
        } else if (entry.isDirectory()) {
          // Check if this is a split files folder
          const subfolderPath = path.join(dirPath, entry.name);
          const subfiles = await this.scanSubfolder(subfolderPath);

          if (subfiles.length > 0) {
            items.push({
              type: 'split',
              name: entry.name,
              folderPath: subfolderPath,
              files: subfiles,
              fileCount: subfiles.length
            });
          }
        }
      }

      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Scan a subfolder for split topic files
   */
  async scanSubfolder(folderPath) {
    const files = [];

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.txt', '.md', '.docx'].includes(ext)) {
            const fullPath = path.join(folderPath, entry.name);
            const stats = await fs.stat(fullPath);

            files.push({
              name: entry.name,
              path: fullPath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Match optimized files with their raw originals
   */
  matchFiles(rawFiles, optimizedItems) {
    const matches = [];

    for (const optimizedItem of optimizedItems) {
      let targetName, targetDir;

      if (optimizedItem.type === 'file') {
        // Regular optimized file - remove _optimized suffix
        targetName = optimizedItem.name.replace(/_optimized\.(txt|md|docx)$/, '');
        targetDir = path.dirname(optimizedItem.relativePath);
      } else if (optimizedItem.type === 'split') {
        // Split files folder - folder name is the base name
        targetName = optimizedItem.name;
        targetDir = path.dirname(optimizedItem.relativePath);
      } else {
        continue;
      }

      // Find matching raw file by comparing:
      // 1. Directory path (relative)
      // 2. Base filename (without extension)
      const rawFile = rawFiles.find(raw => {
        const rawBaseName = path.basename(raw.name, raw.extension);
        const rawDir = path.dirname(raw.relativePath);

        // Match if:
        // - Same directory path
        // - Same base filename
        return rawDir === targetDir && rawBaseName === targetName;
      });

      if (rawFile) {
        matches.push({
          rawFile,
          optimizedItem,
          isSplit: optimizedItem.type === 'split'
        });
      }
    }

    return matches;
  }
}

// Run the verifier
const verifier = new FileVerifier();
verifier.verifyFiles();
