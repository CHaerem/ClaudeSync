chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Background script received message:", request);
	if (request.action === "fetchGitHub") {
		fetchGitHubFiles(request.repoUrl)
			.then((files) => {
				console.log("Fetched files:", files);
				sendResponse({ files: files });
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
		console.log("All files retrieved from GitHub:", files);
		return files;
	} catch (error) {
		console.error("Error in fetchGitHubFiles:", error);
		throw error;
	}
}

async function fetchFilesRecursively(url) {
	const response = await fetch(url, {
		headers: {
			Accept: "application/vnd.github.v3+json",
		},
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(
				"Repository not found or is private. This extension only works with public repositories."
			);
		}
		const errorBody = await response.text();
		console.error("GitHub API Error Response:", errorBody);
		throw new Error(
			`GitHub API responded with status ${response.status}: ${response.statusText}`
		);
	}

	const items = await response.json();
	let files = [];

	for (const item of items) {
		if (item.type === "file") {
			const contentResponse = await fetch(item.download_url);
			if (!contentResponse.ok) {
				throw new Error(`Failed to fetch content for ${item.name}`);
			}
			const content = await contentResponse.text();
			files.push({
				name: item.path,
				content: content,
				sha: item.sha,
				lastModified: item.last_modified,
			});
		} else if (item.type === "dir") {
			const subFiles = await fetchFilesRecursively(item.url);
			files = files.concat(subFiles);
		}
	}

	return files;
}

console.log("Background script loaded");
