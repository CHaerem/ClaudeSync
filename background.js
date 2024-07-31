chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action === "fetchGitHub") {
		fetchGitHubFiles(request.repoUrl)
			.then((files) => sendResponse({ files: files }))
			.catch((error) => sendResponse({ error: error.message }));
		return true; // Indicates we will send a response asynchronously
	}
});

async function fetchGitHubFiles(repoUrl) {
	const GITHUB_TOKEN = "your_personal_access_token";
	const [, , , owner, repo] = repoUrl.split("/");

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/contents`,
		{
			headers: { Authorization: `token ${GITHUB_TOKEN}` },
		}
	);

	if (!response.ok) throw new Error("Failed to fetch GitHub files");

	const files = await response.json();

	// Fetch content for each file
	for (const file of files) {
		const contentResponse = await fetch(file.download_url, {
			headers: { Authorization: `token ${GITHUB_TOKEN}` },
		});
		if (!contentResponse.ok)
			throw new Error(`Failed to fetch content for ${file.name}`);
		file.content = await contentResponse.text();
	}

	return files;
}
