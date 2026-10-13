# Security operations

## Choose the actual backend

The deployed bdsmarvel.com homepage was checked on 14 October 2026 and injects
`https://bdsmarvel.com/wp-json/bds/v1` as its API URL. Its authentication-status
endpoint returned HTTP 200. This deployment uses WordPress authentication.
The standalone FastAPI backend in this repository is a separate system.

For WordPress, change the administrator password through WordPress or the
WordPress.com account settings, and revoke existing sessions using that system.
The verified live administrator login is `infobdsmarvel`. No password was changed
during the repository audit. WordPress does not consume FastAPI's ADMIN_PASSWORD
or JWT_SECRET. Build the native plugin with `node scripts/build-wordpress.mjs`;
it receives the API URL from WordPress at runtime.

## Standalone FastAPI rotation

Run on the actual backend host, with the production MongoDB environment loaded.
Use a password manager to generate and retain a new password. Do not put it in
Git, chat, command arguments, or shell history.

1. Stop backend workers during the rotation window so old JWTs cannot keep
   accessing the service while credentials are changing.
2. Run `python backend/rotate_admin_password.py` and enter the new password at
   the hidden prompts. This updates the existing administrator's MongoDB hash
   and removes that account's database sessions. It does not create accounts,
   promote guests, or demote other administrators.
3. Set ADMIN_PASSWORD to that same password in the host's secret configuration.
   Replace JWT_SECRET with a fresh cryptographically random secret of at least
   32 bytes, stored in the host's secret manager.
4. Restart every backend worker with the new secret. Existing access and refresh
   JWTs will fail signature verification. Verify that the new password works,
   the old password fails, and previously issued tokens fail.

ADMIN_PASSWORD is only a seed value at startup. Changing it alone does not
change the database password. RESET_ADMIN_PASSWORD and TRUSTED_PROXY_HOPS are
not implemented by this backend; do not rely on them.

Configure TRUSTED_PROXY_CIDRS to the actual trusted reverse-proxy networks.
Leave it empty for direct connections; forwarded client addresses will then
be ignored. Do not guess the proxy networks.

For the legacy shell build, set REACT_APP_BACKEND_URL to the actual HTTPS
FastAPI origin before running scripts/build-wordpress.sh. It must not point to
the WordPress REST endpoint or an obsolete preview host.

## Git history

Rotate the exposed credential in the service that issued it before rewriting
history. A rewrite cannot revoke a working password or remove copies elsewhere.

The GitHub main branch checked on 14 October 2026 has one root snapshot and two
subsequent commits, including the security-fix merge. Older history is still
reachable through pull request #1, so checking only main is insufficient.
GitHub pull-request references cannot be rewritten by a normal force push.

When the exact exposed value is identified, use a fresh authenticated mirror
clone. Save a protected backup outside the repository. Enter the old value into
a temporary mode-0600 replacement file using a hidden prompt or secret manager;
do not use a shell command containing the actual password.

```sh
git clone --mirror https://github.com/groovixel/BMM.git BMM-clean.git
cd BMM-clean.git
git filter-repo --replace-text /secure/path/replacements.txt
```

Inspect the resulting diff and commit/ref map, and scan all rewritten branches
and tags for the exact exposed value before updating GitHub. Restore the origin
remote if filter-repo removed it. Push only the affected branch/tag refs with
explicit force-with-lease expectations matching their pre-rewrite remote SHAs;
do not use a blanket mirror force push. Coordinate fresh clones for collaborators.

If a pull-request ref or cached commit contains the exposed value, request
GitHub Support's sensitive-data removal after affected normal refs are cleaned.
Force-pushing alone cannot prove complete removal.

## Offline verification

```sh
python3 -m unittest discover -s backend/tests -p test_admin_rotation.py -v
python3 -m unittest discover -s backend/tests -p test_booking_security.py -v
```

These checks do not modify production accounts or prove that production
credentials have been rotated.
