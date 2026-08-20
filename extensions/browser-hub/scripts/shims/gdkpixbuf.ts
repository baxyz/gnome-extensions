// internal/desktop-icon.ts's isDecodableIconFile() probe uses this to reject
// icon files that fail to decode — this dev script has no real icon files to
// probe, so assume every candidate decodes fine (matches the test suite's
// own GdkPixbuf mock pattern, e.g. test/default-browser.test.ts).
export default {
  Pixbuf: {
    new_from_file_at_size: () => ({ get_width: () => 1, get_height: () => 1 }),
  },
};
