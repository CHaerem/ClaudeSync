// popup.js
document.addEventListener("DOMContentLoaded", function () {
	const updateButton = document.getElementById("updateButton");
	const statusElement = document.getElementById("status");

	updateButton.addEventListener("click", function () {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			const currentTab = tabs[0];
			if (currentTab.url.startsWith("https://claude.ai/project/")) {
				chrome.tabs.sendMessage(
					currentTab.id,
					{ action: "updateProject" },
					function (response) {
						if (chrome.runtime.lastError) {
							console.error(chrome.runtime.lastError);
							statusElement.textContent =
								"Error: Make sure you're on a Claude project page and refresh.";
						} else if (response && response.status === "success") {
							statusElement.textContent =
								"Update process started successfully.";
						} else {
							statusElement.textContent =
								"Unknown error occurred. Check console for details.";
						}
					}
				);
			} else {
				statusElement.textContent =
					"Please navigate to a Claude project page before updating.";
			}
		});
	});
});
