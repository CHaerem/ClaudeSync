console.log("Claude Project Updater: Content script loaded");

function extractGithubUrl() {
	console.log("Attempting to extract GitHub URL");
	const githubUrlRegex = /https:\/\/github\.com\/[\w-]+\/[\w-]+/;
	let githubUrl = null;

	const descriptionElements = document.querySelectorAll(
		'div[class*="description"], div[class*="text"], p'
	);
	descriptionElements.forEach((element) => {
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
	button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="sync-icon">
            <path d="M224,128a95.76,95.76,0,0,1-31.8,71.37A72,72,0,0,1,128,232a8,8,0,0,1,0-16,56.06,56.06,0,0,0,50.2-31.06A79.51,79.51,0,0,1,136,200h-1.62A80,80,0,1,1,196.8,59.06,8,8,0,0,1,190.31,74,64,64,0,1,0,207.6,169.64,96,96,0,1,1,224,128Zm-24-64a8,8,0,0,0-8,8v56a8,8,0,0,0,8,8h56a8,8,0,0,0,5.66-13.66l-16-16a96.15,96.15,0,0,1,1.63,17.66,8,8,0,0,0,16,0,80.21,80.21,0,0,0-2.39-19.4L248,92.69A8,8,0,0,0,240,80Z"/>
        </svg>
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
	console.log("Adding sync button");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		console.log("Button already exists, not adding another");
		return;
	}

	const descriptionElement = document.querySelector(
		".text-text-300.text-sm.leading-relaxed.line-clamp-2"
	);
	if (descriptionElement) {
		const button = createSyncButton();
		descriptionElement.parentNode.insertBefore(button, descriptionElement);
		console.log("Sync button added before GitHub URL description");
	} else {
		console.log("Could not find GitHub URL description to add sync button");
	}
}

function checkForGithubUrl() {
	console.log("Checking for GitHub URL");
	const existingButton = document.getElementById("github-sync-button");
	if (existingButton) {
		console.log("Sync button already exists, skipping check");
		return true;
	}

	const url = extractGithubUrl();
	if (url) {
		console.log("GitHub URL found:", url);
		addSyncButton();
		return true;
	} else {
		console.log("No GitHub URL found in project description");
		return false;
	}
}

const observer = new MutationObserver((mutations) => {
	if (checkForGithubUrl()) {
		console.log("GitHub URL found and button added, stopping observer");
		observer.disconnect();
	}
});

observer.observe(document.body, { childList: true, subtree: true });

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

	const file = new File([fileContent], fileName, { type: "text/plain" });

	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	fileInputElement.files = dataTransfer.files;

	const event = new Event("change", { bubbles: true });
	fileInputElement.dispatchEvent(event);

	console.log(`File ${fileName} uploaded directly.`);
}

function getClaudeFiles() {
	console.log("Attempting to get Claude files...");

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
		return [];
	}

	const files = [];
	for (let i = 0; i < fileElements.snapshotLength; i++) {
		const el = fileElements.snapshotItem(i);
		const nameElement = el.querySelector(".min-w-0.flex-1 .line-clamp-2");
		const typeElement = el.querySelector("[data-testid]");
		const dateElement = el.querySelector(".text-text-400");

		const displayName = nameElement
			? nameElement.textContent.trim()
			: "Unknown";
		const dataTestId = typeElement
			? typeElement.getAttribute("data-testid")
			: "";
		const fullName = dataTestId || displayName;
		const lastModified = dateElement
			? dateElement.textContent.trim()
			: "Unknown";

		console.log(
			`File ${i}: name="${fullName}", lastModified="${lastModified}"`
		);

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
		button.disabled = true;
		button.querySelector(".sync-icon").classList.add("spinning");
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
						button.querySelector("img").style.animation = "none";
					}
				}
			}
		);
	} catch (error) {
		console.error("Error updating project:", error);
		alert("Error updating project: " + error.message);
	} finally {
		if (button) {
			button.disabled = false;
			button.querySelector(".sync-icon").classList.remove("spinning");
		}
	}
}

async function syncFiles(claudeFiles, githubFiles) {
	await removeDuplicates(claudeFiles);
	await removeDeletedFiles(claudeFiles, githubFiles);
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
			let shouldUpdate = true;

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
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
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

console.log("Content script fully loaded and initialized");
