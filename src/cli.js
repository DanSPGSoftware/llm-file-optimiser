import prompts from 'prompts';
import chalk from 'chalk';
import { diffLines } from 'diff';

/**
 * Interactive CLI for file approval workflow
 */
export class CLI {
  constructor() {
    this.approvedCount = 0;
    this.rejectedCount = 0;
    this.splitCount = 0;
  }

  /**
   * Display welcome message
   */
  displayWelcome(totalFiles, progressStats = null) {
    console.clear();
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║   SharePoint File Optimizer for Copilot Studio        ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.gray(`Found ${chalk.white.bold(totalFiles)} file(s) to process\n`));

    // Display previous progress if exists
    if (progressStats && progressStats.totalProcessed > 0) {
      console.log(chalk.yellow('📊 Previous Progress Found:'));
      console.log(chalk.gray(`  • Processed: ${progressStats.totalProcessed} files`));
      console.log(chalk.green(`  • Approved: ${progressStats.approved}`));
      console.log(chalk.red(`  • Rejected: ${progressStats.rejected}`));
      console.log(chalk.magenta(`  • Split: ${progressStats.split}`));
      if (progressStats.lastRunDate) {
        const lastRun = new Date(progressStats.lastRunDate).toLocaleString();
        console.log(chalk.gray(`  • Last run: ${lastRun}`));
      }
      console.log(chalk.cyan('\n  ℹ Only unprocessed files will be shown.\n'));
    }
  }

  /**
   * Display resume/reset prompt
   */
  async promptResumeOrReset() {
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'Previous progress detected. What would you like to do?',
      choices: [
        { title: chalk.green('[c] Continue - Skip already processed files'), value: 'continue' },
        { title: chalk.yellow('[r] Reset - Start fresh and reprocess all files'), value: 'reset' },
        { title: chalk.blue('[v] View - See list of processed files'), value: 'view' },
        { title: chalk.red('[x] Exit'), value: 'exit' }
      ],
      initial: 0
    });

    return response.action;
  }

  /**
   * Display list of processed files
   */
  displayProcessedFiles(processedFiles) {
    console.clear();
    console.log(chalk.cyan.bold('\n=== Processed Files ===\n'));

    if (processedFiles.length === 0) {
      console.log(chalk.gray('No files have been processed yet.\n'));
      return;
    }

    processedFiles.forEach((file, index) => {
      const statusColor = file.action === 'approved' ? chalk.green :
                         file.action === 'rejected' ? chalk.red :
                         chalk.magenta;
      const statusSymbol = file.action === 'approved' ? '✓' :
                          file.action === 'rejected' ? '✗' :
                          '✂';

      console.log(`${index + 1}. ${statusColor(statusSymbol)} ${chalk.white(file.name)}`);
      console.log(chalk.gray(`   Action: ${file.action}`));
      console.log(chalk.gray(`   Date: ${new Date(file.processedAt).toLocaleString()}`));

      if (file.outputFiles && file.outputFiles.length > 0) {
        console.log(chalk.gray(`   Output: ${file.outputFiles.length} file(s)`));
      }
      console.log('');
    });

    console.log(chalk.gray(`Total: ${processedFiles.length} files processed\n`));
  }

  /**
   * Display file processing header
   */
  displayFileHeader(fileName, currentIndex, totalFiles, fileInfo) {
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan.bold(`Processing: ${fileName}`));
    console.log(chalk.gray(`File ${currentIndex} of ${totalFiles}`));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.gray(`Original: ${fileInfo.wordCount} words, ~${fileInfo.pageEstimate} pages`));
  }

  /**
   * Display optimization results
   */
  displayOptimizationResults(optimizedInfo, validationResult) {
    console.log(chalk.gray(`Optimized: ${optimizedInfo.wordCount} words, ~${optimizedInfo.pageEstimate} pages`));

    const reductionPercent = ((optimizedInfo.wordCount - optimizedInfo.originalWordCount) / optimizedInfo.originalWordCount * 100).toFixed(1);
    const reductionColor = Math.abs(reductionPercent) > 20 ? chalk.yellow : chalk.green;

    console.log(reductionColor(`Change: ${reductionPercent > 0 ? '+' : ''}${reductionPercent}% word count`));

    // Validation results
    console.log('');
    if (validationResult.accurate) {
      console.log(chalk.green('✓ Accuracy check passed'));
    } else {
      console.log(chalk.red('✗ Accuracy check failed'));
    }

    if (validationResult.concerns.length > 0) {
      console.log(chalk.yellow('\nConcerns:'));
      validationResult.concerns.forEach(concern => {
        console.log(chalk.yellow(`  • ${concern}`));
      });
    }

    if (validationResult.missingInfo.length > 0) {
      console.log(chalk.red('\nPotentially missing information:'));
      validationResult.missingInfo.forEach(info => {
        console.log(chalk.red(`  • ${info}`));
      });
    }

    console.log(chalk.gray(`\nAssessment: ${validationResult.summary}`));
  }

  /**
   * Display content preview
   */
  displayPreview(content, maxChars = 500) {
    console.log(chalk.white('\n--- Preview (first 500 characters) ---'));
    const preview = content.substring(0, maxChars);
    console.log(chalk.gray(preview));
    if (content.length > maxChars) {
      console.log(chalk.gray('...'));
    }
  }

  /**
   * Display full comparison
   */
  displayComparison(originalContent, optimizedContent) {
    console.clear();
    console.log(chalk.cyan.bold('\n=== Content Comparison ===\n'));

    const diff = diffLines(originalContent, optimizedContent);
    const maxLines = 100; // Limit display to prevent overwhelming output
    let lineCount = 0;

    for (const part of diff) {
      if (lineCount >= maxLines) {
        console.log(chalk.gray(`\n... (${diff.length - lineCount} more changes not shown)`));
        break;
      }

      const lines = part.value.split('\n').slice(0, maxLines - lineCount);
      lineCount += lines.length;

      if (part.added) {
        lines.forEach(line => {
          if (line.trim()) console.log(chalk.green('+ ' + line));
        });
      } else if (part.removed) {
        lines.forEach(line => {
          if (line.trim()) console.log(chalk.red('- ' + line));
        });
      } else {
        lines.forEach(line => {
          if (line.trim()) console.log(chalk.gray('  ' + line));
        });
      }
    }

    console.log(chalk.gray('\n(Press Enter to continue)'));
  }

  /**
   * Prompt for main action
   */
  async promptMainAction(canSplit = false) {
    const choices = [
      { title: chalk.green('[a] Approve and save'), value: 'approve' },
      { title: chalk.red('[r] Reject and skip'), value: 'reject' },
      { title: chalk.blue('[v] View full comparison'), value: 'view' },
      { title: chalk.yellow('[e] Edit prompt and retry'), value: 'edit' }
    ];

    if (canSplit) {
      choices.push({ title: chalk.magenta('[s] Split into topic files'), value: 'split' });
    }

    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      initial: 0
    });

    return response.action;
  }

  /**
   * Prompt for custom optimization prompt
   */
  async promptCustomPrompt(defaultPrompt) {
    console.log(chalk.yellow('\nCurrent optimization prompt:'));
    console.log(chalk.gray(defaultPrompt.substring(0, 200) + '...\n'));

    const response = await prompts({
      type: 'text',
      name: 'prompt',
      message: 'Enter custom optimization instructions (or press Enter to use default):',
      initial: ''
    });

    return response.prompt || defaultPrompt;
  }

  /**
   * Display topic split suggestions
   */
  displayTopicSuggestions(topics) {
    console.log(chalk.cyan.bold('\n=== Suggested Topic Split ===\n'));

    topics.forEach((topic, index) => {
      console.log(chalk.white.bold(`${index + 1}. ${topic.topicName}`));
      console.log(chalk.gray(`   ${topic.description}`));
      console.log(chalk.gray(`   Estimated: ${topic.estimatedWords} words`));
      console.log(chalk.gray(`   Suggested split: ${topic.shouldSplit ? chalk.green('Yes') : chalk.yellow('No')}`));
      console.log('');
    });
  }

  /**
   * Prompt for topic split confirmation
   */
  async promptTopicSplitConfirmation(topics) {
    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Split this document into ${topics.length} separate files?`,
      initial: true
    });

    return response.confirm;
  }

  /**
   * Display progress
   */
  displayProgress() {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.white(`Progress: ${chalk.green(this.approvedCount)} approved, ${chalk.red(this.rejectedCount)} rejected, ${chalk.magenta(this.splitCount)} split`));
  }

  /**
   * Display completion summary
   */
  displayCompletionSummary(outputDir) {
    console.log(chalk.green.bold('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║              Processing Complete!                      ║'));
    console.log(chalk.green.bold('╚════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.white('Summary:'));
    console.log(chalk.green(`  ✓ Approved: ${this.approvedCount}`));
    console.log(chalk.red(`  ✗ Rejected: ${this.rejectedCount}`));
    console.log(chalk.magenta(`  ✂ Split: ${this.splitCount}`));
    console.log(chalk.gray(`\nOptimized files saved to: ${outputDir}\n`));
  }

  /**
   * Display error
   */
  displayError(message) {
    console.log(chalk.red.bold('\n✗ Error: ') + chalk.red(message));
  }

  /**
   * Display processing message
   */
  displayProcessing(message) {
    console.log(chalk.yellow(`\n⏳ ${message}...`));
  }

  /**
   * Wait for user to press Enter
   */
  async waitForEnter() {
    await prompts({
      type: 'text',
      name: 'continue',
      message: 'Press Enter to continue',
      initial: ''
    });
  }

  /**
   * Confirm continue or exit
   */
  async confirmContinue() {
    const response = await prompts({
      type: 'confirm',
      name: 'continue',
      message: 'Continue processing files?',
      initial: true
    });

    return response.continue;
  }
}
