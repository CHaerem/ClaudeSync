document.getElementById("updateButton").addEventListener("click", function () {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.sendMessage(
			tabs[0].id,
			{ action: "updateProject" },
			function (response) {
				document.getElementById("status").textContent =
					"Update process started";
			}
		);
	});
});
