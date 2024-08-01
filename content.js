// Content script for updating Claude.ai projects

function extractGithubUrl() {
	console.log("Extracting GitHub URL...");

	// Define a regex pattern for GitHub URLs
	const githubUrlRegex = /https:\/\/github\.com\/[\w-]+\/[\w-]+/;
	let githubUrl = null;

	// Method 1: Look for direct links in elements with class 'description' or similar
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

	// Method 2: Search through all text nodes if Method 1 fails
	if (!githubUrl) {
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_TEXT,
			null,
			false
		);
		let node;
		while ((node = walker.nextNode())) {
			const match = node.textContent.match(githubUrlRegex);
			if (match) {
				githubUrl = match[0];
				console.log("Found GitHub URL in text node:", githubUrl);
				break;
			}
		}
	}

	if (!githubUrl) {
		console.error("Could not find a GitHub URL in the project description");
		throw new Error("Could not find a GitHub URL in the project description");
	}

	return githubUrl;
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
	try {
		console.log("Starting project update...");
		const githubUrl = extractGithubUrl();
		console.log("Extracted GitHub URL:", githubUrl);

		const claudeFiles = getClaudeFiles();

		chrome.runtime.sendMessage(
			{ action: "fetchGitHub", repoUrl: githubUrl },
			async function (response) {
				if (response.error) {
					console.error("Error fetching GitHub files:", response.error);
					return;
				}

				const githubFiles = response.files;
				console.log("GitHub files:", githubFiles);

				await syncFiles(claudeFiles, githubFiles);
			}
		);
	} catch (error) {
		console.error("Error updating project:", error);
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
			// Compare last modified dates if available, otherwise always update
			const shouldUpdate =
				!claudeFile.lastModified ||
				new Date(githubFile.lastModified) > new Date(claudeFile.lastModified);

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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action === "updateProject") {
		console.log("Received update project request");
		updateProject();
		sendResponse({ status: "success" });
		return true; // Indicates we will send a response asynchronously
	}
});
