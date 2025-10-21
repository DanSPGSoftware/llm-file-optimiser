# Pre-Flight Checklist

Before running the optimizer, make sure you've completed these steps:

## ✅ Setup Steps

- [ ] **Get Claude API Key**
  - Go to https://console.anthropic.com/
  - Sign in or create account
  - Create new API key
  - Copy the key (starts with `sk-ant-`)

- [ ] **Configure .env File**
  - Open `.env` in this folder
  - Replace `your_claude_api_key_here` with your actual key
  - Save the file

- [ ] **Download SharePoint Files**
  - Download all documents you want to optimize
  - Keep them in a temporary folder first

- [ ] **Copy Files to Input Folder**
  - Copy files to `input-files/` folder
  - Supported: .docx, .pdf, .txt, .md
  - Can process up to 30 files

## 🚀 Ready to Run

Once all above items are checked:

```bash
cd /Users/danielrichards/Desktop/Development/Projects/arvato
npm run optimize
```

## 📝 During Processing

For each file, you'll:
- See file info and optimization preview
- Review accuracy validation
- Choose to approve, reject, view comparison, or edit prompt
- Optionally split large documents

## ✅ After Processing

- [ ] Review optimized files in `output-files/`
- [ ] Check that summaries are appropriate
- [ ] Verify formatting looks good
- [ ] Upload to SharePoint
- [ ] (Optional) Verify metadata in SharePoint

## 💡 Tips

- Start with 2-3 files first to test
- Review the comparison view for important docs
- Use custom prompts if default doesn't fit your style
- Large docs (10+ pages) will suggest splitting
- All files are saved locally before upload

## ⚠️ Important Notes

- **No information will be lost** - accuracy is validated
- **You review each file** - nothing is auto-uploaded
- **Can retry anytime** - reject and process again
- **Original files untouched** - input-files/ stays the same

---

**Ready?** Check all boxes above and run `npm run optimize`!
