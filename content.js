console.log("Claude Project Updater: Content script loaded");

function extractGithubUrl() {
	const githubUrlRegex = /https:\/\/github\.com\/[\w-]+\/[\w-]+/;
	const descriptionElements = document.querySelectorAll(
		'div[class*="description"], div[class*="text"], p'
	);

	for (const element of descriptionElements) {
		const match = element.textContent.match(githubUrlRegex);
		if (match) {
			return match[0];
		}
	}

	return null;
}

function createSyncButton() {
	const button = document.createElement("button");
	button.innerHTML = `
        <img src="${chrome.runtime.getURL(
					"icon.svg"
				)}" alt="Sync" class="sync-icon" width="16" height="16">
        <span>Sync</span>
    `;
	button.id = "github-sync-button";
	button.className = `
        inline-flex items-center justify-center
        text-text-300 hover:text-text-100
        px-2 py-1 rounded-lg hover:bg-bg-400/50 transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-accent-main-100 focus:ring-offset-2
        text-sm font-medium gap-1
    `;
	button.title = "Sync with GitHub";
	button.addEventListener("click", updateProject);
	return button;
}

function addSyncButton() {
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) return;

	const descriptionElement = document.querySelector(
		".text-text-300.text-sm.leading-relaxed.line-clamp-2"
	);
	if (descriptionElement) {
		const button = createSyncButton();
		descriptionElement.parentNode.insertBefore(button, descriptionElement);
	}
}

function checkForGithubUrl() {
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
	const fileInputElement = document.querySelector(
		'input[data-testid="project-doc-upload"]'
	);
	if (!fileInputElement) {
		throw new Error("Could not find file input element for uploading files.");
	}
	return fileInputElement;
}

function isFileTypeAllowed(fileName) {
	const fileInputElement = getFileInputElement();
	const allowedExtensions = fileInputElement.accept.split(",");
	const fileExtension = "." + fileName.split(".").pop().toLowerCase();
	return allowedExtensions.includes(fileExtension);
}

async function uploadFileDirectly(fileContent, fileName) {
	if (!isFileTypeAllowed(fileName)) {
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
}

function getClaudeFiles() {
	const fileXPath =
		"/html/body/div[2]/div/div/main/div[2]/div/div/div[2]/ul/li";
	const fileElements = document.evaluate(
		fileXPath,
		document,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null
	);

	const files = [];
	for (let i = 0; i < fileElements.snapshotLength; i++) {
		const el = fileElements.snapshotItem(i);
		const nameElement = el.querySelector(".min-w-0.flex-1 .line-clamp-2");
		const removeButton = el.querySelector(
			'button[aria-label="Remove from project knowledge"]'
		);

		if (nameElement && removeButton) {
			files.push({
				name: nameElement.textContent.trim(),
				removeButton: removeButton,
			});
		}
	}

	return files;
}

async function updateProject() {
	const button = document.getElementById("github-sync-button");
	if (button) {
		button.disabled = true;
		button.querySelector(".sync-icon").classList.add("spinning");
	}

	try {
		console.log("Starting project update...");
		const githubUrl = extractGithubUrl();
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
					console.log(`Fetched ${githubFiles.length} files from GitHub`);

					await syncFiles(claudeFiles, githubFiles);
					console.log("Project successfully synced with GitHub");
					alert("Project successfully synced with GitHub!");
				} catch (error) {
					console.error("Error processing GitHub files:", error);
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
		console.error("Error updating project:", error);
		alert("Error updating project: " + error.message);
		if (button) {
			button.disabled = false;
			button.querySelector(".sync-icon").classList.remove("spinning");
		}
	}
}

async function syncFiles(claudeFiles, githubFiles) {
	console.log("Starting file synchronization...");

	// Step 1: Remove all files from Claude
	const removalPromises = claudeFiles.map((file) => removeFile(file));
	await Promise.all(removalPromises);

	// Step 2: Upload all files from GitHub
	let uploadedCount = 0;
	let skippedCount = 0;
	for (const file of githubFiles) {
		if (isFileTypeAllowed(file.name)) {
			await uploadFileDirectly(file.content, file.name);
			uploadedCount++;
		} else {
			skippedCount++;
		}
	}
	console.log(`Uploaded ${uploadedCount} files, skipped ${skippedCount} files`);
}

async function removeFile(file) {
	return new Promise((resolve) => {
		if (file.removeButton) {
			file.removeButton.click();
			setTimeout(resolve, 1000);
		} else {
			resolve();
		}
	});
}

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

function handlePageChange() {
	if (window.location.href.includes("/project/")) {
		initializeExtension();
	} else {
		removeSyncButton();
	}
}

function removeSyncButton() {
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		existingButton.remove();
	}
}

function initializeExtension() {
	if (!checkForGithubUrl()) {
		startObserver();
	}
}

function startObserver() {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "childList" || mutation.type === "subtree") {
				if (checkForGithubUrl()) {
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
		observer.disconnect();
	}, 30000);
}

function setupHistoryChangeDetection() {
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

setupHistoryChangeDetection();
setupContentChangeDetection();
handlePageChange();
