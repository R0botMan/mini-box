# Mini Box

MiniBox is a lightweight desktop media companion designed to stay accessible while you work, study, game, or browse. MiniBox provides a compact always-on-top overlay that lets you control music quickly without constantly switching between windows.

## Spotify Mode
Control Spotify playback directly from your desktop with quick access to queue previews, volume controls, and next-song notifications.
<img width="702" height="498" alt="MiniBox - Spotify Mode" src="https://github.com/user-attachments/assets/659ee796-8f4c-425d-9d41-73caac462e70" />

## Local Mode
Play and manage local audio files through MiniBox’s lightweight overlay interface.
<img width="672" height="416" alt="MiniBox - Local Mode" src="https://github.com/user-attachments/assets/5edd7c02-f670-44d3-ae80-5a226432e76a" />

## Download

**[Download Latest Release](../../releases/latest)**

**Security Note:** Only download from the [official releases](../../releases/latest) on this repository. Always verify the repository URL before installation.

## Features

These are the features of the app:

- Lightweight and minimal desktop overlay
- Control music without switching windows
- Always-on-top floating media companion
- Spotify and local audio support
- Transparent draggable interface
- Queue preview and next-song notifications
- Theme customization and desktop pets
- Smooth onboarding and setup flow

## Requirements

- Windows 10 or later
- Spotify Premium account required for Spotify playback controls
- Internet connection

## Installation

1. Download the latest `.exe` file from [Releases](../../releases/latest)
2. Run the installer and follow the prompts
3. Launch Mini Box from your Start Menu
4. Log in with your Spotify account on the popup
5. Enjoy your mini player!

## Usage

- **Drag the window** to move it around your screen
- **Play/Pause** - Click the play button
- **Skip songs** - Use next/previous buttons
- **Volume control** - Adjust your playback volume
- **Queue Window** - Click the queue button to see the current song and the next 2 upcoming songs
- **Next Song Preview** - A message appears 15 seconds before the current song ends showing what's playing next
- **Minimize** - Window stays on top of other apps

## Troubleshooting

**"Login failed"**
- Make sure you have an active internet connection
- Try restarting the app

**"No music playing"**
- Make sure Spotify is running on another device or browser
- Check if you have an active playback device selected in Spotify

**"No music playing" after login or restart**
- **Private Session**: If Spotify's Private Session is enabled, MiniBox cannot see the currently playing track (this is a Spotify API restriction). Disable Private Session in Spotify to use MiniBox
- Restart MiniBox after disabling Private Session

**MiniBox shows "Disconnected" after restart**
- Close MiniBox completely and reopen it
- Use Settings → **"Clear Cache"** to reset credentials if having persistent issues
- Then log in again

**For detailed debugging:**
- Check `%TEMP%\minibox-debug.log` for error details

## Version History

- **v1.2.1** - Pet variation, fixes, queue layout repair
- **v1.2.0** - Spotify setup, themes, pets, onboarding, UI improvements
- **v1.1.9** - Authentication fixes
- **v1.1.8** - Improved next-song marquee loop and duplicate-title scrolling
- **v1.1.7** - Local audio mode, source switching, app modular refactor, and auth/session hardening
- **v1.1.6** - Patch notes window
- **v1.1.5** - Private session detection, cache clearing, debug logging
- **v1.1.0** - Settings, Queue, Next-song message 
- **v1.0.0** - Initial release with core features

## Known Limitations

- Spotify Private Sessions disable playback visibility for third-party apps, including MiniBox
- Spotify Premium is required for playback control functionality
- Windows only (for now)

## License
ISC
---

Made with ❤️ for Spotify lovers
