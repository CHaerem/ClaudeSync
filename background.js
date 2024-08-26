chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Background script received message:", request);
	if (request.action === "fetchGitHub") {
		fetchGitHubFiles(request.repoUrl)
			.then(({ files, excludedFiles }) => {
				console.log("Fetched files:", files);
				console.log("Excluded files:", excludedFiles);
				sendResponse({ files: files, excludedFiles: excludedFiles });
			})
			.catch((error) => {
				console.error("Error fetching GitHub files:", error);
				sendResponse({ error: error.message });
			});
		return true; // Indicates that the response is asynchronous
	}
});

async function fetchGitHubFiles(repoUrl) {
	console.log("Fetching GitHub files for:", repoUrl);

	const [, , , owner, repo] = repoUrl.split("/");

	if (!owner || !repo) {
		throw new Error("Invalid GitHub URL format");
	}

	console.log(`Owner: ${owner}, Repo: ${repo}`);

	try {
		const files = await fetchFilesRecursively(
			`https://api.github.com/repos/${owner}/${repo}/contents`
		);
		const excludedFiles = await fetchExcludedFiles(owner, repo);
		console.log("All files retrieved from GitHub:", files);
		console.log("Excluded files:", excludedFiles);
		return { files, excludedFiles };
	} catch (error) {
		console.error("Error in fetchGitHubFiles:", error);
		throw error;
	}
}

async function fetchFilesRecursively(url) {
	// ... (existing fetchFilesRecursively function remains unchanged)
}

async function fetchExcludedFiles(owner, repo) {
	const excludeFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/exclude_claudsync`;
	try {
		const response = await fetch(excludeFileUrl, {
			headers: {
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				console.log("No exclude_claudsync file found.");
				return [];
			}
			throw new Error(`Failed to fetch exclude_claudsync file: ${response.statusText}`);
		}

		const data = await response.json();
		const content = atob(data.content);
		return content.split('\n').filter(line => line.trim() !== '');
	} catch (error) {
		console.error("Error fetching excluded files:", error);
		return [];
	}
}

console.log("Background script loaded");