// background.js

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action === "fetchGitHub") {
		fetchGitHubFiles(request.repoUrl)
			.then((files) => sendResponse({ files: files }))
			.catch((error) => {
				console.error("Error in fetchGitHubFiles:", error);
				sendResponse({ error: error.message });
			});
		return true; // Indicates we will send a response asynchronously
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
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/contents`,
			{
				headers: {
					Accept: "application/vnd.github.v3+json",
				},
			}
		);

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

		const files = await response.json();
		console.log("Files retrieved from GitHub:", files);

		// Fetch content for each file
		const filesWithContent = await Promise.all(
			files.map(async (file) => {
				if (file.type !== "file") return file; // Skip directories

				const contentResponse = await fetch(file.download_url);
				if (!contentResponse.ok) {
					throw new Error(`Failed to fetch content for ${file.name}`);
				}
				file.content = await contentResponse.text();
				return file;
			})
		);

		return filesWithContent;
	} catch (error) {
		console.error("Error in fetchGitHubFiles:", error);
		throw error;
	}
}
