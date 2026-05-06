const spotifyClientIdInput = document.getElementById('spotifyClientIdInput');
const spotifyRedirectUriInput = document.getElementById('spotifyRedirectUriInput');
const saveSpotifySetupBtn = document.getElementById('saveSpotifySetupBtn');
const copyRedirectUriBtn = document.getElementById('copyRedirectUriBtn');
const openSpotifyDashboardBtn = document.getElementById('openSpotifyDashboardBtn');
const editSpotifyClientIdBtn = document.getElementById('editSpotifyClientIdBtn');
const closeSetupBtn = document.getElementById('closeSetupBtn');
const spotifyLoginBtn = document.getElementById('spotifyLoginBtn');
const spotifyTooltipBtn = document.getElementById('spotifyTooltipBtn');
const spotifyTooltip = document.getElementById('spotifyTooltip');
const spotifyClientIdValidation = document.getElementById('spotifyClientIdValidation');
const confirmDialog = document.getElementById('confirmDialog');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

let latestSpotifySetupInfo = null;
let isSpotifyAuthenticated = false;
let isEditingClientId = false;
let confirmAction = null;
const SPOTIFY_CLIENT_ID_PATTERN = /^[a-f0-9]{32}$/i;

function showConfirm(message, action) {
	confirmMessage.textContent = message;
	confirmDialog.classList.add('show');
	confirmAction = action;
}

function hideConfirm() {
	confirmDialog.classList.remove('show');
	confirmMessage.textContent = '';
	confirmAction = null;
	confirmYes.textContent = 'Confirm';
	confirmYes.onclick = null;
	confirmNo.style.display = 'block';
}

function syncSetupState() {
	const hasClientId = !!getNormalizedSpotifyClientId();
	const isLocked = isSpotifyAuthenticated && hasClientId && !isEditingClientId;

	spotifyClientIdInput.readOnly = isLocked;
	editSpotifyClientIdBtn.style.display = hasClientId ? 'inline-flex' : 'none';
	editSpotifyClientIdBtn.textContent = isEditingClientId ? 'Cancel' : 'Edit';
	saveSpotifySetupBtn.disabled = isLocked;
	spotifyLoginBtn.textContent = isSpotifyAuthenticated ? 'Sign Out' : 'Login';
	spotifyLoginBtn.title = isSpotifyAuthenticated ? 'Sign out of Spotify' : 'Login to Spotify';
	spotifyClientIdInput.classList.toggle('locked', isLocked);
}

async function refreshAuthState() {
	if (!window.api || !window.api.isAuthed) {
		isSpotifyAuthenticated = false;
		syncSetupState();
		return;
	}

	try {
		isSpotifyAuthenticated = !!(await window.api.isAuthed());
	} catch (_err) {
		isSpotifyAuthenticated = false;
	}

	syncSetupState();
}

function getNormalizedSpotifyClientId() {
	return spotifyClientIdInput.value.trim();
}

function setSpotifyClientIdValidation(message = '') {
	const hasError = !!message;
	spotifyClientIdInput.classList.toggle('invalid', hasError);
	spotifyClientIdInput.setAttribute('aria-invalid', hasError ? 'true' : 'false');
	spotifyClientIdValidation.textContent = message;
	spotifyClientIdValidation.classList.toggle('show', hasError);
}

function validateSpotifyClientIdInput({ showError = true } = {}) {
	const clientId = getNormalizedSpotifyClientId();
	let message = '';

	if (!clientId) {
		message = 'Client ID is required.';
	} else if (!SPOTIFY_CLIENT_ID_PATTERN.test(clientId)) {
		message = 'Client ID must be 32-characters.';
	}

	if (showError) {
		setSpotifyClientIdValidation(message);
	} else if (!message) {
		setSpotifyClientIdValidation('');
	}

	return { isValid: !message, clientId, message };
}

function renderSpotifySetup(info) {
	latestSpotifySetupInfo = info || latestSpotifySetupInfo;
	spotifyClientIdInput.value = info.clientId || '';
	if (spotifyRedirectUriInput) {
		spotifyRedirectUriInput.value = info.redirectUri || '';
	}
	if (!info?.clientId) {
		isEditingClientId = false;
	}
	setSpotifyClientIdValidation('');
	syncSetupState();
}

async function persistSpotifyClientId({ showError = false } = {}) {
	if (!window.api || !window.api.setSpotifyClientId) {
		return latestSpotifySetupInfo;
	}

	const validation = validateSpotifyClientIdInput({ showError });
	if (!validation.isValid) {
		if (showError) {
			spotifyClientIdInput.focus();
			spotifyClientIdInput.select();
		}
		return null;
	}

	const previousClientId = latestSpotifySetupInfo?.clientId || '';
	const nextClientId = validation.clientId;
	const nextInfo = await window.api.setSpotifyClientId(nextClientId);
	if (previousClientId !== nextClientId) {
		isSpotifyAuthenticated = false;
		isEditingClientId = false;
	}
	renderSpotifySetup(nextInfo);
	return nextInfo;
}

async function loadSpotifySetup() {
	if (!window.api || !window.api.getSpotifySetupInfo) {
		return;
	}

	try {
		const info = await window.api.getSpotifySetupInfo();
		renderSpotifySetup(info);
		await refreshAuthState();
	} catch (err) {
		console.error('Failed to load Spotify setup:', err);
	}
}

closeSetupBtn.addEventListener('click', async () => {
	try {
		await window.api.toggleSetup();
	} catch (err) {
		console.error('Failed to close Spotify setup window:', err);
	}
});

saveSpotifySetupBtn.addEventListener('click', async () => {
	try {
		await persistSpotifyClientId({ showError: false });
	} catch (err) {
		console.error('Failed to save Spotify Client ID:', err);
	}
});

spotifyLoginBtn.addEventListener('click', async () => {
	try {
		if (isSpotifyAuthenticated) {
			showConfirm('Are you sure you want to sign out?', async () => {
				try {
					await window.api.logout();
					hideConfirm();
					await window.api.toggleSetup();
				} catch (err) {
					console.error('Logout failed', err);
					hideConfirm();
				}
			});
			return;
		}

		const savedInfo = await persistSpotifyClientId({ showError: true });
		if (!savedInfo || !savedInfo.hasConfiguredClientId) {
			return;
		}

		await window.api.login();
	} catch (err) {
		console.error('Failed to start Spotify login:', err);
	}
});

editSpotifyClientIdBtn.addEventListener('click', () => {
	if (!getNormalizedSpotifyClientId()) {
		return;
	}

	if (isEditingClientId) {
		isEditingClientId = false;
		renderSpotifySetup(latestSpotifySetupInfo);
		return;
	}

	isEditingClientId = true;
	syncSetupState();
	spotifyClientIdInput.focus();
	spotifyClientIdInput.select();
});

copyRedirectUriBtn.addEventListener('click', async () => {
	try {
		const redirectUri = spotifyRedirectUriInput?.value || latestSpotifySetupInfo?.redirectUri || '';
		if (!redirectUri) {
			return;
		}
		await navigator.clipboard.writeText(redirectUri);
	} catch (err) {
		console.error('Failed to copy Redirect URI:', err);
	}
});

openSpotifyDashboardBtn.addEventListener('click', async () => {
	try {
		await window.api.openSpotifyDeveloperDashboard();
	} catch (err) {
		console.error('Failed to open Spotify Developer Dashboard:', err);
	}
});

spotifyTooltipBtn.addEventListener('click', () => {
	spotifyTooltip.classList.toggle('show');
});

spotifyClientIdInput.addEventListener('input', () => {
	if (spotifyClientIdValidation.classList.contains('show')) {
		validateSpotifyClientIdInput({ showError: true });
	}
});

document.addEventListener('click', (event) => {
	if (!spotifyTooltip.classList.contains('show')) {
		if (confirmDialog.classList.contains('show') && event.target === confirmDialog) {
			hideConfirm();
		}
		return;
	}

	if (spotifyTooltip.contains(event.target) || spotifyTooltipBtn.contains(event.target)) {
		return;
	}

	spotifyTooltip.classList.remove('show');
});

confirmYes.addEventListener('click', () => {
	if (confirmAction) {
		confirmAction();
	}
});

confirmNo.addEventListener('click', () => {
	hideConfirm();
});

if (window.api && window.api.onThemeChanged) {
	// Listener is already wired by themeContext, this keeps setup.html symmetric with other windows.
}

if (window.api && window.api.onSpotifySetupChanged) {
	window.api.onSpotifySetupChanged((_event, info) => {
		renderSpotifySetup(info);
	});
}

if (window.api && window.api.onAuthed) {
	window.api.onAuthed(() => {
		isSpotifyAuthenticated = true;
		isEditingClientId = false;
		syncSetupState();
	});
}

if (window.api && window.api.onLoggedOut) {
	window.api.onLoggedOut(() => {
		isSpotifyAuthenticated = false;
		syncSetupState();
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadSpotifySetup);
} else {
	loadSpotifySetup();
}
