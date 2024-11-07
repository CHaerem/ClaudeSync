# Claude Project Updater

A Chrome extension that syncs your Claude.ai projects with public GitHub repositories. Simply add a GitHub repo URL to your project description, and sync files with a single click.

## Installation

1. Download this repo
2. Open Chrome -> `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" -> select extension folder

## Usage

1. Add a GitHub URL to your Claude project description
2. A sync button will appear above the description
3. Click to sync files

## File Filtering

You can control which files to sync using two optional configuration files in your repo:

### include_claudsync
Create this file to **only** sync specific files/folders:
```
src/            # includes everything in src/ folder
docs/README.md  # includes specific file
```

### exclude_claudsync
Create this file to exclude specific files/folders:
```
node_modules/   # excludes an entire folder
.env            # excludes a specific file
```

### Notes:
- If include_claudsync exists, ONLY listed files/folders will be synced
- exclude_claudsync filters are applied after include rules
- Folders must end with a forward slash (/)
- Lines starting with # are comments

## Limitations

- Works only with public GitHub repositories
- Some file types may not be supported by Claude
- Large files (>1MB) may fail to sync

## Development

Clone the repo and load the extension in Developer mode to make your own modifications.

## License

[MIT License](LICENSE)