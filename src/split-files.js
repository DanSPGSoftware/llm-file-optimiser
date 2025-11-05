#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileExtractor } from './fileExtractor.js';
import { ClaudeClient } from './claudeClient.js';
import { FileWriter } from './fileWriter.js';
import { CLI } from './cli.js';
import { ProgressTracker } from './progressTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Split-only mode for batch processing files into topics
 */
class FileSplitter {
  constructor() {
    this.extractor = new FileExtractor();
    this.claudeClient = null;
    this.writer = null;
    this.cli = new CLI();
    this.progressTracker = new ProgressTracker('./split-progress.json');

    this.inputFolder = process.env.INPUT_FOLDER || './input-files';
    this.outputFolder = process.env.OUTPUT_FOLDER || './output-files';
    this.exportFormat = process.env.EXPORT_FORMAT || null;
    this.concurrentTopicOptimizations = parseInt(process.env.CONCURRENT_TOPIC_OPTIMIZATIONS || '3');
    this.minPagesForSplit = parseInt(process.env.MIN_PAGES_FOR_SPLIT || '5');
  }

  /**
   * Initialize the splitter
   */
  async initialize() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in .env file. Please add your Claude API key.');
    }

    this.claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);

    this.inputFolder = path.resolve(this.inputFolder);
    this.outputFolder = path.resolve(this.outputFolder);
  }

  /**
   * Process all files in split mode
   */
  async processFiles() {
    try {
      await this.initialize();

      console.clear();
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║         SPLIT MODE - Interactive Topic Splitter       ║');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      console.log('Select files to analyze and split into topic-focused files.');
      console.log('Each split is verified for accuracy before replacing.\n');

      // Scan for files
      this.cli.displayProcessing('Scanning input folder');
      const allFiles = await this.extractor.scanDirectory(this.inputFolder);

      if (allFiles.length === 0) {
        console.log('\nNo files found in input folder. Please add files to:');
        console.log(this.inputFolder);
        return;
      }

      console.log(`\nFound ${allFiles.length} file(s) in input folder\n`);

      // Prompt for export format if not set
      if (!this.exportFormat) {
        this.exportFormat = await this.cli.promptExportFormat();
        this.writer = new FileWriter(this.exportFormat);
        console.log(`\n📄 Export format: ${this.exportFormat.toUpperCase()}\n`);
      } else {
        this.writer = new FileWriter(this.exportFormat);
      }

      // Interactive file selection loop
      while (true) {
        const selectedFile = await this.promptFileSelection(allFiles);

        if (!selectedFile) {
          console.log('\n👋 Exiting split mode...\n');
          break;
        }

        await this.splitFile(selectedFile);

        // Ask if they want to split another
        const continueChoice = await this.cli.promptContinue('\nSplit another file?');
        if (!continueChoice) {
          console.log('\n👋 Exiting split mode...\n');
          break;
        }
      }

    } catch (error) {
      this.cli.displayError(error.message);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Prompt user to select a file from the list
   */
  async promptFileSelection(files) {
    const prompts = (await import('prompts')).default;
    const chalk = (await import('chalk')).default;

    // Extract content from files to get page estimates
    console.log(chalk.gray('  Loading file information...'));

    const filesWithPageInfo = await Promise.all(
      files.map(async (file) => {
        try {
          const content = await this.extractor.extractContent(file.path);
          return {
            ...file,
            pageEstimate: content.pageEstimate
          };
        } catch (error) {
          return {
            ...file,
            pageEstimate: '?'
          };
        }
      })
    );

    // Sort by page count (largest first), put files with '?' at the end
    filesWithPageInfo.sort((a, b) => {
      if (a.pageEstimate === '?') return 1;
      if (b.pageEstimate === '?') return -1;
      return b.pageEstimate - a.pageEstimate;
    });

    const choices = filesWithPageInfo.map((file) => ({
      title: `${file.name} ${chalk.gray(`(${(file.size / 1024).toFixed(2)} KB, ${file.pageEstimate} pages)`)}`,
      value: file,
      description: file.extension
    }));

    choices.push({
      title: chalk.red('[Exit]'),
      value: null,
      description: 'Exit split mode'
    });

    const response = await prompts({
      type: 'select',
      name: 'file',
      message: 'Select a file to split:',
      choices,
      initial: 0
    });

    return response.file;
  }

  /**
   * Split a single file into topics
   */
  async splitFile(file) {
    const chalk = (await import('chalk')).default;

    try {
      console.log('\n' + '═'.repeat(60));
      console.log(`📄 Processing: ${file.name}`);
      console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
      console.log('═'.repeat(60));

      // Extract content
      this.cli.displayProcessing('\nExtracting content');
      const extractedContent = await this.extractor.extractContent(file.path);

      console.log(`\n📊 Document Info:`);
      console.log(`   Words: ${extractedContent.wordCount}`);
      console.log(`   Estimated pages: ${extractedContent.pageEstimate}`);

      // Check if file is large enough to consider splitting
      if (extractedContent.pageEstimate < this.minPagesForSplit) {
        console.log(chalk.yellow(`\n⚠ Document is only ${extractedContent.pageEstimate} page(s).`));
        console.log(chalk.yellow(`   Splitting recommended for documents ≥ ${this.minPagesForSplit} pages.`));

        const response = await this.cli.promptContinue('\nAnalyze for topics anyway?');

        if (!response) {
          console.log(chalk.gray('\n⏭ Skipping file...'));
          return true;
        }
      }

      // Analyze topics
      this.cli.displayProcessing('Analyzing document topics');
      const topics = await this.claudeClient.analyzeTopics(extractedContent.text);

      if (topics.length <= 1) {
        console.log(chalk.yellow('\n⚠ Document appears to be a single topic. Split not recommended.'));
        return true;
      }

      // Display topic suggestions
      this.cli.displayTopicSuggestions(topics);

      // Confirm split
      const confirmed = await this.cli.promptTopicSplitConfirmation(topics);

      if (!confirmed) {
        console.log(chalk.gray('\n✗ Split cancelled.'));
        return true;
      }

      // Optimize and split topics in batches
      this.cli.displayProcessing(`Optimizing ${topics.length} topic files (${this.concurrentTopicOptimizations} at a time)`);

      const optimizedContents = [];
      const batchSize = this.concurrentTopicOptimizations;

      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(topics.length / batchSize);

        console.log(`\n  Batch ${batchNum}/${totalBatches}: Processing ${batch.length} topic(s) in parallel...`);

        const batchPromises = batch.map(async (topic, batchIndex) => {
          const topicNum = i + batchIndex + 1;
          console.log(`    • Topic ${topicNum}/${topics.length}: ${topic.topicName}`);

          // Extract topic content
          const topicContent = this.extractTopicContent(
            extractedContent.text,
            topic.startMarker,
            topic.endMarker
          );

          // Optimize this topic
          return await this.claudeClient.optimizeContent(topicContent);
        });

        const batchResults = await Promise.all(batchPromises);
        optimizedContents.push(...batchResults);

        console.log(`    ✓ Batch ${batchNum} completed`);
      }

      // Validate accuracy of each split file
      console.log(chalk.cyan('\n📋 Validating accuracy of split files...\n'));

      let allAccurate = true;
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        const optimizedContent = optimizedContents[i];

        console.log(`  Checking topic ${i + 1}/${topics.length}: ${topic.topicName}`);

        // Extract original topic content
        const originalTopicContent = this.extractTopicContent(
          extractedContent.text,
          topic.startMarker,
          topic.endMarker
        );

        // Validate accuracy
        const validation = await this.claudeClient.validateAccuracy(
          originalTopicContent,
          optimizedContent
        );

        if (validation.accurate) {
          console.log(chalk.green(`    ✓ Accurate`));
        } else {
          console.log(chalk.red(`    ✗ Failed`));
          if (validation.missingInfo && validation.missingInfo.length > 0) {
            console.log(chalk.yellow(`    Missing: ${validation.missingInfo.join(', ')}`));
          }
          allAccurate = false;
        }
      }

      if (!allAccurate) {
        console.log(chalk.red('\n⚠ Some split files failed accuracy validation!'));
        const proceedAnyway = await this.cli.promptContinue('Save split files anyway?');

        if (!proceedAnyway) {
          console.log(chalk.gray('\n✗ Split cancelled.'));
          return true;
        }
      } else {
        console.log(chalk.green('\n✓ All split files passed accuracy validation!'));
      }

      // Check what exists in OUTPUT_FOLDER
      const baseName = path.basename(file.path, path.extname(file.path));
      const splitFolderPath = path.join(this.outputFolder, baseName);

      let existingFiles = [];
      try {
        const fs = await import('fs/promises');
        await fs.access(splitFolderPath);
        const entries = await fs.readdir(splitFolderPath);
        existingFiles = entries.filter(f => !f.startsWith('.'));
      } catch (error) {
        // Folder doesn't exist yet
      }

      // Show what will be replaced
      if (existingFiles.length > 0) {
        console.log(chalk.yellow(`\n⚠ Found existing files in ${baseName}/:`));
        existingFiles.forEach(f => console.log(chalk.yellow(`  • ${f}`)));
        console.log(chalk.cyan(`\nWill be replaced with ${topics.length} new split files:`));
        topics.forEach((t) => {
          const fileName = this.writer.sanitizeFilename(t.topicName) + `.${this.exportFormat}`;
          console.log(chalk.cyan(`  • ${fileName}`));
        });

        const confirmReplace = await this.cli.promptContinue('\nReplace existing files with new split?');

        if (!confirmReplace) {
          console.log(chalk.gray('\n✗ Split cancelled. Existing files kept.'));
          return true;
        }
      }

      // Save split files
      this.cli.displayProcessing('Saving split files');
      const savedFiles = await this.writer.saveSplitFiles(
        file.path,
        topics,
        optimizedContents,
        this.outputFolder
      );

      console.log(chalk.green(`\n✓ Created ${savedFiles.length} split files in folder: ${baseName}/`));
      savedFiles.forEach(f => console.log(chalk.green(`  • ${path.basename(path.dirname(f))}/${path.basename(f)}`)));

      return true;

    } catch (error) {
      this.cli.displayError(`Failed to split ${file.name}: ${error.message}`);
      console.error(error);

      const shouldContinue = await this.cli.confirmContinue();
      return shouldContinue;
    }
  }

  /**
   * Extract content between markers
   */
  extractTopicContent(fullContent, startMarker, endMarker) {
    const startIndex = fullContent.indexOf(startMarker);
    const endIndex = fullContent.indexOf(endMarker, startIndex);

    if (startIndex === -1 || endIndex === -1) {
      return fullContent;
    }

    return fullContent.substring(startIndex, endIndex + endMarker.length);
  }
}

// Run the splitter
const splitter = new FileSplitter();
splitter.processFiles();
