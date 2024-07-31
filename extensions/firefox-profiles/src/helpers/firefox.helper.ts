import GLib from 'gi://GLib';

const FIREFOX_PATH: string | null = findFirefoxPath();

/**
 * Find the path to the Firefox executable.
 * 
 * @returns {string|null} The path to Firefox or null if not found.
 */
function findFirefoxPath() {
    try {
        let [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync('which firefox');
        if (success && exitStatus === 0 && stdout) {
            return stdout.toString().trim();
        }
    } catch (e) {
        logError(e);
    }
    return null;
}

/**
 * Get Firefox profiles
 * @returns {Array} - Array of Firefox profiles
 */
export function getFirefoxProfiles(): string[] {
    let filePath = GLib.get_home_dir() + '/.mozilla/firefox/profiles.ini';
    let fileContent = GLib.file_get_contents(filePath)[1];
    let content = fileContent.toString();
    let namePattern = /Name=(.*)/g;
    let profiles: string[] = [];
    let match;

    while ((match = namePattern.exec(content)) !== null) {
        profiles.push(match[1]);
    }

    return profiles;
}

/**
 * Open Firefox with a specific profile.
 * 
 * It will call `firefox -P <profile> -no-remote`.
 * 
 * @param {string} profile name of the profile
 */
export function openFirefoxProfile(profile: string): void {
    if (FIREFOX_PATH === null) {
        logError('Firefox executable not found.');
        return;
    }

    GLib.spawn_async(
        null,
        [FIREFOX_PATH, '-P', profile, '-no-remote'],
        null,
        GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null
    );
}
