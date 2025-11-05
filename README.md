# SharePoint File Optimizer for Copilot Studio

Automated tool to optimize SharePoint documents for better topic separation and information retrieval in Microsoft Copilot Studio. Uses Claude AI to intelligently restructure and format documents while preserving all original content.

## Features

- **AI-Powered Optimization**: Restructures documents with clear headings, sections, and improved formatting
- **Accuracy Validation**: Automatically verifies that no information is lost during optimization
- **Interactive CLI**: Review and approve each optimized file before saving
- **Progress Tracking**: Resume processing from where you left off - process files in batches
- **Topic Splitting**: Automatically split large documents into separate topic-focused files
- **Metadata Embedding**: Adds summaries to document properties for better searchability
- **Multiple Format Support**: Handles Word documents (.docx) and PDFs (.pdf)
- **Flexible Export Options**: Export optimized files as .txt, .md, or .docx for maximum Copilot Studio compatibility

## Prerequisites

- Node.js 18+ installed
- Claude API key from [Anthropic Console](https://console.anthropic.com/)

## Installation

1. Navigate to the project directory:
```bash
cd /Users/danielrichards/Desktop/Development/Projects/arvato
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Claude API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Usage

### 1. Add Files to Process

Download your SharePoint files and place them in the `input-files` folder:

```bash
# The input-files folder is already created
# Just copy your .docx and .pdf files there
```

### 2. Choose Your Mode

**Option A: Full Optimization Mode** (optimize and optionally split)
```bash
npm run optimize
```

**Option B: Split-Only Mode** (batch split documents into topics)
```bash
npm run split
```

**Option C: Verify Mode** (check accuracy of optimized files)
```bash
npm run verify
```

> **Tip**: You can set a default export format in your `.env` file to skip the format selection:
```bash
EXPORT_FORMAT=txt  # Best for Copilot Studio
```

### 3. Interactive Workflow (Optimize Mode)

The tool processes files one at a time with full control:

**Step 1: File Preview**
- See file name, size, and type
- Decide whether to process or skip this file

**Step 2: Export Format Selection** (first file only)
- Choose output format: txt, md, docx, or original
- This format applies to all files in the session

**Step 3: Review Optimization**
For each file you choose to process, you'll see:
- **File information**: Original size, word count, page estimate
- **Optimization results**: Optimized content preview, word count changes
- **Accuracy check**: Validation that all information is preserved
- **Preview**: First 500 characters of optimized content

**Step 4: Choose Action**
- **[a] Approve and save** - Save the optimized file
- **[r] Reject and skip** - Skip this file without saving
- **[v] View full comparison** - See detailed side-by-side comparison
- **[e] Edit prompt and retry** - Customize optimization instructions
- **[s] Split into topics** - Split large documents into separate files (if applicable)

**Benefits:**
- Skip files you don't want to process
- Review each file before committing
- Take breaks at any point without losing progress

### 4. Progress Tracking

The tool automatically saves your progress after each file. If you need to stop:

- **Stop anytime**: Press Ctrl+C or choose to exit
- **Resume later**: Run `npm run optimize` again
- **Options on resume**:
  - **[c] Continue** - Skip already processed files
  - **[r] Reset** - Start fresh and reprocess all files
  - **[v] View** - See list of processed files
  - **[x] Exit** - Close without processing

Progress is saved in `progress.json` and tracks:
- Which files have been processed
- Action taken (approved/rejected/split)
- Output files created
- Processing statistics

### 5. Review Output

Optimized files are saved to the `output-files` folder with the naming pattern based on your chosen export format:
- `original-name_optimized.txt` (Plain text format)
- `original-name_optimized.md` (Markdown format)
- `original-name_optimized.docx` (Word document format)

### Split-Only Mode Workflow

Use this mode to interactively split large documents into topic-focused files:

**When to Use Split Mode:**
- You've already optimized files and now want to split them
- You have large documents that need to be divided into topics
- You want full control over which files to split with accuracy validation

**How It Works:**

1. **Place files in input folder** - Add the files you want to split
2. **Select export format** (first time only):
   - Choose output format: txt, md, or docx
   - This format applies to all files in the session
3. **Run split mode**:
   ```bash
   npm run split
   ```
4. **Interactive file selection**:
   - View list of all files with sizes
   - Select a file to split, or choose [Exit] to quit

5. **For each selected file**:
   - Extracts content and shows document stats (words, pages)
   - Warns if document is small (< 5 pages by default)
   - Analyzes document for distinct topics using Claude AI
   - Shows topic suggestions with descriptions
   - Asks for confirmation before splitting
   - Splits and optimizes each topic in parallel batches (3 at a time)
   - **Validates accuracy** of each split file
     - Shows which topics passed/failed accuracy check
     - All information from original must be preserved
   - **Checks for existing files** in OUTPUT_FOLDER
     - Shows which files will be replaced
   - **Asks for confirmation** before replacing existing files
   - Saves separate files for each topic in a subfolder
   - Asks if you want to **split another file**

6. **Output files**: Creates a subfolder for each split document:
   ```
   output-files/
     file-to-split/
       topic-1-name.txt
       topic-2-name.txt
       topic-3-name.txt
   ```

**Benefits:**
- Full control - choose which files to split
- Accuracy validation ensures no information loss
- Confirmation before replacing existing files
- Loop workflow - split multiple files in one session
- Exit anytime without losing completed work

**Configuration:**
```bash
MIN_PAGES_FOR_SPLIT=5  # Minimum pages before suggesting split
CONCURRENT_TOPIC_OPTIMIZATIONS=3  # Topics to process in parallel
EXPORT_FORMAT=txt  # Set default format to skip selection prompt
```

### Verify Mode Workflow

Use this mode to audit the **content accuracy** of previously optimized files:

**What It Checks:**
- ✓ All facts, data, numbers, dates, and names are preserved
- ✓ No substantive information was removed or omitted
- ✓ Semantic meaning and content completeness
- ✗ **Ignores formatting differences** (headings, bullets, markdown, spacing)

**When to Use Verify Mode:**
- After batch processing many files, to ensure no information loss
- To verify content completeness before uploading to SharePoint
- To re-optimize files that failed content accuracy checks
- Quality assurance focused on information preservation

**How It Works:**

1. **Place files in both folders:**
   - Raw originals in `INPUT_FOLDER` (e.g., `file.pdf`)
   - Optimized versions in `OUTPUT_FOLDER` (e.g., `file_optimized.txt`)
   - **Supports nested folders:**
     ```
     INPUT_FOLDER/
       Contact Centre/
         Annual Leave Policy.pdf

     OUTPUT_FOLDER/
       Contact Centre/
         Annual Leave Policy/    ← Split files folder
           leave-types.txt
           approval-process.txt
           emergency-leave.txt
     ```

2. **Run verify mode:**
   ```bash
   npm run verify
   ```

3. **Automatic file matching:**
   - **Recursively scans both directories** - handles nested folder structures
   - Matches optimized files with their raw originals using relative paths
   - Looks for `_optimized` suffix for single files
   - Detects split file folders (folder named after original file)
   - Works with files in subfolders (e.g., `Contact Centre/Policy.pdf`)
   - Shows all matched pairs with their folder paths before starting

4. **For each file pair:**
   - Shows file information
   - **Navigation options:**
     - **[v] Verify this file** - Check accuracy
     - **[s] Skip this file** - Move to next
     - **[b] Back to previous file** - Go back and re-verify
     - **[x] Exit verification** - Stop and show summary
   - If verifying:
     - Extracts content from raw file
     - For split files: combines all topic files into one
     - Runs Claude AI content accuracy validation (ignores formatting)
     - Checks if all information/facts are preserved
     - Reports: content accurate (✓/✗), missing information, concerns

5. **On accuracy failure:**
   - Shows options:
     - **[g] Re-optimize with GUIDED prompt** ⭐ (uses accuracy feedback to fix issues)
     - **[r] Re-optimize with default prompt** (standard re-optimization)
     - **[c] Re-optimize with custom prompt** (you write the prompt)
     - **[s] Skip and continue** (keep existing version)
   - **Asks for confirmation** before re-optimizing
   - Re-runs optimization and saves the new version
   - **Automatically re-verifies** the same file
   - **Loops until passes** or you choose to skip
   - Can retry multiple times with different approaches

6. **Summary report:**
   - Total passed, failed, re-optimized, and skipped counts
   - Re-optimized files are automatically saved
   - Clear visibility of which files need attention

**Example Output:**
```
📁 Raw files: 10
📁 Optimized items: 10 (7 files, 3 split folders)

File Pairs to Verify:
1. HR-Policy.pdf → HR-Policy_optimized.txt
2. Benefits-Guide.pdf → Benefits-Guide/ (5 split files)
3. Contact Centre/Annual Leave Policy.pdf → Contact Centre/Annual Leave Policy/ (3 split files)
4. Employee-Handbook.pdf → Employee-Handbook_optimized.txt

════════════════════════════════════════════════════════════
📄 File 1/10: HR-Policy.pdf
   Optimized: HR-Policy_optimized.txt
════════════════════════════════════════════════════════════
What would you like to do?
› [v] Verify this file
  [s] Skip this file
  [x] Exit verification

  Extracting raw content...
  Extracting optimized content...
  Running accuracy check...
  ✓ Accuracy check PASSED

════════════════════════════════════════════════════════════
📄 File 2/10: Contact Centre/Annual Leave Policy.pdf
   Optimized: Contact Centre/Annual Leave Policy/ (3 split files)
════════════════════════════════════════════════════════════
What would you like to do?
› [v] Verify this file
  [s] Skip this file
  [b] Back to previous file  ← Available from file 2 onwards
  [x] Exit verification

  Extracting raw content...
  Extracting optimized content...
  Combining 5 split files...
  Running accuracy check...
  ✗ Accuracy check FAILED
  Missing Information:
    • Contact information for benefits administrator
    • Emergency contact procedures

  What would you like to do?
  › [g] Re-optimize with GUIDED prompt (uses accuracy feedback to fix issues)
    [r] Re-optimize with default prompt (standard re-optimization)
    [c] Re-optimize with custom prompt (you write the prompt)
    [s] Skip and continue (keep existing version)

  Re-optimize using accuracy feedback to guide Claude? › yes
  ⟳ Re-optimizing file...
  Generating summary...
  Saving re-optimized file...
  ✓ File saved. Re-checking accuracy...

  🔄 Verification Attempt 2
  Extracting optimized content...
  Running accuracy check...
  ✓ Accuracy check PASSED
  ✓ File passed after 2 attempt(s)

Verification Complete
✓ Passed: 8
✗ Failed: 0
⟳ Re-optimized: 1
⏭ Skipped: 1
```

**Benefits:**
- **Full control**: Confirm before verifying each file
- **Navigate freely**: Go back to previous files if you want to re-verify
- **Handles nested folders**: Recursively scans subdirectories in both input and output folders
  - Perfect for organized folder structures (e.g., `HR/`, `Finance/`, `Contact Centre/`)
  - Matches files across folder hierarchies
- **Intelligent retry loop**: Re-verifies automatically after each re-optimization
- **Guided re-optimization** ⭐: Claude learns from accuracy failures
  - Uses missing information feedback to guide the next optimization
  - Tells Claude exactly what to include
  - Much higher success rate than blind re-optimization
- **Interactive workflow**: Explicit confirmation before each action
- **Content-focused validation**: Ignores formatting, only checks information completeness
- Ensures no information loss across all files
- Perfect for Copilot Studio integration - verifies content while allowing formatting changes
- Handles both single optimized files and split topic files
- Automatically combines split files for comprehensive verification
- Quality assurance before final delivery

### 6. Upload to SharePoint

1. Review the optimized files in the `output-files` folder
2. Manually upload them to your SharePoint library
3. For Word documents, the embedded metadata (Summary, Description, Comments) contains the document summary

## Configuration

Edit `config.json` to customize:

```json
{
  "optimization": {
    "maxPagesBeforeSplit": 10,        // Pages threshold for split suggestion
    "minWordsPerTopic": 500,          // Minimum words for a split topic
    "wordCountReductionThreshold": 0.20  // Alert if >20% content reduction
  }
}
```

Or use environment variables in `.env`:

```bash
# Export format: txt, md, docx, or original
EXPORT_FORMAT=txt

# Optimization thresholds
MAX_PAGES_BEFORE_SPLIT=10          # Pages before split option shown (optimize mode)
MIN_PAGES_FOR_SPLIT=5              # Minimum pages for split recommendation (split mode)
MIN_WORDS_PER_TOPIC=500            # Minimum words for a split topic
WORD_COUNT_REDUCTION_THRESHOLD=0.20 # Alert if >20% content reduction

# Performance settings
CONCURRENT_TOPIC_OPTIMIZATIONS=3   # Topics to optimize in parallel (3=Free tier, 5-10=Build, 10+=Scale)

# Folder paths
INPUT_FOLDER=./input-files
OUTPUT_FOLDER=./output-files
```

## How It Works

### Optimization Process

1. **Content Extraction**: Extracts text from Word/PDF files (including tables)
2. **AI Optimization**: Claude AI restructures the content for Copilot Studio:
   - Adds clear hierarchical headings (H1, H2, H3)
   - Organizes into logical sections
   - Improves readability with bullet points and formatting
   - Converts tables to formatted lists
   - Adds 2-3 sentence summary at the top
   - **Preserves ALL original information** (content unchanged, only formatting improved)
3. **Accuracy Validation**: Claude verifies no information was lost (ignores formatting changes)
4. **Summary Generation**: Creates concise summary for metadata
5. **File Creation**: Saves optimized file with embedded metadata

### File Splitting

For documents exceeding the page threshold:

1. Claude analyzes the document for distinct topics
2. Suggests split points with topic names and descriptions
3. User approves or rejects the split
4. Creates a subfolder named after the original document
5. Saves separate optimized files for each topic inside the subfolder
6. Each file gets its own summary and metadata

**Example Output Structure:**
```
output-files/
  HR-Policy-Manual/
    employee-benefits.txt
    leave-policies.txt
    code-of-conduct.txt
```

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

Make sure you've created a `.env` file (copy from `.env.example`) and added your API key.

### "No files found in input folder"

Check that:
- Files are in the `input-files` folder
- Files have supported extensions (.docx, .pdf, .txt, .md)
- Folder path is correct

### "Failed to extract content"

- For PDFs: Ensure the PDF contains text (not just images)
- For Word docs: Make sure the file isn't corrupted
- Try opening the file manually to verify it's readable

### Accuracy Check Failed

If Claude detects missing information:
- Use **[v] View comparison** to see what changed
- Use **[e] Edit prompt** to give more specific instructions
- Consider rejecting and manually reviewing the file

### Progress Not Saving / Want to Start Fresh

- Progress is automatically saved in `progress.json`
- To start fresh: Run the tool and select **[r] Reset** when prompted
- To manually clear: Delete `progress.json` file
- Progress tracks: file path, action taken, output files, and timestamps

### Processing Large Batches

- Process 5-10 files at a time for better manageability
- Stop anytime (Ctrl+C) - progress is saved after each file
- Resume by running `npm run optimize` again
- Use **[v] View** option to see what's already been processed

## Project Structure

```
arvato/
├── src/
│   ├── optimize-files.js    # Main optimization workflow
│   ├── split-files.js       # Split-only mode workflow
│   ├── verify-files.js      # Verify mode - accuracy checking
│   ├── fileExtractor.js     # Content extraction (Word, PDF) with table detection
│   ├── claudeClient.js      # Claude AI integration
│   ├── fileWriter.js        # File writing with metadata
│   ├── cli.js               # Interactive command-line interface
│   ├── progressTracker.js   # Progress tracking and resume
│   └── tableConverter.js    # Table detection and conversion
├── input-files/             # Place your files here
├── output-files/            # Optimized files appear here
├── progress.json            # Optimize mode progress (auto-generated)
├── config.json              # Configuration settings
├── .env                     # Environment variables (API key, settings)
└── package.json             # Node.js dependencies
```

## Tips for Best Results

1. **Review Accuracy**: Always check the accuracy validation results
2. **Use Comparison**: For important documents, view the full comparison
3. **Verify After Batch Processing**: Use **verify mode** (`npm run verify`) to audit all optimized files
   - Automatically checks accuracy of all optimized files
   - **Use guided re-optimization** for files that fail - it learns from the errors
   - Re-verifies automatically after each fix attempt
   - Perfect for quality assurance before delivery
4. **Custom Prompts**: If default optimization doesn't fit your needs, use custom prompts
5. **Split Large Docs**: Take advantage of topic splitting for better Copilot Studio retrieval
   - Use **split mode** (`npm run split`) for interactive file-by-file splitting
   - Includes accuracy validation before replacing existing files
   - Faster processing with parallel topic optimization (configurable batch size)
6. **Consistent Naming**: Keep original filenames consistent for easier tracking
7. **Process in Batches**: Don't try to do all 30 files at once - do 5-10, take a break, resume later
8. **Progress is Saved**: Don't worry about losing progress - every file is tracked automatically
9. **Performance Tuning**: Adjust `CONCURRENT_TOPIC_OPTIMIZATIONS` based on your Claude API tier
   - Free tier: Keep at 3
   - Build tier: Increase to 5-10 for faster splitting
   - Scale tier: Set to 10+ for maximum speed

## Next Steps

After optimization:

1. Upload optimized files to SharePoint
2. Ensure your SharePoint library has a "Description" column
3. For Word documents, the metadata should automatically populate (depending on SharePoint configuration)
4. For markdown files, you may need to manually copy the description from the frontmatter

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the accuracy validation messages
- Verify your Claude API key is valid and has credits

## License

MIT
