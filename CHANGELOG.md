# Changelog

## [2.1.0](https://github.com/krevindiou/bagheera/compare/v2.0.0...v2.1.0) (2026-11-27)


### Features

* **web:** collapse closed banks on the accounts page ([3e4a805](https://github.com/krevindiou/bagheera/commit/3e4a8051fef16c04c79fa8acae144e68ce141c7a))


### Bug Fixes

* **web:** wait for accounts and reword the close-bank confirmation ([800e256](https://github.com/krevindiou/bagheera/commit/800e2565f1400f8e22a5f32c48c84ca91ef07432))

## [2.0.0](https://github.com/krevindiou/bagheera/compare/v1.0.4...v2.0.0) (2026-11-25)


### ⚠ BREAKING CHANGES

* **backup:** backups no longer run from GitHub Actions. The new backup service needs at least one destination configured in docker/prod.env (BACKUP_* variables) or BACKUP_DISABLED=true, otherwise make deploy fails at the backup-validate pre-deploy step. The secrets BACKUP_SSH_PRIVATE_KEY, DEPLOY_HOST and DEPLOY_HOST_KNOWN_HOSTS and the host-side backup user are no longer used. The bagheera-backup GHCR package must be made public after its first publish.

### Features

* **backup:** add backup image, test harness and config validation ([c9a643a](https://github.com/krevindiou/bagheera/commit/c9a643a6e9c1ebb5bf3a6e25bf9a808501865826))
* **backup:** add backup-run with the restic destination ([c46acc4](https://github.com/krevindiou/bagheera/commit/c46acc4e5d8d53759f319b6f364d75e53f221801))
* **backup:** add entrypoint, scheduler, SFTP material and healthcheck ([43bd8b4](https://github.com/krevindiou/bagheera/commit/43bd8b43022a1feedaa5709ec7493a29b687fe07))
* **backup:** add failure alerts, success report and weekly restic check ([2bcc5e1](https://github.com/krevindiou/bagheera/commit/2bcc5e1c3594b5b842097fe99fff6c9fa41c5ced))
* **backup:** add the age-encrypted email destination ([462f522](https://github.com/krevindiou/bagheera/commit/462f522a26b176b435e97625d0a4cdc77983efb9))
* **backup:** replace the GitHub-triggered backup with the backup container ([d5c0a9d](https://github.com/krevindiou/bagheera/commit/d5c0a9d11e9c3a0a95f0c6970bb941c80276d35d))
* **backup:** wire the backup service into the stack, CI and image pipeline ([04b3f81](https://github.com/krevindiou/bagheera/commit/04b3f81eb2ee9cb900a74a6adbfd1efeb68250d6))


### Bug Fixes

* **backup:** fix review findings ([be46d4b](https://github.com/krevindiou/bagheera/commit/be46d4bb375d4502eaf6fba988476104755ebb2e))
* **backup:** harden after the final review ([7b14880](https://github.com/krevindiou/bagheera/commit/7b1488085b993b5ef333d1459417d8e173a3d3f8))

## [1.0.4](https://github.com/krevindiou/bagheera/compare/v1.0.3...v1.0.4) (2026-11-19)


### Miscellaneous Chores

* release 1.0.4 ([706234b](https://github.com/krevindiou/bagheera/commit/706234b151587348df262fec2eb0d3c7bf8a3502))

## [1.0.3](https://github.com/krevindiou/bagheera/compare/v1.0.2...v1.0.3) (2026-11-19)


### Bug Fixes

* **ci:** let the e2e containers write to the runner checkout ([e9cd497](https://github.com/krevindiou/bagheera/commit/e9cd4970cec506912d66f7ed2b0b0b71f53cce38))

## [1.0.2](https://github.com/krevindiou/bagheera/compare/v1.0.1...v1.0.2) (2026-11-19)


### Bug Fixes

* **e2e:** build workspace packages and bound the api health wait ([84704b0](https://github.com/krevindiou/bagheera/commit/84704b0b5576b25635f1f289c07ae3856bca9270))

## [1.0.1](https://github.com/krevindiou/bagheera/compare/v1.0.0...v1.0.1) (2026-11-19)


### Features

* **reference-data:** add bakery, bars, butcher, markets and wine food categories ([2e31938](https://github.com/krevindiou/bagheera/commit/2e31938fcc4c9f6e0e7c2d819ecd2a6339829b19))
* **web:** show the account balances after an import in its preview ([2a309a6](https://github.com/krevindiou/bagheera/commit/2a309a684ff44d6e60bb6fd9e306113c70705e41))


### Bug Fixes

* **api:** keep a report narrowed when its only accounts were deleted ([1280265](https://github.com/krevindiou/bagheera/commit/12802654ffd086746a913c3d36adea6504cda566))
* **ci:** prefix the pinned Snyk CLI version with v ([71d9e27](https://github.com/krevindiou/bagheera/commit/71d9e278c30c7f75922437486ad9a6f641725a24))
* **deps:** dedupe unplugin ([cadff45](https://github.com/krevindiou/bagheera/commit/cadff45d77b8c834107333ae69cb49cbb51f3ddd))
* **deps:** force esbuild &gt;=0.28.1 and minimatch &gt;=11.0.1 ([7c1228a](https://github.com/krevindiou/bagheera/commit/7c1228a701e21672e2a37007d4a72096182cb598))
* **deps:** update minor and patch updates ([8391a7a](https://github.com/krevindiou/bagheera/commit/8391a7a81b72a96b8f77f6a276881d4ca1d755c1))
* **deps:** upgrade nodemailer to 10.5.0 and force qs &gt;=6.16.2 ([ddef129](https://github.com/krevindiou/bagheera/commit/ddef129c2e04048ad2a01eed4c808337ff547b33))
* **web:** keep each tab's operation search paging on its own criteria ([a6ae382](https://github.com/krevindiou/bagheera/commit/a6ae382077e42925169615301409b1b1cded41b8))
* **web:** keep the dashboard on screen when a chart range change fails ([433e2f4](https://github.com/krevindiou/bagheera/commit/433e2f4df0100b53f85f8925b65c60604aaeb899))
* **web:** reload an open report chart when its report is saved ([d26a6d3](https://github.com/krevindiou/bagheera/commit/d26a6d3f6d8fe872022e3bfe6914e678fa12ba93))
* **web:** step back to the last page when a schedulers page comes back empty ([38e2a0f](https://github.com/krevindiou/bagheera/commit/38e2a0f20fe80629411958916f739ca0043cae98))
* **web:** step back to the last page when an operations page comes back empty ([0542408](https://github.com/krevindiou/bagheera/commit/0542408f06666121638ca1f82645587c7df1c196))
* **web:** store the time zone that was sent, not one picked while saving ([1374285](https://github.com/krevindiou/bagheera/commit/1374285d8b6370333bf91133430b83c03b3196f8))


### Performance Improvements

* **api:** index the operation payee for contains searches ([717e100](https://github.com/krevindiou/bagheera/commit/717e1009a39bde19d21d6f53b246ca6003f55682))


### Miscellaneous Chores

* release 1.0.1 ([9ab96f8](https://github.com/krevindiou/bagheera/commit/9ab96f8de4d2afe21ea8b67b67b61eb73a6ec461))


### Continuous Integration

* publish images on release-please releases instead of every push ([c1a4220](https://github.com/krevindiou/bagheera/commit/c1a4220a5925b3d4b96809c3ee6ee7494f95f82b))

## 1.0.0 (2026-11-18)


### Features

* **reference-data:** add bakery, bars, butcher, markets and wine food categories ([2e31938](https://github.com/krevindiou/bagheera/commit/2e31938fcc4c9f6e0e7c2d819ecd2a6339829b19))
* **web:** show the account balances after an import in its preview ([2a309a6](https://github.com/krevindiou/bagheera/commit/2a309a684ff44d6e60bb6fd9e306113c70705e41))


### Bug Fixes

* **api:** keep a report narrowed when its only accounts were deleted ([1280265](https://github.com/krevindiou/bagheera/commit/12802654ffd086746a913c3d36adea6504cda566))
* **ci:** prefix the pinned Snyk CLI version with v ([71d9e27](https://github.com/krevindiou/bagheera/commit/71d9e278c30c7f75922437486ad9a6f641725a24))
* **deps:** dedupe unplugin ([cadff45](https://github.com/krevindiou/bagheera/commit/cadff45d77b8c834107333ae69cb49cbb51f3ddd))
* **deps:** force esbuild &gt;=0.28.1 and minimatch &gt;=11.0.1 ([7c1228a](https://github.com/krevindiou/bagheera/commit/7c1228a701e21672e2a37007d4a72096182cb598))
* **deps:** update minor and patch updates ([8391a7a](https://github.com/krevindiou/bagheera/commit/8391a7a81b72a96b8f77f6a276881d4ca1d755c1))
* **deps:** upgrade nodemailer to 10.5.0 and force qs &gt;=6.16.2 ([ddef129](https://github.com/krevindiou/bagheera/commit/ddef129c2e04048ad2a01eed4c808337ff547b33))
* **web:** keep each tab's operation search paging on its own criteria ([a6ae382](https://github.com/krevindiou/bagheera/commit/a6ae382077e42925169615301409b1b1cded41b8))
* **web:** keep the dashboard on screen when a chart range change fails ([433e2f4](https://github.com/krevindiou/bagheera/commit/433e2f4df0100b53f85f8925b65c60604aaeb899))
* **web:** reload an open report chart when its report is saved ([d26a6d3](https://github.com/krevindiou/bagheera/commit/d26a6d3f6d8fe872022e3bfe6914e678fa12ba93))
* **web:** step back to the last page when a schedulers page comes back empty ([38e2a0f](https://github.com/krevindiou/bagheera/commit/38e2a0f20fe80629411958916f739ca0043cae98))
* **web:** step back to the last page when an operations page comes back empty ([0542408](https://github.com/krevindiou/bagheera/commit/0542408f06666121638ca1f82645587c7df1c196))
* **web:** store the time zone that was sent, not one picked while saving ([1374285](https://github.com/krevindiou/bagheera/commit/1374285d8b6370333bf91133430b83c03b3196f8))


### Performance Improvements

* **api:** index the operation payee for contains searches ([717e100](https://github.com/krevindiou/bagheera/commit/717e1009a39bde19d21d6f53b246ca6003f55682))


### Continuous Integration

* publish images on release-please releases instead of every push ([c1a4220](https://github.com/krevindiou/bagheera/commit/c1a4220a5925b3d4b96809c3ee6ee7494f95f82b))
