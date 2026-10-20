# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability or include exploit details, credentials, tokens, personal data, or private provider responses in a public discussion.

Use the repository's private vulnerability-reporting channel from the **Security** tab when it is available. If private reporting is not enabled, open a minimal public issue that contains no sensitive details and asks the maintainers for a private contact channel.

Include only the information needed to reproduce and assess the issue through a private channel:

- a short description of the affected behavior;
- affected versions, commit, or deployment context;
- reproduction steps or a minimal proof of concept;
- the potential impact; and
- any suggested mitigation.

Please allow maintainers reasonable time to investigate, prepare a fix, and coordinate disclosure before sharing details publicly.

## Secret handling

- Never commit `.env` files, API keys, access tokens, cookies, or credentials.
- Keep server-only provider secrets out of browser code and `VITE_*` variables.
- If a secret is exposed, revoke or rotate it immediately through the provider and notify maintainers privately.
- Redact secrets and personal data from logs, screenshots, issue reports, and pull requests.

## Supported versions

Until the project publishes a formal release-support policy, security fixes are evaluated against the latest code on the default branch and the most recent published release, when one exists. Older versions may require upgrading before a fix can be provided.
