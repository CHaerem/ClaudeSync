chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action === "updateProject") {
		updateProject();
	}
});

async function updateProject() {
	try {
		const githubUrl = extractGithubUrl();
		const claudeFiles = getClaudeFiles();

		chrome.runtime.sendMessage(
			{ action: "fetchGitHub", repoUrl: githubUrl },
			async function (response) {
				if (response.error) {
					console.error("Error fetching GitHub files:", response.error);
					return;
				}

				const githubFiles = response.files;
				await updateFiles(claudeFiles, githubFiles);
			}
		);
	} catch (error) {
		console.error("Error updating project:", error);
	}
}

function extractGithubUrl() {
	const descriptionElement = document.evaluate(
		"/html/body/div[2]/div/div/main/div[1]/div[1]/div[2]",
		document,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null
	).singleNodeValue;

	if (!descriptionElement) {
		throw new Error("Could not find project description element");
	}

	return descriptionElement.textContent.trim();
}

function getClaudeFiles() {
	const fileListElement = document.evaluate(
		"/html/body/div[2]/div/div/main/div[2]/div/div/div[2]/ul",
		document,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null
	).singleNodeValue;

	if (!fileListElement) {
		throw new Error("Could not find file list element");
	}

	const fileElements = fileListElement.querySelectorAll("li");
	return Array.from(fileElements).map((el) => ({
		name: el.querySelector(".text-sm").textContent.trim(),
		lastModified: el.querySelector(".text-text-400").textContent.trim(),
	}));
}

async function updateFiles(claudeFiles, githubFiles) {
	for (const githubFile of githubFiles) {
		const claudeFile = claudeFiles.find((cf) => cf.name === githubFile.name);
		if (
			!claudeFile ||
			isGithubFileNewer(githubFile.last_modified, claudeFile.lastModified)
		) {
			await uploadToClaudeAI(githubFile);
		}
	}
}

function isGithubFileNewer(githubDate, claudeDate) {
	const now = new Date();
	const daysAgo = parseInt(claudeDate.split(" ")[0]);
	const claudeFileDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

	return new Date(githubDate) > claudeFileDate;
}

async function uploadToClaudeAI(file) {
	console.log(`Uploading file: ${file.name}`);

	const addContentButton = await waitForElement(
		"/html/body/div[2]/div/div/main/div[2]/div/div/div[1]/button"
	);
	addContentButton.click();

	const uploadOption = await waitForElement("button", (button) =>
		button.textContent.includes("Upload")
	);
	uploadOption.click();

	const fileInput = await waitForElement('input[type="file"]');
	const fileBlob = new Blob([file.content], { type: "text/plain" });
	const fileList = new DataTransfer();
	fileList.items.add(new File([fileBlob], file.name));
	fileInput.files = fileList.files;

	const event = new Event("change", { bubbles: true });
	fileInput.dispatchEvent(event);

	// Wait for the upload progress indicator to appear and then disappear
	await waitForElement(".upload-progress-indicator");
	await waitForElementToDisappear(".upload-progress-indicator");

	const confirmButton = await waitForElement("button", (button) =>
		button.textContent.includes("Add to Project")
	);
	confirmButton.click();

	// Wait for the file to appear in the file list
	await waitForElement(`li[data-testid="${file.name}"]`);

	console.log(`File uploaded: ${file.name}`);
}

// Helper function to wait for an element to appear
function waitForElement(selector, condition = null, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		function checkElement() {
			const element =
				typeof selector === "string"
					? document.querySelector(selector)
					: document.evaluate(
							selector,
							document,
							null,
							XPathResult.FIRST_ORDERED_NODE_TYPE,
							null
					  ).singleNodeValue;

			if (element && (!condition || condition(element))) {
				resolve(element);
			} else if (Date.now() - startTime > timeout) {
				reject(new Error(`Timeout waiting for element: ${selector}`));
			} else {
				setTimeout(checkElement, 100);
			}
		}

		checkElement();
	});
}

// Helper function to wait for an element to disappear
function waitForElementToDisappear(selector, timeout = 30000) {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		function checkElementGone() {
			const element = document.querySelector(selector);

			if (!element) {
				resolve();
			} else if (Date.now() - startTime > timeout) {
				reject(
					new Error(`Timeout waiting for element to disappear: ${selector}`)
				);
			} else {
				setTimeout(checkElementGone, 100);
			}
		}

		checkElementGone();
	});
}
