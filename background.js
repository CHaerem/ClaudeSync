console.log("[Background] Background script loading...");

async function makeGitHubRequest(url, options = {}) {
    console.log("[Background] Making GitHub request to:", url);
    
    const { githubPat } = await chrome.storage.local.get('githubPat');
    
    if (githubPat) {
        options.headers = {
            ...options.headers,
            'Authorization': `token ${githubPat}`
        };
    }

    const response = await fetch(url, options);
    
    if (response.status === 403) {
        // Rate limit handling remains the same
        console.log("[Background] 403 received, attempting to prompt for PAT");
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (!tabs[0]) throw new Error('No active tab found');
            
            const newPat = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'promptForPAT',
                message: 'GitHub rate limit exceeded. Please enter a Personal Access Token:'
            });
            
            if (newPat) {
                await chrome.storage.local.set({ githubPat: newPat });
                options.headers = { ...options.headers, 'Authorization': `token ${newPat}` };
                return fetch(url, options);
            }
            throw new Error('GitHub rate limit exceeded. Please try again later or provide a PAT.');
        } catch (error) {
            console.error("[Background] Error during PAT prompt:", error);
            throw error;
        }
    }

    // Return response for all statuses - let calling function handle specific cases
    return response;
}

async function fetchFilterRules(owner, repo) {
    console.log("[Background] Fetching filter rules for:", owner, repo);
    try {
        let excludedFiles = [], includedFiles = [];

        // Fetch exclude rules
        const excludeResponse = await makeGitHubRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/exclude_claudsync`,
            { headers: { Accept: "application/vnd.github.v3+json" } }
        );

        // Fetch include rules
        const includeResponse = await makeGitHubRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/include_claudsync`,
            { headers: { Accept: "application/vnd.github.v3+json" } }
        );

        // Process exclude_claudsync if it exists
        if (excludeResponse.status === 200) {
            const excludeData = await excludeResponse.json();
            excludedFiles = atob(excludeData.content)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        } else if (excludeResponse.status !== 404) {
            throw new Error(`Failed to fetch exclude_claudsync: ${excludeResponse.status}`);
        }

        // Process include_claudsync if it exists
        if (includeResponse.status === 200) {
            const includeData = await includeResponse.json();
            includedFiles = atob(includeData.content)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        } else if (includeResponse.status !== 404) {
            throw new Error(`Failed to fetch include_claudsync: ${includeResponse.status}`);
        }

        return { excludedFiles, includedFiles };
    } catch (error) {
        console.error("[Background] Error fetching filter rules:", error);
        throw error;
    }
}

async function getDefaultBranch(owner, repo) {
    console.log("[Background] Fetching default branch for:", owner, repo);
    try {
        const response = await makeGitHubRequest(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Accept: "application/vnd.github.v3+json" }
        });
        
        if (!response.ok) {
            console.error(`[Background] Failed to fetch repo info: ${response.status}`);
            throw new Error(`Failed to fetch repository info: ${response.status}`);
        }
        
        const repoInfo = await response.json();
        console.log(`[Background] Default branch is: ${repoInfo.default_branch}`);
        return repoInfo.default_branch;
    } catch (error) {
        console.error("[Background] Error getting default branch:", error);
        throw error;
    }
}

async function fetchFilesList(owner, repo) {
    console.log("[Background] Fetching files list for:", owner, repo);
    
    try {
        // First get the default branch
        const defaultBranch = await getDefaultBranch(owner, repo);
        
        // Try fetching the tree using the default branch
        const response = await makeGitHubRequest(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
            { headers: { Accept: "application/vnd.github.v3+json" } }
        );

        if (!response.ok) {
            console.error(`[Background] Failed to fetch tree: ${response.status}`);
            // Include more details in error message
            const errorBody = await response.text();
            throw new Error(
                `Failed to fetch repository tree (${response.status}): ${response.statusText}\n${errorBody}`
            );
        }

        const data = await response.json();
        
        // Check if we got truncated results
        if (data.truncated) {
            console.warn("[Background] Warning: Repository tree was truncated due to size");
        }

        return data.tree
            .filter(item => item.type === 'blob')
            .map(item => item.path);
    } catch (error) {
        console.error("[Background] Error in fetchFilesList:", error);
        throw error;
    }
}

async function fetchSelectedFiles(owner, repo, filesList) {
    console.log("[Background] Fetching selected files:", filesList);
    return Promise.all(
        filesList.map(async (path) => {
            const response = await makeGitHubRequest(
                `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
                { headers: { Accept: "application/vnd.github.v3+json" } }
            );
            
            if (!response.ok) {
                console.error(`[Background] Error fetching ${path}:`, response.statusText);
                return null;
            }

            const data = await response.json();
            return {
                name: path,
                content: atob(data.content),
                sha: data.sha
            };
        })
    ).then(files => files.filter(f => f !== null));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received message:", request);
    
    if (request.action === "fetchGitHub") {
        console.log("[Background] Processing GitHub request for:", request.repoUrl);
        const [, , , owner, repo] = request.repoUrl.split("/");
        
        if (!owner || !repo) {
            console.error("[Background] Invalid GitHub URL format");
            sendResponse({ error: "Invalid GitHub URL format" });
            return true;
        }

        // Step 1: If this is the initial request, only fetch filter rules
        if (!request.confirmed) {
            console.log("[Background] Initial request - fetching filter rules only");
            fetchFilterRules(owner, repo)
                .then(({ excludedFiles, includedFiles }) => {
                    // Get lightweight file list using tree API
                    return fetchFilesList(owner, repo).then(filesList => {
                        sendResponse({ 
                            stage: 'confirmation',
                            excludedFiles, 
                            includedFiles,
                            filesList 
                        });
                    });
                })
                .catch(error => {
                    console.error("[Background] Error in initial fetch:", error);
                    sendResponse({ error: error.message });
                });
            return true;
        }
        
        // Step 2: If user confirmed, fetch actual file contents
        if (request.confirmed && request.filesList) {
            console.log("[Background] Confirmation received - fetching selected files");
            fetchSelectedFiles(owner, repo, request.filesList)
                .then(files => {
                    sendResponse({ 
                        stage: 'complete',
                        files,
                        excludedFiles: request.excludedFiles,
                        includedFiles: request.includedFiles
                    });
                })
                .catch(error => {
                    console.error("[Background] Error fetching files:", error);
                    sendResponse({ error: error.message });
                });
            return true;
        }
    }
});

async function fetchGitHubFiles(repoUrl) {
    console.log("[Background] Starting fetchGitHubFiles for:", repoUrl);

    const [, , , owner, repo] = repoUrl.split("/");

    if (!owner || !repo) {
        console.error("[Background] Invalid GitHub URL format");
        throw new Error("Invalid GitHub URL format");
    }

    console.log(`[Background] Owner: ${owner}, Repo: ${repo}`);

    try {
        console.log("[Background] Fetching files recursively...");
        const files = await fetchFilesRecursively(
            `https://api.github.com/repos/${owner}/${repo}/contents`
        );
        console.log("[Background] Fetching excluded files...");
        const excludedFiles = await fetchExcludedFiles(owner, repo);
        console.log("[Background] Fetching included files...");
        const includedFiles = await fetchIncludedFiles(owner, repo);
        console.log("[Background] All files retrieved from GitHub:", files);
        console.log("[Background] Excluded files:", excludedFiles);
        console.log("[Background] Included files:", includedFiles);
        return { files, excludedFiles, includedFiles };
    } catch (error) {
        console.error("[Background] Error in fetchGitHubFiles:", error);
        throw error;
    }
}

async function fetchFilesRecursively(url) {
    console.log("[Background] Fetching files from:", url);
    const response = await makeGitHubRequest(url, {
        headers: {
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        console.error("[Background] HTTP error:", response.status, response.statusText);
        if (response.status === 404) {
            throw new Error(
                "Repository not found or is private. This extension only works with public repositories."
            );
        }
        const errorBody = await response.text();
        console.error("[Background] GitHub API Error Response:", errorBody);
        throw new Error(
            `GitHub API responded with status ${response.status}: ${response.statusText}`
        );
    }

    const items = await response.json();
    let files = [];

    for (const item of items) {
        if (item.type === "file") {
            console.log("[Background] Fetching content for file:", item.name);
            const contentResponse = await makeGitHubRequest(item.download_url);
            if (!contentResponse.ok) {
                console.error("[Background] Failed to fetch content for", item.name);
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
            console.log("[Background] Recursing into directory:", item.name);
            const subFiles = await fetchFilesRecursively(item.url);
            files = files.concat(subFiles);
        }
    }

    return files;
}

async function fetchExcludedFiles(owner, repo) {
    const excludeFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/exclude_claudsync`;
    console.log("[Background] Fetching exclude file from:", excludeFileUrl);
    try {
        const response = await makeGitHubRequest(excludeFileUrl, {
            headers: {
                Accept: "application/vnd.github.v3+json",
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log("[Background] No exclude_claudsync file found.");
                return [];
            }
            console.error("[Background] Failed to fetch exclude_claudsync file:", response.statusText);
            throw new Error(`Failed to fetch exclude_claudsync file: ${response.statusText}`);
        }

        const data = await response.json();
        const content = atob(data.content);
        const excludedItems = content.split('\n')
            .map(line => line.trim())
            .filter(line => line !== '' && !line.startsWith('#'));
        console.log("[Background] Excluded items:", excludedItems);
        return excludedItems;
    } catch (error) {
        console.error("[Background] Error fetching excluded files:", error);
        return [];
    }
}

async function fetchIncludedFiles(owner, repo) {
    const includeFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/include_claudsync`;
    console.log("[Background] Fetching include file from:", includeFileUrl);
    try {
        const response = await makeGitHubRequest(includeFileUrl, {
            headers: {
                Accept: "application/vnd.github.v3+json",
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log("[Background] No include_claudsync file found.");
                return [];
            }
            console.error("[Background] Failed to fetch include_claudsync file:", response.statusText);
            throw new Error(`Failed to fetch include_claudsync file: ${response.statusText}`);
        }

        const data = await response.json();
        const content = atob(data.content);
        const includedItems = content.split('\n')
            .map(line => line.trim())
            .filter(line => line !== '' && !line.startsWith('#'));
        console.log("[Background] Included items:", includedItems);
        return includedItems;
    } catch (error) {
        console.error("[Background] Error fetching included files:", error);
        return [];
    }
}

console.log("[Background] Background script loaded");