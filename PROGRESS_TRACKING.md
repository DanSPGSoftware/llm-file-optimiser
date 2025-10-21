# Progress Tracking Guide

## Overview

The SharePoint File Optimizer automatically tracks your progress, allowing you to process files in manageable batches and resume anytime without losing your work.

## How It Works

### Automatic Saving

- Progress is saved **after each file** is processed
- No manual save required
- Works even if you stop mid-process (Ctrl+C)
- Stored in `progress.json` file

### What Gets Tracked

For each processed file, the system records:

- ✅ **File path and name**
- ✅ **Action taken**: Approved, Rejected, or Split
- ✅ **Output files created**: Full paths to optimized files
- ✅ **Timestamp**: When the file was processed
- ✅ **Statistics**: Running totals of approved/rejected/split files

## Using Progress Tracking

### First Run

When you run `npm run optimize` for the first time:

1. All files in `input-files/` are shown
2. You process them one by one
3. Progress saves automatically after each file
4. Stop anytime by:
   - Pressing Ctrl+C
   - Closing the terminal
   - Letting it complete naturally

### Resuming Processing

When you run `npm run optimize` again with existing progress:

```
📊 Previous Progress Found:
  • Processed: 8 files
  • Approved: 6
  • Rejected: 1
  • Split: 1
  • Last run: 10/20/2025, 3:45:23 PM

  ℹ Only unprocessed files will be shown.

Previous progress detected. What would you like to do?
> [c] Continue - Skip already processed files
  [r] Reset - Start fresh and reprocess all files
  [v] View - See list of processed files
  [x] Exit
```

### Options on Resume

#### [c] Continue (Recommended)
- Skips files you've already processed
- Shows only remaining unprocessed files
- Picks up where you left off
- **Use this for batch processing**

#### [r] Reset
- Clears all progress
- Starts fresh from the beginning
- All files shown again
- **Use if you want to reprocess everything**

#### [v] View
- Shows detailed list of processed files
- Displays action taken for each
- Shows when each was processed
- Returns to the menu (doesn't start processing)

#### [x] Exit
- Closes the tool without processing
- Progress remains saved

### Viewing Processed Files

When you select **[v] View**:

```
=== Processed Files ===

1. ✓ employee-handbook.docx
   Action: approved
   Date: 10/20/2025, 2:30:15 PM
   Output: 1 file(s)

2. ✗ old-policy.pdf
   Action: rejected
   Date: 10/20/2025, 2:35:42 PM

3. ✂ training-materials.docx
   Action: split
   Date: 10/20/2025, 2:45:18 PM
   Output: 3 file(s)

Total: 3 files processed
```

Legend:
- ✓ = Approved and saved
- ✗ = Rejected and skipped
- ✂ = Split into multiple files

## Batch Processing Workflow

### Recommended: Process in Small Batches

**Why?**
- Easier to review each file carefully
- Less mentally taxing
- Can take breaks between batches
- Progress saved automatically

**Example Workflow:**

**Monday Morning** (First 5 files)
```bash
npm run optimize
# Process 5 files, then Ctrl+C to stop
```

**Monday Afternoon** (Next 5 files)
```bash
npm run optimize
# Select [c] Continue
# Process 5 more files
```

**Tuesday** (Remaining files)
```bash
npm run optimize
# Select [c] Continue
# Finish the rest
```

### Tracking Your Progress

At any time, run:
```bash
npm run optimize
```

Select **[v] View** to see:
- What's been processed
- What's remaining
- What action was taken for each

Then select **[x] Exit** without processing.

## Progress File Details

### Location
`progress.json` in the project root

### Format
```json
{
  "processedFiles": [
    {
      "path": "/full/path/to/file.docx",
      "name": "file.docx",
      "action": "approved",
      "processedAt": "2025-10-20T14:30:15.123Z",
      "outputFiles": ["/full/path/to/output/file_optimized.docx"]
    }
  ],
  "lastRunDate": "2025-10-20T14:30:15.123Z",
  "totalProcessed": 8,
  "stats": {
    "approved": 6,
    "rejected": 1,
    "split": 1
  }
}
```

### Manual Management

**View progress file:**
```bash
cat progress.json
```

**Delete progress (start fresh):**
```bash
rm progress.json
```

**Backup progress:**
```bash
cp progress.json progress-backup.json
```

## Common Scenarios

### Scenario 1: Process 5 at a Time

```bash
# Day 1 - First 5 files
npm run optimize
# Stop after 5 files (Ctrl+C)

# Day 2 - Next 5 files
npm run optimize
# Select [c] Continue
# Stop after 5 more files

# Continue until done...
```

### Scenario 2: Accidentally Rejected a File

```bash
# Option 1: Reset all and reprocess
npm run optimize
# Select [r] Reset

# Option 2: Manually edit progress.json
# Remove the rejected file entry
# Run again to reprocess just that file
```

### Scenario 3: Want to Reprocess One File

1. Open `progress.json`
2. Find the file entry
3. Delete that entry
4. Save the file
5. Run `npm run optimize` and select [c] Continue
6. Only that file will show up again

### Scenario 4: See What's Left

```bash
npm run optimize
# Select [v] View
# Review the list
# Select [x] Exit
```

## Best Practices

1. **Process in batches of 5-10 files** - More manageable and focused
2. **Review the progress regularly** - Use [v] View option
3. **Keep progress.json safe** - Don't delete accidentally
4. **Backup before reset** - Copy progress.json before [r] Reset
5. **Stop anytime** - Progress is saved after each file

## Troubleshooting

### Progress Not Saving

- Check file permissions in project directory
- Make sure you have write access
- Look for `progress.json` file after processing one file

### Wrong Files Showing

- If files show as processed but shouldn't: Select [r] Reset
- If new files added to input-files/: Just run normally, they'll be shown

### Want Fresh Start

```bash
# Delete progress file
rm progress.json

# Or use the tool
npm run optimize
# Select [r] Reset
```

### Progress File Corrupted

```bash
# Delete and start fresh
rm progress.json
npm run optimize
```

## Summary

✅ **Automatic** - Saves after each file, no manual action
✅ **Flexible** - Continue, reset, or view anytime
✅ **Safe** - Never lose progress
✅ **Batch-friendly** - Process 5-10 at a time
✅ **Transparent** - View what's processed anytime

**Bottom line**: Process your 30 files at your own pace. Take breaks. Come back later. Progress is always saved.
