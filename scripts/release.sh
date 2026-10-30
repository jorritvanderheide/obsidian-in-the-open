#!/usr/bin/env bash
# Make a release, the same way in each of the six repositories:
#
#   scripts/release.sh [--dry-run] <x.y.z> "<what the release is>" ["<body>"]
#
# Run it with an empty working-copy change on top of the commits to release,
# and the release notes under `## Unreleased` in CHANGELOG.md. It writes the
# release commit in that change (CHANGELOG.md, the version, npmDepsHash), runs
# the checks, and stops before anything is pushed if one fails or a guard
# trips. A plugin (one with a manifest.json) is then pushed and tagged, its
# GitHub release built, checked and published. The core is pushed, and tagged
# once CI on the GitHub mirror has passed on it, since the plugins don't run
# its checks again.
#
# --dry-run does everything up to the push, then puts the repository back as
# it was.
set -euo pipefail

github_owner=jorritvanderheide

dry_run=false
if [ "${1:-}" = "--dry-run" ]; then
	dry_run=true
	shift
fi
version=${1:-}
summary=${2:-}
body=${3:-}

fail() {
	echo "release: $*" >&2
	exit 1
}

[ -n "$version" ] && [ -n "$summary" ] || fail 'usage: scripts/release.sh [--dry-run] <x.y.z> "<what the release is>" ["<body>"]'
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || fail "$version isn't a version like 1.2.3"
cd "$(dirname "$0")/.."

# A bare @word becomes a mention of a real account on GitHub. Code spans are
# taken out first, since `@key` in backticks is fine.
# shellcheck disable=SC2016 # the backticks are meant literally: code spans
bare_at() {
	sed 's/`[^`]*`//g' | grep -nE '(^|[^A-Za-z0-9_./-])@[A-Za-z0-9_-]' || true
}

subject="$version: $summary"
[ ${#subject} -lt 72 ] || fail "the subject is ${#subject} characters, and has to be under 72: $subject"
message=$subject
[ -n "$body" ] && message=$(printf '%s\n\n%s' "$subject" "$body")
[ -z "$(printf '%s' "$message" | bare_at)" ] || fail "the message has a bare @, which GitHub reads as a mention: $(printf '%s' "$message" | bare_at)"

[ -z "$(jj diff --summary)" ] || fail "the working-copy change isn't empty; finish it with jj new first"
grep -q '^## Unreleased$' CHANGELOG.md || fail "CHANGELOG.md has no ## Unreleased"
notes=$(awk '$0 == "## Unreleased" { on = 1; next } /^## / { on = 0 } on' CHANGELOG.md)
grep -q '[^[:space:]]' <<<"$notes" || fail "## Unreleased in CHANGELOG.md is empty"
[ -z "$(bare_at <<<"$notes")" ] || fail "the release notes have a bare @, which GitHub reads as a mention: $(bare_at <<<"$notes")"

remote=$(git remote get-url codeberg)
repo=$(basename "$remote" .git)
jj git fetch --remote codeberg >/dev/null 2>&1
jj log -r 'main@codeberg & ::@' --no-graph -T 'commit_id' | grep -q . || fail "main on Codeberg has commits that aren't under this change; fetch and rebase first"
start=$(jj op log -n 1 --no-graph -T 'id')

restore() {
	jj op restore "$start" >/dev/null
	echo "release: put back as it was"
}

echo "release: writing $subject"
jj describe -m "$message" >/dev/null
sed -i "s/^## Unreleased\$/## $version/" CHANGELOG.md
npm version "$version" --no-git-tag-version >/dev/null

if grep -q 'npmDepsHash = "' flake.nix; then
	hash=$(nix run nixpkgs#prefetch-npm-deps -- package-lock.json 2>/dev/null | tail -1)
	[[ $hash == sha256-* ]] || { $dry_run && restore; fail "prefetch-npm-deps gave no hash: $hash"; }
	sed -i "s|npmDepsHash = \"[^\"]*\";|npmDepsHash = \"$hash\";|" flake.nix
fi

# The flake check runs the lint and the tests, against the pinned pandoc in the
# core; the build or type check is the one thing it doesn't.
check() {
	if [ -f manifest.json ]; then npm run build >/dev/null; else npm run typecheck >/dev/null; fi
	jj st >/dev/null
	nix flake check -L >/tmp/release-flake-check.log 2>&1
}
echo "release: checking"
check || { $dry_run && restore; fail "a check failed; see /tmp/release-flake-check.log, and fix it in this change or a new one"; }

if $dry_run; then
	echo "release: everything checks out; a real run would push $(jj log -r @ --no-graph -T 'commit_id.short()') as main and tag $version"
	restore
	exit 0
fi

jj bookmark set main -r @ >/dev/null
jj git push --remote codeberg -b main
commit=$(jj log -r main --no-graph -T 'commit_id')

# Waits for the run of a workflow on GitHub, by the commit or tag it ran for,
# and fails when that run did.
wait_for() {
	local workflow=$1 field=$2 value=$3 id=""
	for _ in $(seq 1 90); do
		id=$(gh run list -R "$github_owner/$repo" --workflow "$workflow" --limit 10 --json databaseId,headSha,headBranch \
			-q ".[] | select(.$field == \"$value\") | .databaseId" | head -1)
		[ -n "$id" ] && break
		sleep 10
	done
	[ -n "$id" ] || fail "no $workflow run on GitHub for $value after 15 minutes; is the mirror pushing?"
	gh run watch -R "$github_owner/$repo" "$id" --exit-status >/dev/null || fail "the $workflow run for $value failed: https://github.com/$github_owner/$repo/actions/runs/$id"
}

if [ ! -f manifest.json ]; then
	echo "release: waiting for CI on the GitHub mirror before tagging"
	wait_for ci.yml headSha "$commit"
	jj tag set "$version" -r main >/dev/null
	git push codeberg "$version"
	echo "release: $version tagged; move each plugin's pin to it"
	exit 0
fi

jj tag set "$version" -r main >/dev/null
git push codeberg "$version"
echo "release: waiting for the release run"
wait_for release.yml headBranch "$version"

files=$(mktemp -d)
gh release download "$version" -R "$github_owner/$repo" -D "$files"
for file in "$files"/*; do
	gh attestation verify "$file" --repo "$github_owner/$repo" --format json >/dev/null || fail "$(basename "$file") doesn't verify against its attestation; the draft is left unpublished"
done
rm -rf "$files"

gh release edit "$version" -R "$github_owner/$repo" --draft=false >/dev/null
echo "release: published $(gh release view "$version" -R "$github_owner/$repo" --json url -q .url)"
