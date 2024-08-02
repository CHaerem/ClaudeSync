console.log("Claude Project Updater: Content script loaded");

function extractGithubUrl() {
	console.log("Attempting to extract GitHub URL");
	const githubUrlRegex = /https:\/\/github\.com\/[\w-]+\/[\w-]+/;
	let githubUrl = null;

	// Look for direct links in elements with class 'description' or similar
	const descriptionElements = document.querySelectorAll(
		'div[class*="description"], div[class*="text"], p'
	);
	descriptionElements.forEach((element, index) => {
		const match = element.textContent.match(githubUrlRegex);
		if (match) {
			githubUrl = match[0];
			console.log("Found GitHub URL:", githubUrl);
		}
	});

	if (!githubUrl) {
		console.log("Could not find a GitHub URL in the project description");
		return null;
	}

	return githubUrl;
}

function createSyncButton() {
	console.log("Creating sync button");
	const button = document.createElement("button");
	button.innerHTML =
		'<img src="' +
		chrome.runtime.getURL("sync-icon.png") +
		'" alt="Sync" style="width: 24px; height: 24px;">';
	button.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 99999;
        padding: 8px;
        background-color: #ff0000;
        border: 3px solid #000000;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;
	button.addEventListener("click", updateProject);
	button.addEventListener("mouseover", () => {
		button.style.backgroundColor = "#4CAF50";
		button.querySelector("img").style.filter = "brightness(0) invert(1)";
	});
	button.addEventListener("mouseout", () => {
		button.style.backgroundColor = "#ff0000";
		button.querySelector("img").style.filter = "none";
	});
	return button;
}

function addSyncButton() {
	console.log("Adding sync button");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		console.log("Button already exists, not adding another");
		return;
	}

	const button = createSyncButton();
	button.id = "github-sync-button";
	document.body.appendChild(button);
	console.log("Sync button added to the page");
}

function checkForGithubUrl() {
	console.log("Checking for GitHub URL");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		console.log("Sync button already exists, skipping check");
		return true; // Button already exists, no need to check further
	}

	const url = extractGithubUrl();
	if (url) {
		console.log("GitHub URL found:", url);
		addSyncButton();
		return true; // URL found and button added
	} else {
		console.log("No GitHub URL found in project description");
		return false; // URL not found
	}
}

// Set up a MutationObserver to watch for changes in the DOM
const observer = new MutationObserver((mutations) => {
	if (checkForGithubUrl()) {
		console.log("GitHub URL found and button added, stopping observer");
		observer.disconnect(); // Stop observing once the button is added
	}
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Also run the check when the script loads, in case the content is already there
if (checkForGithubUrl()) {
	console.log("GitHub URL found on initial load, not starting observer");
} else {
	console.log("GitHub URL not found on initial load, starting observer");
}

function getFileInputElement() {
	const fileInputSelector = 'input[data-testid="project-doc-upload"]';
	const fileInputElement = document.querySelector(fileInputSelector);

	if (!fileInputElement) {
		console.error("Could not find file input element.");
		throw new Error("Could not find file input element for uploading files.");
	}

	return fileInputElement;
}

async function uploadFileDirectly(fileContent, fileName) {
	console.log("Preparing to upload file directly...");

	const fileInputElement = getFileInputElement();

	// Create a File object
	const file = new File([fileContent], fileName, {
		type: "text/plain", // Adjust MIME type as needed
	});

	// Create a DataTransfer object
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	fileInputElement.files = dataTransfer.files;

	// Dispatch a change event
	const event = new Event("change", { bubbles: true });
	fileInputElement.dispatchEvent(event);

	console.log(`File ${fileName} uploaded directly.`);
}

function getClaudeFiles() {
	console.log("Attempting to get Claude files...");

	// Use XPath to select file elements
	const fileXPath =
		"/html/body/div[2]/div/div/main/div[2]/div/div/div[2]/ul/li";
	const fileElements = document.evaluate(
		fileXPath,
		document,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null
	);

	if (fileElements.snapshotLength === 0) {
		console.log("No files found in the knowledge base.");
		return []; // Return an empty array if no files are found
	}

	const files = [];
	for (let i = 0; i < fileElements.snapshotLength; i++) {
		const el = fileElements.snapshotItem(i);
		const nameElement = el.querySelector(".min-w-0.flex-1 .line-clamp-2");
		const typeElement = el.querySelector("[data-testid]");
		const dateElement = el.querySelector(".text-text-400");

		// Extract display name
		const displayName = nameElement
			? nameElement.textContent.trim()
			: "Unknown";

		// Extract file type from data-testid
		const dataTestId = typeElement
			? typeElement.getAttribute("data-testid")
			: "";

		// The full name can be extracted directly from data-testid
		const fullName = dataTestId || displayName;

		// Extract last modified date
		const lastModified = dateElement
			? dateElement.textContent.trim()
			: "Unknown";

		console.log(
			`File ${i}: name="${fullName}", lastModified="${lastModified}"`
		);

		// Push file details into the files array
		files.push({
			name: fullName,
			lastModified,
			removeButton: el.querySelector(
				'button[aria-label="Remove from project knowledge"]'
			),
		});
	}

	return files;
}

async function updateProject() {
	const button = document.getElementById("github-sync-button");
	if (button) {
		button.style.pointerEvents = "none";
		button.style.opacity = "0.5";
		button.querySelector("img").style.animation = "spin 1s linear infinite";
	}

	try {
		console.log("Starting project update...");
		const githubUrl = extractGithubUrl();
		console.log("Extracted GitHub URL:", githubUrl);

		if (!githubUrl) {
			throw new Error("No GitHub URL found in project description");
		}

		const claudeFiles = getClaudeFiles();

		chrome.runtime.sendMessage(
			{ action: "fetchGitHub", repoUrl: githubUrl },
			async function (response) {
				try {
					if (chrome.runtime.lastError) {
						throw new Error(chrome.runtime.lastError.message);
					}
					if (response && response.error) {
						throw new Error(response.error);
					}
					if (!response || !response.files) {
						throw new Error("Invalid response from background script");
					}

					const githubFiles = response.files;
					console.log("GitHub files:", githubFiles);

					await syncFiles(claudeFiles, githubFiles);
					alert("Project successfully synced with GitHub!");
				} catch (error) {
					console.error("Error processing GitHub files:", error);
					alert("Error processing GitHub files: " + error.message);
				} finally {
					if (button) {
						button.style.pointerEvents = "auto";
						button.style.opacity = "1";
						button.querySelector("img").style.animation = "none";
					}
				}
			}
		);
	} catch (error) {
		console.error("Error updating project:", error);
		alert("Error updating project: " + error.message);

		if (button) {
			button.style.pointerEvents = "auto";
			button.style.opacity = "1";
			button.querySelector("img").style.animation = "none";
		}
	}
}

async function syncFiles(claudeFiles, githubFiles) {
	// Remove duplicates from Claude files
	await removeDuplicates(claudeFiles);

	// Remove files that are not in GitHub
	await removeDeletedFiles(claudeFiles, githubFiles);

	// Update or add files from GitHub
	await updateFiles(claudeFiles, githubFiles);
}

async function removeDuplicates(claudeFiles) {
	console.log("Removing duplicate files...");
	const uniqueFiles = new Map();

	for (const file of claudeFiles) {
		if (uniqueFiles.has(file.name)) {
			console.log(`Found duplicate: ${file.name}. Removing...`);
			await removeFile(file);
		} else {
			uniqueFiles.set(file.name, file);
		}
	}
}

async function removeDeletedFiles(claudeFiles, githubFiles) {
	console.log("Removing deleted files...");
	const githubFileNames = new Set(githubFiles.map((file) => file.name));

	for (const claudeFile of claudeFiles) {
		if (!githubFileNames.has(claudeFile.name)) {
			console.log(`File ${claudeFile.name} not found in GitHub. Removing...`);
			await removeFile(claudeFile);
		}
	}
}

async function updateFiles(claudeFiles, githubFiles) {
	console.log("Updating files...");
	const claudeFileMap = new Map(claudeFiles.map((file) => [file.name, file]));

	for (const githubFile of githubFiles) {
		const claudeFile = claudeFileMap.get(githubFile.name);

		if (!claudeFile) {
			console.log(`Adding new file: ${githubFile.name}`);
			await uploadFileDirectly(githubFile.content, githubFile.name);
		} else {
			// Always update the file if we can't reliably compare dates
			let shouldUpdate = true;

			// If we have valid dates for both files, compare them
			if (githubFile.lastModified && claudeFile.lastModified) {
				const githubDate = new Date(githubFile.lastModified);
				const claudeDate = new Date(claudeFile.lastModified);

				if (!isNaN(githubDate) && !isNaN(claudeDate)) {
					shouldUpdate = githubDate > claudeDate;
				}
			}

			if (shouldUpdate) {
				console.log(`Updating file: ${githubFile.name}`);
				await removeFile(claudeFile);
				await uploadFileDirectly(githubFile.content, githubFile.name);
			} else {
				console.log(`File ${githubFile.name} is up to date. Skipping.`);
			}
		}
	}
}

async function removeFile(file) {
	if (file.removeButton) {
		console.log(`Removing file: ${file.name}`);
		file.removeButton.click();
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the removal to complete
	}
}

// Add this CSS to the document
const style = document.createElement("style");
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log("Content script fully loaded and initialized");
