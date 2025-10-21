import fs from 'fs/promises';
import path from 'path';

/**
 * Track processing progress across sessions
 */
export class ProgressTracker {
  constructor(progressFilePath = './progress.json') {
    this.progressFilePath = progressFilePath;
    this.progress = {
      processedFiles: [],
      lastRunDate: null,
      totalProcessed: 0,
      stats: {
        approved: 0,
        rejected: 0,
        split: 0
      }
    };
  }

  /**
   * Load existing progress
   */
  async load() {
    try {
      const data = await fs.readFile(this.progressFilePath, 'utf-8');
      this.progress = JSON.parse(data);
      return this.progress;
    } catch (error) {
      // No progress file exists yet, start fresh
      return this.progress;
    }
  }

  /**
   * Save current progress
   */
  async save() {
    try {
      await fs.writeFile(
        this.progressFilePath,
        JSON.stringify(this.progress, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save progress:', error.message);
    }
  }

  /**
   * Check if a file has been processed
   */
  isProcessed(filePath) {
    return this.progress.processedFiles.some(f => f.path === filePath);
  }

  /**
   * Mark a file as processed
   */
  async markProcessed(filePath, fileName, action, outputFiles = []) {
    const record = {
      path: filePath,
      name: fileName,
      action, // 'approved', 'rejected', 'split'
      processedAt: new Date().toISOString(),
      outputFiles
    };

    // Remove if already exists (in case of reprocessing)
    this.progress.processedFiles = this.progress.processedFiles.filter(
      f => f.path !== filePath
    );

    this.progress.processedFiles.push(record);
    this.progress.totalProcessed = this.progress.processedFiles.length;
    this.progress.lastRunDate = new Date().toISOString();

    // Update stats
    if (action === 'approved') {
      this.progress.stats.approved++;
    } else if (action === 'rejected') {
      this.progress.stats.rejected++;
    } else if (action === 'split') {
      this.progress.stats.split++;
    }

    await this.save();
  }

  /**
   * Get list of unprocessed files
   */
  filterUnprocessedFiles(allFiles) {
    return allFiles.filter(file => !this.isProcessed(file.path));
  }

  /**
   * Get list of processed files
   */
  getProcessedFiles() {
    return this.progress.processedFiles;
  }

  /**
   * Get progress statistics
   */
  getStats() {
    return {
      totalProcessed: this.progress.totalProcessed,
      approved: this.progress.stats.approved,
      rejected: this.progress.stats.rejected,
      split: this.progress.stats.split,
      lastRunDate: this.progress.lastRunDate
    };
  }

  /**
   * Reset progress (start fresh)
   */
  async reset() {
    this.progress = {
      processedFiles: [],
      lastRunDate: null,
      totalProcessed: 0,
      stats: {
        approved: 0,
        rejected: 0,
        split: 0
      }
    };

    await this.save();
  }

  /**
   * Remove a specific file from processed list (to reprocess it)
   */
  async unmarkFile(filePath) {
    const file = this.progress.processedFiles.find(f => f.path === filePath);

    if (file) {
      // Update stats
      if (file.action === 'approved') {
        this.progress.stats.approved--;
      } else if (file.action === 'rejected') {
        this.progress.stats.rejected--;
      } else if (file.action === 'split') {
        this.progress.stats.split--;
      }

      this.progress.processedFiles = this.progress.processedFiles.filter(
        f => f.path !== filePath
      );

      this.progress.totalProcessed = this.progress.processedFiles.length;
      await this.save();
      return true;
    }

    return false;
  }

  /**
   * Get processed file record
   */
  getFileRecord(filePath) {
    return this.progress.processedFiles.find(f => f.path === filePath);
  }
}
