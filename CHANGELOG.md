# Changelog

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
