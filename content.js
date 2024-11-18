console.log("[Content] Content script loading...");

function extractGithubUrl() {
	console.log("[Content] Extracting GitHub URL");
	const githubUrlRegex = /https:\/\/github\.com\/[\w-]+\/[\w-]+/;
	const descriptionElements = document.querySelectorAll(
		'div[class*="description"], div[class*="text"], p'
	);

	for (const element of descriptionElements) {
		const match = element.textContent.match(githubUrlRegex);
		if (match) {
			console.log("[Content] GitHub URL found:", match[0]);
			return match[0];
		}
	}

	console.log("[Content] No GitHub URL found");
	return null;
}

function createSyncButton() {
    console.log("[Content] Creating sync button");
    const button = document.createElement("button");
    
    try {
        const iconUrl = chrome.runtime.getURL("icon.svg");
        button.innerHTML = `
            <img src="${iconUrl}" alt="Sync" class="sync-icon" width="16" height="16">
            <span>Sync</span>
        `;
    } catch (error) {
        console.error("[Content] Error setting button innerHTML:", error);
        button.textContent = "Sync"; // Fallback to text-only button
    }
    
    button.id = "github-sync-button";
    button.className = `
        inline-flex items-center justify-center
        text-text-300 hover:text-text-100
        px-2 py-1 rounded-lg hover:bg-bg-400/50 transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-accent-main-100 focus:ring-offset-2
        text-sm font-medium gap-1
    `;
    button.title = "Sync with GitHub";
    
    try {
        button.addEventListener("click", updateProject);
    } catch (error) {
        console.error("[Content] Error adding click event listener:", error);
    }
    
    console.log("[Content] Sync button created successfully");
    return button;
}

function addSyncButton() {
	console.log("[Content] Adding sync button");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) return;

	const descriptionElement = document.querySelector(
		".text-text-300.text-sm.leading-relaxed.line-clamp-2"
	);
	if (descriptionElement) {
		const button = createSyncButton();
		descriptionElement.parentNode.insertBefore(button, descriptionElement);
		console.log("[Content] Sync button added");
	} else {
		console.log("[Content] Description element not found, sync button not added");
	}
}

function checkForGithubUrl() {
	console.log("[Content] Checking for GitHub URL");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) return true;

	const url = extractGithubUrl();
	if (url) {
		addSyncButton();
		return true;
	}
	return false;
}

function getFileInputElement() {
	console.log("[Content] Getting file input element");
	const fileInputElement = document.querySelector(
		'input[data-testid="project-doc-upload"]'
	);
	if (!fileInputElement) {
		console.error("[Content] File input element not found");
		throw new Error("Could not find file input element for uploading files.");
	}
	return fileInputElement;
}

function isFileTypeAllowed(fileName) {
	console.log("[Content] Checking if file type is allowed:", fileName);
	const fileInputElement = getFileInputElement();
	const allowedExtensions = fileInputElement.accept.split(",");
	const fileExtension = "." + fileName.split(".").pop().toLowerCase();
	return allowedExtensions.includes(fileExtension);
}

async function uploadFileDirectly(fileContent, fileName) {
	console.log("[Content] Uploading file directly:", fileName);
	if (!isFileTypeAllowed(fileName)) {
		console.log("[Content] File type not allowed, skipping:", fileName);
		return;
	}

	const fileInputElement = getFileInputElement();
	const file = new File([fileContent], fileName, { type: "text/plain" });
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	fileInputElement.files = dataTransfer.files;
	const event = new Event("change", { bubbles: true });
	fileInputElement.dispatchEvent(event);

	await new Promise((resolve) => setTimeout(resolve, 500));
	console.log("[Content] File uploaded:", fileName);
}

function getClaudeFiles() {
    console.log("[Content] Getting Claude files");
    const fileElements = document.querySelectorAll('ul.flex.flex-col.py-1 > li');
    console.log("[Content] Found " + fileElements.length + " file elements");
    
    const files = [];
    fileElements.forEach((el, index) => {
        const nameElement = el.querySelector('div[class^="mb-0.5 mt-1"]');
        const removeButton = el.querySelector('button[aria-label="Remove from project knowledge"]');
        
        console.log(`[Content] File ${index + 1}:`, 
                    nameElement ? nameElement.textContent.trim() : "Name not found", 
                    removeButton ? "Remove button found" : "Remove button not found");
        
        if (nameElement && removeButton) {
            files.push({
                name: nameElement.textContent.trim(),
                removeButton: removeButton,
            });
        }
    });

    console.log("[Content] Claude files found:", files);
    return files;
}

// [Previous content.js code remains the same until the isFileExcluded function]

function isFileExcluded(fileName, excludedItems, includedItems) {
    // If include list exists and is not empty, ONLY include files matching the patterns
    if (includedItems && includedItems.length > 0) {
        // Check if file matches any include pattern
        const isIncluded = includedItems.some(item => {
            if (item.endsWith('/')) {
                // It's a directory, include this file if it's in this directory or its subdirectories
                return fileName.startsWith(item);
            } else {
                // It's a file, check for exact match
                return fileName === item;
            }
        });
        // If file doesn't match any include pattern, treat it as excluded
        if (!isIncluded) {
            console.log(`[Content] File not in include list: ${fileName}`);
            return true;
        }
    }

    // Only check exclude patterns if file passed the include filter
    return excludedItems.some(item => {
        if (item.endsWith('/')) {
            return fileName.startsWith(item);
        } else {
            return fileName === item;
        }
    });
}

async function syncFiles(claudeFiles, githubFiles, excludedItems, includedItems) {
    console.log("[Content] Starting file synchronization...");
    console.log("[Content] Claude files:", claudeFiles);
    console.log("[Content] GitHub files:", githubFiles);
    console.log("[Content] Excluded items:", excludedItems);
    console.log("[Content] Included items:", includedItems);

    // Step 1: Remove all files from Claude
    console.log("[Content] Removing existing Claude files...");
    const removalPromises = claudeFiles.map((file) => removeFile(file));
    await Promise.all(removalPromises);

    // Step 2: Upload all files from GitHub, respecting include/exclude rules
    let uploadedCount = 0;
    let skippedCount = 0;
    let excludedCount = 0;
    let filteredCount = 0;

    for (const file of githubFiles) {
        if (isFileExcluded(file.name, excludedItems, includedItems)) {
            if (includedItems && includedItems.length > 0) {
                console.log(`[Content] File not in include list: ${file.name}`);
                filteredCount++;
            } else {
                console.log(`[Content] Excluding file: ${file.name}`);
                excludedCount++;
            }
            continue;
        }
        
        if (isFileTypeAllowed(file.name)) {
            console.log(`[Content] Uploading file: ${file.name}`);
            await uploadFileDirectly(file.content, file.name);
            uploadedCount++;
        } else {
            console.log(`[Content] Skipping file (type not allowed): ${file.name}`);
            skippedCount++;
        }
    }
    
    console.log(`[Content] Sync complete. Uploaded: ${uploadedCount}, Skipped: ${skippedCount}, Excluded: ${excludedCount}, Filtered: ${filteredCount}`);
}

// [Update the updateProject function to handle includedFiles]
async function updateProject() {
    console.log(`[Content] [${new Date().toISOString()}] Starting project update...`);
    const button = document.getElementById("github-sync-button");
    if (button) {
        button.disabled = true;
        button.querySelector(".sync-icon").classList.add("spinning");
    }

    try {
        const githubUrl = extractGithubUrl();
        if (!githubUrl) {
            console.error(`[Content] [${new Date().toISOString()}] No GitHub URL found in project description`);
            throw new Error("No GitHub URL found in project description");
        }
        console.log(`[Content] [${new Date().toISOString()}] Extracted GitHub URL:`, githubUrl);

        const claudeFiles = getClaudeFiles();
        console.log(`[Content] [${new Date().toISOString()}] Claude files:`, JSON.stringify(claudeFiles));

        console.log(`[Content] [${new Date().toISOString()}] Sending message to background script...`);
        chrome.runtime.sendMessage(
            { action: "fetchGitHub", repoUrl: githubUrl },
            async function (response) {
                try {
                    console.log(`[Content] [${new Date().toISOString()}] Received response from background script:`, response);
                    if (chrome.runtime.lastError) {
                        console.error(`[Content] [${new Date().toISOString()}] Runtime error:`, chrome.runtime.lastError);
                        throw new Error(chrome.runtime.lastError.message);
                    }
                    if (response && response.error) {
                        console.error(`[Content] [${new Date().toISOString()}] Error in response:`, response.error);
                        throw new Error(response.error);
                    }
                    if (!response || !response.files) {
                        console.error(`[Content] [${new Date().toISOString()}] Invalid response structure:`, response);
                        throw new Error("Invalid response from background script");
                    }

                    const githubFiles = response.files;
                    const excludedFiles = response.excludedFiles || [];
                    const includedFiles = response.includedFiles || [];
                    console.log(`[Content] [${new Date().toISOString()}] Fetched ${githubFiles.length} files from GitHub`);
                    console.log(`[Content] [${new Date().toISOString()}] Excluded files: ${excludedFiles.join(', ')}`);
                    console.log(`[Content] [${new Date().toISOString()}] Included files: ${includedFiles.join(', ')}`);

                    await syncFiles(claudeFiles, githubFiles, excludedFiles, includedFiles);
                    console.log(`[Content] [${new Date().toISOString()}] Project successfully synced with GitHub`);
                    alert("Project successfully synced with GitHub!");
                } catch (error) {
                    console.error(`[Content] [${new Date().toISOString()}] Error processing GitHub files:`, error);
                    alert("Error processing GitHub files: " + error.message);
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.querySelector(".sync-icon").classList.remove("spinning");
                    }
                }
            }
        );
    } catch (error) {
        console.error(`[Content] [${new Date().toISOString()}] Error updating project:`, error);
        alert("Error updating project: " + error.message);
        if (button) {
            button.disabled = false;
            button.querySelector(".sync-icon").classList.remove("spinning");
        }
    }
}

async function removeFile(file) {
    console.log("[Content] Removing file:", file.name);
    return new Promise((resolve) => {
        if (file.removeButton) {
            file.removeButton.click();
            setTimeout(resolve, 1000); // Wait for 1 second after clicking to ensure the file is removed
        } else {
            resolve();
        }
    });
}

function handlePageChange() {
	console.log("[Content] Handling page change");
	if (window.location.href.includes("/project/")) {
		initializeExtension();
	} else {
		removeSyncButton();
	}
}

function removeSyncButton() {
	console.log("[Content] Removing sync button");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		existingButton.remove();
		console.log("[Content] Sync button removed");
	} else {
		console.log("[Content] Sync button not found, nothing to remove");
	}
}

function initializeExtension() {
	console.log("[Content] Initializing extension");
	if (!checkForGithubUrl()) {
		console.log("[Content] GitHub URL not found, starting observer");
		startObserver();
	} else {
		console.log("[Content] GitHub URL found, extension initialized");
	}
}

function startObserver() {
	console.log("[Content] Starting MutationObserver");
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "childList" || mutation.type === "subtree") {
				if (checkForGithubUrl()) {
					console.log("[Content] GitHub URL found, disconnecting observer");
					observer.disconnect();
					return;
				}
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
	});

	setTimeout(() => {
		console.log("[Content] Observer timeout reached, disconnecting");
		observer.disconnect();
	}, 30000);
}

function setupHistoryChangeDetection() {
	console.log("[Content] Setting up history change detection");
	const pushState = history.pushState;
	history.pushState = function () {
		pushState.apply(history, arguments);
		handlePageChange();
	};

	const replaceState = history.replaceState;
	history.replaceState = function () {
		replaceState.apply(history, arguments);
		handlePageChange();
	};

	window.addEventListener("popstate", handlePageChange);
}

function setupContentChangeDetection() {
	console.log("[Content] Setting up content change detection");
	let timeout;
	const observer = new MutationObserver(() => {
		clearTimeout(timeout);
		timeout = setTimeout(handlePageChange, 500);
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});
}

// Add a style element for the spinning animation
const style = document.createElement("style");
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .spinning {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);

// Initialize the extension
console.log("[Content] Initializing Claude Project Updater");
setupHistoryChangeDetection();
setupContentChangeDetection();
handlePageChange();

console.log("[Content] Content script loaded and initialized");