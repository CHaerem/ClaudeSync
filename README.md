# Claude Project Updater

Claude Project Updater is a Chrome extension that allows you to synchronize your Claude.ai projects with GitHub repositories.

## Features

- Automatically detects GitHub URLs in Claude.ai project descriptions
- Adds a sync button to Claude.ai project pages
- Synchronizes files between Claude.ai projects and GitHub repositories
- Handles file additions, updates, and deletions

## Installation

1. Clone this repository or download the ZIP file and extract it.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory containing the extension files.

## Usage

1. Navigate to a Claude.ai project page.
2. If the project description contains a valid GitHub URL, a sync button will appear above the project description. (may need to refresh page manually)
3. Click the sync button to update your Claude.ai project with the latest files from the linked GitHub repository.

## Development

### Prerequisites

- Google Chrome browser
- Basic knowledge of JavaScript and Chrome extension development

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/chaerem/claude-project-updater.git
   ```
2. Navigate to the project directory:
   ```
   cd claude-project-updater
   ```
3. Make your changes to the source code.
4. Load the extension in Chrome as described in the Installation section.

## License

[MIT License](LICENSE)

## Credits

Icon downloaded from [iconscout](https://iconscout.com/free-icon/sync-1780790)
