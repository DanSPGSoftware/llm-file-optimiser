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
 * Main orchestrator for file optimization
 */
class FileOptimizer {
  constructor() {
    this.extractor = new FileExtractor();
    this.claudeClient = null;
    this.writer = new FileWriter();
    this.cli = new CLI();
    this.progressTracker = new ProgressTracker('./progress.json');

    this.inputFolder = process.env.INPUT_FOLDER || './input-files';
    this.outputFolder = process.env.OUTPUT_FOLDER || './output-files';
    this.maxPagesBeforeSplit = parseInt(process.env.MAX_PAGES_BEFORE_SPLIT || '10');
  }

  /**
   * Initialize the optimizer
   */
  async initialize() {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in .env file. Please add your Claude API key.');
    }

    this.claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);

    // Resolve paths
    this.inputFolder = path.resolve(this.inputFolder);
    this.outputFolder = path.resolve(this.outputFolder);
  }

  /**
   * Process all files in the input folder
   */
  async processFiles() {
    try {
      await this.initialize();

      // Load progress
      await this.progressTracker.load();
      const progressStats = this.progressTracker.getStats();

      // Scan for files
      this.cli.displayProcessing('Scanning input folder');
      const allFiles = await this.extractor.scanDirectory(this.inputFolder);

      if (allFiles.length === 0) {
        console.log('\nNo files found in input folder. Please add .docx or .pdf files to:');
        console.log(this.inputFolder);
        return;
      }

      // Check if we have previous progress
      let filesToProcess = allFiles;

      if (progressStats.totalProcessed > 0) {
        // Show progress and ask what to do
        this.cli.displayWelcome(allFiles.length, progressStats);

        let action = await this.cli.promptResumeOrReset();

        while (action === 'view') {
          this.cli.displayProcessedFiles(this.progressTracker.getProcessedFiles());
          await this.cli.waitForEnter();
          this.cli.displayWelcome(allFiles.length, progressStats);
          action = await this.cli.promptResumeOrReset();
        }

        if (action === 'reset') {
          await this.progressTracker.reset();
          console.log('\n✓ Progress reset. Starting fresh...\n');
          filesToProcess = allFiles;
        } else if (action === 'exit') {
          console.log('\nExiting...');
          return;
        } else {
          // Continue - filter out processed files
          filesToProcess = this.progressTracker.filterUnprocessedFiles(allFiles);
          console.log(`\n✓ Resuming... ${filesToProcess.length} unprocessed files remaining.\n`);
        }
      } else {
        this.cli.displayWelcome(filesToProcess.length);
      }

      if (filesToProcess.length === 0) {
        console.log('\n✓ All files have been processed! Check output-files/ for results.\n');
        return;
      }

      // Process each file
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const shouldContinue = await this.processFile(file, i + 1, filesToProcess.length);

        if (!shouldContinue) {
          console.log('\nProcessing cancelled by user.');
          console.log('Progress has been saved. Run again to continue.\n');
          break;
        }

        this.cli.displayProgress();
      }

      this.cli.displayCompletionSummary(this.outputFolder);
    } catch (error) {
      this.cli.displayError(error.message);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Process a single file
   */
  async processFile(file, currentIndex, totalFiles) {
    try {
      // Extract content
      this.cli.displayFileHeader(file.name, currentIndex, totalFiles, {});
      this.cli.displayProcessing('Extracting content');

      const extractedContent = await this.extractor.extractContent(file.path);

      this.cli.displayFileHeader(file.name, currentIndex, totalFiles, extractedContent);

      // Check if file is large enough to consider splitting
      const canSplit = extractedContent.pageEstimate >= this.maxPagesBeforeSplit;

      // Optimization loop (allows retry with different prompts)
      let optimizedContent = null;
      let validationResult = null;
      let customPrompt = null;

      while (true) {
        // Optimize content
        this.cli.displayProcessing('Optimizing content with Claude AI');
        optimizedContent = await this.claudeClient.optimizeContent(
          extractedContent.text,
          customPrompt
        );

        // Validate accuracy
        this.cli.displayProcessing('Validating accuracy');
        validationResult = await this.claudeClient.validateAccuracy(
          extractedContent.text,
          optimizedContent
        );

        // Calculate optimized info
        const optimizedInfo = {
          wordCount: this.extractor.countWords(optimizedContent),
          pageEstimate: Math.ceil(this.extractor.countWords(optimizedContent) / 500),
          originalWordCount: extractedContent.wordCount
        };

        // Display results
        this.cli.displayOptimizationResults(optimizedInfo, validationResult);
        this.cli.displayPreview(optimizedContent);

        // Get user action
        const action = await this.cli.promptMainAction(canSplit);

        if (action === 'approve') {
          // Generate summary and save
          this.cli.displayProcessing('Generating summary');
          const summary = await this.claudeClient.generateSummary(optimizedContent);

          this.cli.displayProcessing('Saving optimized file');
          const savedPath = await this.writer.saveOptimizedContent(
            file.path,
            optimizedContent,
            summary,
            this.outputFolder
          );

          console.log(`\n✓ Saved: ${path.basename(savedPath)}`);
          this.cli.approvedCount++;

          // Mark as processed
          await this.progressTracker.markProcessed(
            file.path,
            file.name,
            'approved',
            [savedPath]
          );

          return true;

        } else if (action === 'reject') {
          console.log('\n✗ File rejected, skipping...');
          this.cli.rejectedCount++;

          // Mark as processed (rejected)
          await this.progressTracker.markProcessed(
            file.path,
            file.name,
            'rejected',
            []
          );

          return true;

        } else if (action === 'view') {
          // Show full comparison
          this.cli.displayComparison(extractedContent.text, optimizedContent);
          await this.cli.waitForEnter();
          console.clear();
          this.cli.displayFileHeader(file.name, currentIndex, totalFiles, extractedContent);
          this.cli.displayOptimizationResults(optimizedInfo, validationResult);
          this.cli.displayPreview(optimizedContent);
          continue;

        } else if (action === 'edit') {
          // Get custom prompt and retry
          customPrompt = await this.cli.promptCustomPrompt(
            this.claudeClient.getDefaultOptimizationPrompt()
          );
          console.log('\n⟳ Retrying with custom prompt...');
          continue;

        } else if (action === 'split') {
          // Analyze and split into topics
          await this.handleFileSplit(file, extractedContent);
          return true;

        } else {
          // User cancelled
          return false;
        }
      }
    } catch (error) {
      this.cli.displayError(`Failed to process ${file.name}: ${error.message}`);
      console.error(error);

      const shouldContinue = await this.cli.confirmContinue();
      return shouldContinue;
    }
  }

  /**
   * Handle file splitting into topics
   */
  async handleFileSplit(file, extractedContent) {
    try {
      this.cli.displayProcessing('Analyzing document topics');
      const topics = await this.claudeClient.analyzeTopics(extractedContent.text);

      if (topics.length <= 1) {
        console.log('\n⚠ Document appears to be a single topic. Split not recommended.');
        return;
      }

      this.cli.displayTopicSuggestions(topics);

      const confirmed = await this.cli.promptTopicSplitConfirmation(topics);

      if (!confirmed) {
        console.log('\n✗ Split cancelled.');
        return;
      }

      this.cli.displayProcessing(`Optimizing ${topics.length} topic files`);

      // Split content by topics and optimize each
      const optimizedContents = [];

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        console.log(`\n  Processing topic ${i + 1}/${topics.length}: ${topic.topicName}`);

        // Extract topic content based on markers
        const topicContent = this.extractTopicContent(
          extractedContent.text,
          topic.startMarker,
          topic.endMarker
        );

        // Optimize this topic
        const optimized = await this.claudeClient.optimizeContent(topicContent);
        optimizedContents.push(optimized);
      }

      // Save split files
      this.cli.displayProcessing('Saving split files');
      const savedFiles = await this.writer.saveSplitFiles(
        file.path,
        topics,
        optimizedContents,
        this.outputFolder
      );

      console.log(`\n✓ Created ${savedFiles.length} split files:`);
      savedFiles.forEach(f => console.log(`  • ${path.basename(f)}`));

      this.cli.splitCount++;

      // Mark as processed (split)
      await this.progressTracker.markProcessed(
        file.path,
        file.name,
        'split',
        savedFiles
      );
    } catch (error) {
      this.cli.displayError(`Failed to split file: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Extract content between markers
   */
  extractTopicContent(fullContent, startMarker, endMarker) {
    const startIndex = fullContent.indexOf(startMarker);
    const endIndex = fullContent.indexOf(endMarker, startIndex);

    if (startIndex === -1 || endIndex === -1) {
      // Markers not found, return full content
      return fullContent;
    }

    return fullContent.substring(startIndex, endIndex + endMarker.length);
  }
}

// Run the optimizer
const optimizer = new FileOptimizer();
optimizer.processFiles();
