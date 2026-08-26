# Release process

Releases use a hybrid flow so Apple credentials never leave the maintainer's
Mac:

1. A semantic-version tag starts GitHub Actions.
2. CI validates the tagged commit and builds attested Linux x64 and unsigned
   Windows x64 artifacts on native runners. CI does not create a release.
3. The maintainer's Mac downloads those successful CI artifacts, builds and
   notarizes both macOS architectures using the local Keychain, generates
   SHA-256 checksums, and creates a **draft** GitHub release.
4. Publishing the draft is always a separate human action.

The first planned release is `v0.1.0`. Unsigned Windows installers display a
Microsoft Defender SmartScreen warning; call that out in every release note.

## One-time setup

1. Rotate the Apple app-specific password that was committed in Finlyze. Never
   copy credentials, certificates, or passwords into this repository or GitHub
   Actions.
2. Keep the `Developer ID Application` certificate in the local login Keychain.
3. Store notarization credentials in a Keychain profile:

   ```bash
   xcrun notarytool store-credentials grok-build-notary
   ```

   Follow the prompts. The local release command also supports one complete
   App Store Connect API-key or Apple-ID environment-variable set, but the
   Keychain profile is preferred for a local-only workflow.
4. Authenticate the GitHub CLI with release access:

   ```bash
   gh auth login
   gh auth status
   ```

5. Protect `main`: require pull requests and the CI check, and disallow force
   pushes. Enable immutable releases before the first release is published.

The workflow pins Actions to full commit SHAs and grants only read plus artifact
attestation permissions. It has no repository or Apple secrets and cannot
create or publish a GitHub release.

## Prepare the release commit

1. Merge the intended changes to `main` and pull them locally.
2. Update `package.json` and `package-lock.json` to the same version. For a later
   release, this updates both files without creating a tag:

   ```bash
   npm version 0.1.1 --no-git-tag-version
   ```

3. Add user-facing release notes through merged PR titles and labels. GitHub's
   generated notes use `.github/release.yml`.
4. Run the local gate:

   ```bash
   npm ci
   npm run release:check -- v0.1.0
   npm run ci
   npm run package:dir
   ```

5. Launch the unpacked app from `release/`, open a real workspace, start and
   resume a Grok session, exercise a tool approval, inspect a diff, and verify
   the terminal.
6. Merge the version change, return to `main`, pull it, and confirm that
   `git status --short` is empty and `HEAD` exactly matches `origin/main`.

## Build CI artifacts

Create and push an annotated tag from the release commit:

```bash
git tag -a v0.1.0 -m "Grok Build v0.1.0"
git push origin v0.1.0
```

The tag starts `.github/workflows/release.yml`. It rejects a version that
differs from `package.json` or a commit that is not reachable from `main`, then
produces:

- `Grok Build-0.1.0-linux-x64.AppImage`
- `Grok Build-0.1.0-win-x64.exe` — unsigned NSIS installer

Wait for the complete Release workflow to succeed. The local release command
will refuse to continue if it cannot find a successful run for the tagged SHA.

## Assemble the draft locally

From the clean, tagged `main` checkout, run:

```bash
APPLE_KEYCHAIN_PROFILE=grok-build-notary npm run release:local -- v0.1.0
```

The command verifies the worktree, `origin/main`, tag, GitHub authentication,
and successful CI run. It downloads Linux and Windows artifacts, builds signed
and notarized macOS DMGs and ZIPs for x64 and arm64, creates `SHA256SUMS`, and
creates or updates a draft GitHub release. It never publishes the draft.

Test all three platforms before publishing. On macOS, verify the signature,
notarization, and stapled ticket:

```bash
codesign --verify --deep --strict --verbose=2 "/path/to/Grok Build.app"
spctl --assess --verbose --type exec "/path/to/Grok Build.app"
xcrun stapler validate "/path/to/Grok Build.app"
```

Verify the GitHub provenance of the CI-built artifacts:

```bash
gh attestation verify "/path/to/Grok Build-0.1.0-linux-x64.AppImage" --repo rkej/grok-build-gui
gh attestation verify "/path/to/Grok Build-0.1.0-win-x64.exe" --repo rkej/grok-build-gui
```

Verify every uploaded file against the locally generated manifest:

```bash
shasum -a 256 -c SHA256SUMS
```

## Publish or abort

Review the draft notes, list the supported architectures, call out the Grok CLI
prerequisite, and clearly disclose that Windows is unsigned. Click **Publish
release** only after the downloaded draft assets pass smoke tests.

If CI or local assembly fails, do not move or reuse the tag. Delete the failed
remote tag and draft, fix the issue on `main`, increment the patch version, and
create a new tag. Published immutable releases and their tags must never be
replaced.
