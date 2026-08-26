# Release process

Releases are built on GitHub-hosted runners from a semantic-version tag. The
workflow signs and notarizes macOS packages, builds Linux AppImages, creates
GitHub artifact attestations and SHA-256 checksums, and stops at a **draft**
GitHub release. Publishing is always a separate human action.

The first planned release is `v0.1.0`. Windows is not part of the first release
because the project does not yet have a Windows package target or signing
identity.

## One-time repository setup

1. Rotate the Apple app-specific password that was committed in Finlyze. Never
   copy credentials, certificates, or passwords into this repository.
2. In GitHub, create a `release-signing` environment. Restrict deployment tags
   to `v*`, add a required reviewer, and store the macOS credentials there.
3. Create a `release-draft` environment, restrict it to `v*`, and add a required
   reviewer. It needs no secrets; the workflow uses its short-lived
   `GITHUB_TOKEN` with only `contents: write` for the draft job.
4. Protect `main`: require pull requests and the CI check, and disallow force
   pushes. Enable immutable releases before the first release is published.

Pinning Actions to full commit SHAs, environment approvals, job-scoped token
permissions, draft-first releases, and artifact attestations are intentional
supply-chain controls for a public repository.

### macOS secrets

Use an App Store Connect API key for notarization when possible:

| Environment secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | Base64-encoded Developer ID Application `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_API_KEY` | Base64-encoded App Store Connect `.p8` key |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_TEAM_ID` | Apple Developer team ID |

The workflow also supports `APPLE_ID` and a newly generated
`APPLE_APP_SPECIFIC_PASSWORD` instead of the three API-key secrets. Do not set
both notarization methods. The signing identity itself already exists in the
local login keychain and can be exported as a password-protected `.p12` using
Keychain Access. Encode exported files without printing them to the terminal:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
base64 -i AuthKey_KEYID.p8 | pbcopy
```

Paste clipboard contents directly into the matching GitHub environment secret,
then securely remove the exported files.

## Prepare a release

1. Merge the intended release commit to `main` and pull it locally.
2. Update `package.json` and `package-lock.json` to the same version. For a later
   release, `npm version 0.1.1 --no-git-tag-version` updates both files.
3. Add user-facing release notes through merged PR titles and labels. GitHub's
   generated notes use `.github/release.yml`.
4. Run the complete local gate:

   ```bash
   npm ci
   npm run release:check -- v0.1.0
   npm run ci
   npm run package:dir
   ```

5. Launch the unpacked app from `release/`, open a real workspace, start and
   resume a Grok session, exercise a tool approval, inspect a diff, and verify
   the terminal. Packaging is not considered verified from unit tests alone.
6. Confirm `git status --short` is empty and the commit is on `origin/main`.

## Build the draft

Only after the checklist passes, create and push an annotated tag:

```bash
git tag -a v0.1.0 -m "Grok Build v0.1.0"
git push origin v0.1.0
```

The tag starts `.github/workflows/release.yml`. Approve the two protected
environments when prompted. The workflow rejects a tag whose version differs
from `package.json` or whose commit is not reachable from `origin/main`.

When the workflow finishes, download and test the assets from the draft release
on supported machines. On macOS, also verify Apple's assessment:

```bash
spctl --assess --type open --context context:primary-signature -vv "/path/to/Grok Build.dmg"
```

Verify provenance and checksums before publishing:

```bash
gh attestation verify "/path/to/Grok Build-0.1.0-mac-arm64.dmg" --repo rkej/grok-build-gui
sha256sum --check SHA256SUMS
```

On macOS use `shasum -a 256 -c SHA256SUMS` if `sha256sum` is unavailable.

## Publish or abort

Review the generated notes, call out the Grok CLI prerequisite, and list the
supported operating systems. Publishing the GitHub draft is the only step that
makes the binary release public.

If validation fails, do not move or reuse the tag. Delete the failed remote tag
and draft, fix the issue on `main`, increment the patch version, and create a new
tag. Published immutable releases and their tags must never be replaced.
