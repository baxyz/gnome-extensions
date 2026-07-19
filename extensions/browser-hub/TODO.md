# Browser Hub - TODO

**Derniere mise a jour:** 2026-07-19

---

## Robustesse

- [ ] Limiter la taille lue pour `zen-sessions.jsonlz4`, `profiles.ini` et
      `Local State` (Chromium) — un fichier corrompu ou anormalement gros ne
      devrait pas pouvoir ralentir/geler un scan.
- [ ] Limiter le nombre de fichiers `.sqlite` lus par profil (Firefox Profile
      Groups).
- [ ] Distinguer `NOT_FOUND` de `PERMISSION_DENIED` dans `logIfUnexpected`
      (`src/internal/gio.ts`) — un `~/.config` illisible merite un message
      different d'un fichier simplement absent.
- [ ] Inclure le nom du navigateur dans les erreurs de resolution
      (`firefox.ts`/`chromium.ts`/`falkon.ts`).

## UX

- [x] Message "No browsers found" plus utile (`menu.ts`) — ex. "No browsers
      found. Install a browser or check your settings."

## Avant publication sur extensions.gnome.org

- [ ] Tester avec Firefox + plusieurs profils
- [ ] Tester avec Chromium + plusieurs profils
- [ ] Tester avec Zen Browser (spaces) — verifier en particulier les couleurs
      de theme des workspaces et l'alignement des icones de profil dans le
      vrai popup GNOME Shell
- [ ] Tester avec GNOME Web (simple browser) — verifier que la rangee
      "Browsers" affiche bien toutes les icones
- [ ] Tester avec aucun navigateur installe
- [ ] Tester avec des permissions refusees sur `~/.config`
- [ ] Tester avec un fichier `profiles.ini` corrompu
- [ ] `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check` passent
- [ ] Le schema compile (`glib-compile-schemas`)
