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
      console.log('║         SPLIT MODE - Topic File Splitter              ║');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      console.log('This mode analyzes documents and splits them into');
      console.log('separate topic-focused files without full optimization.\n');

      // Load progress
      await this.progressTracker.load();
      const progressStats = this.progressTracker.getStats();

      // Scan for files
      this.cli.displayProcessing('Scanning input folder');
      const allFiles = await this.extractor.scanDirectory(this.inputFolder);

      if (allFiles.length === 0) {
        console.log('\nNo files found in input folder. Please add files to:');
        console.log(this.inputFolder);
        return;
      }

      // Check for previous progress
      let filesToProcess = allFiles;

      if (progressStats.totalProcessed > 0) {
        console.log(`\n📊 Previous split progress found: ${progressStats.totalProcessed} files processed\n`);

        const action = await this.cli.promptResumeOrReset();

        if (action === 'view') {
          this.cli.displayProcessedFiles(this.progressTracker.getProcessedFiles());
          await this.cli.waitForEnter();
          return await this.processFiles();
        } else if (action === 'reset') {
          await this.progressTracker.reset();
          console.log('\n✓ Progress reset. Starting fresh...\n');
          filesToProcess = allFiles;
        } else if (action === 'exit') {
          console.log('\nExiting...');
          return;
        } else {
          filesToProcess = this.progressTracker.filterUnprocessedFiles(allFiles);
          console.log(`\n✓ Resuming... ${filesToProcess.length} unprocessed files remaining.\n`);
        }
      } else {
        console.log(`\nFound ${allFiles.length} file(s) to process\n`);
      }

      if (filesToProcess.length === 0) {
        console.log('\n✓ All files have been processed!\n');
        return;
      }

      // Prompt for export format if not set
      if (!this.exportFormat) {
        this.exportFormat = await this.cli.promptExportFormat();
        this.writer = new FileWriter(this.exportFormat);
        console.log(`\n📄 Export format: ${this.exportFormat.toUpperCase()}\n`);
      } else {
        this.writer = new FileWriter(this.exportFormat);
      }

      // Process each file
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];

        console.log('\n' + '═'.repeat(60));
        console.log(`📄 File ${i + 1} of ${filesToProcess.length}: ${file.name}`);
        console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
        console.log(`   Type: ${file.extension}`);
        console.log('═'.repeat(60) + '\n');

        const shouldContinue = await this.splitFile(file, i + 1, filesToProcess.length);

        if (!shouldContinue) {
          console.log('\nProcessing cancelled by user.');
          console.log('Progress has been saved. Run again to continue.\n');
          break;
        }
      }

      console.log('\n' + '═'.repeat(60));
      console.log('✓ Split processing complete!');
      console.log(`Output files: ${this.outputFolder}`);
      console.log('═'.repeat(60) + '\n');

    } catch (error) {
      this.cli.displayError(error.message);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Split a single file into topics
   */
  async splitFile(file, currentIndex, totalFiles) {
    try {
      // Extract content
      this.cli.displayProcessing('Extracting content');
      const extractedContent = await this.extractor.extractContent(file.path);

      console.log(`\n📊 Document Info:`);
      console.log(`   Words: ${extractedContent.wordCount}`);
      console.log(`   Estimated pages: ${extractedContent.pageEstimate}`);

      // Check if file is large enough to consider splitting
      if (extractedContent.pageEstimate < this.minPagesForSplit) {
        console.log(`\n⚠ Document is only ${extractedContent.pageEstimate} page(s).`);
        console.log(`   Splitting recommended for documents ≥ ${this.minPagesForSplit} pages.`);

        const response = await this.cli.promptContinue('\nAnalyze for topics anyway?');

        if (!response) {
          console.log('\n⏭ Skipping file...');
          await this.progressTracker.markProcessed(
            file.path,
            file.name,
            'skipped',
            []
          );
          return true;
        }
      }

      // Analyze topics
      this.cli.displayProcessing('Analyzing document topics');
      const topics = await this.claudeClient.analyzeTopics(extractedContent.text);

      if (topics.length <= 1) {
        console.log('\n⚠ Document appears to be a single topic. Split not recommended.');

        const response = await this.cli.promptContinue('\nMark as processed and continue?');

        await this.progressTracker.markProcessed(
          file.path,
          file.name,
          'single-topic',
          []
        );

        return response;
      }

      // Display topic suggestions
      this.cli.displayTopicSuggestions(topics);

      // Confirm split
      const confirmed = await this.cli.promptTopicSplitConfirmation(topics);

      if (!confirmed) {
        console.log('\n✗ Split cancelled.');

        await this.progressTracker.markProcessed(
          file.path,
          file.name,
          'rejected',
          []
        );

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

      // Save split files
      this.cli.displayProcessing('Saving split files');
      const savedFiles = await this.writer.saveSplitFiles(
        file.path,
        topics,
        optimizedContents,
        this.outputFolder
      );

      const splitFolderName = path.basename(file.path, path.extname(file.path));
      console.log(`\n✓ Created ${savedFiles.length} split files in folder: ${splitFolderName}/`);
      savedFiles.forEach(f => console.log(`  • ${path.basename(path.dirname(f))}/${path.basename(f)}`));

      // Mark as processed
      await this.progressTracker.markProcessed(
        file.path,
        file.name,
        'split',
        savedFiles
      );

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
