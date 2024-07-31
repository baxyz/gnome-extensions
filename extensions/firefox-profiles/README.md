# Firefox Profiles

This GNOME extension simplifies the launching of Firefox profiles from the indicator menu.

## Description

The **Firefox Profiles** extension allows you to easily launch different Firefox profiles directly from the GNOME indicator menu. This is particularly useful for users who manage multiple Firefox profiles for different tasks or identities.

## Installation

1. Download the extension from the [GNOME Extensions](https://extensions.gnome.org/) website
2. Extract the downloaded file into the GNOME extensions directory

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/firefox-profiles@baxyz.tech
unzip firefox-profiles.zip -d ~/.local/share/gnome-shell/extensions/firefox-profiles@baxyz.tech
```

## Testing Locally

To test the extension locally, create a symbolic link to the extension directory:

```bash
ln -s /path/to/your/extension ~/.local/share/gnome-shell/extensions/firefox-profiles@baxyz.tech
```

Replace /path/to/your/extension with the actual path to your extension directory.

Follow the official documentation on [testing the extension](https://gjs.guide/extensions/development/creating.html#testing-the-extension). It provides detailed instructions on how to set up and test the extension.

### Wayland Sessions

Wayland sessions support running GNOME Shell in window, so an extension can be tested without disrupting the current session.

Start a nested GNOME Shell session:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

Open a terminal inside the new session and enable the extension    


```bash
gnome-extensions enable firefox-profiles@baxyz.tech
```
