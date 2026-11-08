# Uploadmanifest — Coach 2.10.1 (herstelronde)

ZIP: `coach-2.10.1.zip` — bestanden direct in de root (geen extra hoofdmap). Geen `.git`, geen `node_modules`, geen testuitvoer, geen secrets, **geen echte spelersgegevens** (alle bestanden en patches gescand: 0 treffers).

Repo-bestanden: 66 (+ dit manifest). T.o.v. `main@9b74826`: 49 nieuw, 8 gewijzigd, 9 ongewijzigd. T.o.v. 2.10.0: 15 nieuw, 20 gewijzigd. Daarnaast 14 patchbestanden.

## Uploaden (aanbevolen: één onderwerp per PR, eigenaar merget)

Volgorde vanaf `main`:

| Stap | Patch(es) | Opmerking |
|---|---|---|
| 1 | `release/patches/2.10.0/0001…0009` | Reeks 2.10.0 (zoals eerder opgeleverd, opnieuw opgebouwd zonder namen in de context). Per onderwerp een PR, of samen. |
| 2 | `2.10.1-herstel/P1-startdata-anonimiseren.patch` | Na `git am -3`: `node tools/maak-fictieve-startdata.js --schrijf && git commit --amend -a --no-edit`. **Als eerste mergen.** |
| 3 | `P2-…`, `P3-…`, `P4-…` | Onafhankelijk; elk los toe te passen op 2.10.0 (`git am -3`), in elke volgorde. |
| 4 | `P5-samenvoeging-2.10.1-na-P1-P4.patch` | Versie 2.10.1, hulpscript + stappenplan Git-geschiedenis, browserstap AI-preview, rapporten. Vereist P1–P4. |
| 5 | — | Daarna pas: `docs/GIT_GESCHIEDENIS_OPSCHONEN.md` (handmatig). |

Gecontroleerd: deze route vanaf `main` levert exact dezelfde bestanden op als deze ZIP, behalve dit manifest (boomvergelijking).

Alternatief via de GitHub-webinterface: branch maken, bestanden met status *nieuw*/*gewijzigd* uploaden naar dezelfde paden, één PR. `release/patches/` hoort niet in de repo.

## Patches

| Bestand | Bytes | SHA-256 |
|---|---|---|
| `release/patches/2.10.0/0001-Back-up-en-herstel-inclusief-Kennis-Ontwikkeling-all.patch` | 21522 | `abb6ddce86b093a6067625c09ee4df2b680560b40d2c6c4ce970113796de97e0` |
| `release/patches/2.10.0/0002-Sync-basisversie-bijhouden-zodat-stille-autosync-zon.patch` | 18962 | `5b089a6d3324809d14203a19bfefebcf81698b70bc19dbddfe40f381974c6371` |
| `release/patches/2.10.0/0003-Coachassistent-alleen-lokale-AI-Ollama-gepseudonimis.patch` | 24183 | `02e7e2619fb22ed4c93c299008952a8d34b1b60df986d50c8993c7e3eef980fb` |
| `release/patches/2.10.0/0004-Versie-2.10.0-service-worker-cache-pdf.js-zonder-eva.patch` | 24380 | `fdf9c548894e37fb95a187f494ff3d5d73b4bc607f9c26c77ab987fd8b2b081f` |
| `release/patches/2.10.0/0005-Supabase-referentieschema-coach_data_auth-voorstel-c.patch` | 25038 | `c8561f0b5e3075865221e5116d2d11f5d6327f2d6e87b4771935179b3a7ce7a3` |
| `release/patches/2.10.0/0006-Optionele-Chromium-browsertest-desktop-iPhone-iPad-e.patch` | 7374 | `2a879c8bb881f57fe1b548e87632fa13c9cba3e3d4dd97e624010a8a606762b4` |
| `release/patches/2.10.0/0007-Browsertest-XSS-controle-met-kwaadaardige-namen-en-t.patch` | 3520 | `2a6f10c7390137f373e04318cb4e3524d9cd4346eba0ad7358946bd1ee0cc905` |
| `release/patches/2.10.0/0008-Documentatie-2.10.0-README-AGENTS-CLAUDE-architectuu.patch` | 60432 | `6f88b75bbfb308a91dc63a3665d965927d138ec7905c573f0e59815b3c6ba5a5` |
| `release/patches/2.10.0/0009-Testverslag-2.10.0.patch` | 4722 | `3fc86b9db745c179b9b940cb9bd8303bc7860d6a79e7eaa869aed1c0e544e790` |
| `release/patches/2.10.1-herstel/P1-startdata-anonimiseren.patch` | 80040 | `f674d1e0ceea976a150638a4bb24eccb38277dfd7f2822977b991b58cc5512f7` |
| `release/patches/2.10.1-herstel/P2-supabase-verificatie.patch` | 29884 | `6c1c8d7069d359fd507fa3236d8e5470ea99adf3cbddf1ed1804f2bc91443e9f` |
| `release/patches/2.10.1-herstel/P3-sync-veiligheidsrem.patch` | 24531 | `7f3d888e53fdaf6269cde0a10eaf674717ec5eec6c888de64566c60522b5c23f` |
| `release/patches/2.10.1-herstel/P4-ai-privacy.patch` | 23804 | `fbfb5c224f403f973f01994f87170da2a2b08c06884ff65fb497b78da1a89629` |
| `release/patches/2.10.1-herstel/P5-samenvoeging-2.10.1-na-P1-P4.patch` | 56727 | `494ef66ee6bbb2e97e178828edf4f7cbc9c0cbca87935a30f383cb82c4d23da3` |

## Bestanden

| Pad | t.o.v. main | t.o.v. 2.10.0 | Bytes | SHA-256 |
|---|---|---|---|---|
| `.env.example` | nieuw | – | 652 | `561982931bd33951d2a401c3cb57445aa7d8fb7349f386b98ae0e5322f6f2550` |
| `.github/workflows/tests.yml` | ongewijzigd | – | 928 | `c92294cbbc4264045dbaed2dd2b76a1a2f96326ede1eedb6ae435bed8a1da4e8` |
| `.gitignore` | nieuw | – | 37 | `52e83b0c60930c06cc69e2790f7917b6114a707d0aebb1eedb0700e65931da4b` |
| `AGENTS.md` | nieuw | gewijzigd | 2463 | `a456713da45b6aaa88af828c6e1cafd3eb92ff72fd41eb8448a3f9f311e8489e` |
| `CHANGELOG.md` | nieuw | gewijzigd | 4811 | `9ee160be2333fdc6cef61a8491fcd74451ef1309c3dde1ff032c11d60bf64461` |
| `CLAUDE.md` | nieuw | – | 387 | `f6e2c4951c4fec4160a0f3d8c6c7b8e42ee74fbbca7f29dc2158f2a3a9ba0795` |
| `LEESMIJ.md` | gewijzigd | – | 11649 | `62cda3aada765f5d668dceb41d3bd600274195f2848fd0b6e3cb1ee156f7626d` |
| `README.md` | nieuw | gewijzigd | 4935 | `690d30281976da33c9c43ba5356abb7c2eeab764f941cda55cbf39d0ccf834c3` |
| `ai-privacy.test.js` | nieuw | nieuw | 5033 | `beb4d974b3406bba37926347bf87a43bb40bb1a1feae06d8e273070238ff03ce` |
| `ai.test.js` | nieuw | gewijzigd | 7047 | `fee6cd7346a2f2457730b5622add92ac0e83f905e624ea5175a64a2ab0f90f27` |
| `app.js` | gewijzigd | gewijzigd | 508680 | `d9cb4c870d33ec0542bec20566195470c121c3f280bf4f5b9071206b4bfbe1a6` |
| `app.test.js` | ongewijzigd | – | 41121 | `4c68496da0f937a1257b84b45afb951880f485d1ce46a5f8917fba82d12b5c70` |
| `backup.test.js` | nieuw | – | 8388 | `7e0eb48011836ba1112b61d508dece9d18cb9f06fe496abeccebd8dc4eb29e7a` |
| `docs/API_INTEGRATIONS.md` | nieuw | – | 6039 | `6cb8350994db851253f5965017e9d78db20cb6da3b432685c9808947cc1bdf0a` |
| `docs/ARCHITECTURE.md` | nieuw | – | 5119 | `b09bd507b54c32628de7b6b7732851727e9d4d6b05bc29b2be356f79808e5dbf` |
| `docs/BACKUP_RESTORE.md` | nieuw | – | 3675 | `816ea551a46b8911dbde0f1f67f1d152ed30bd14c0978270937b3a7569ef9f7a` |
| `docs/DATAMODEL.md` | nieuw | – | 5045 | `2a2483f596d75ccbb40bcbec8fd7e495acbd9b749002fb275f4459064bf0156c` |
| `docs/GIT_GESCHIEDENIS_OPSCHONEN.md` | nieuw | nieuw | 8191 | `6e9ea784ebfeb2d5dc203079821f3a24c0ecf79bede198fede8fba0186b6b225` |
| `docs/HUISSTIJL_VOORSTEL.md` | nieuw | – | 1669 | `b57c992ebde3e3c2ed0e24a667a706cf1f28cb7afe7695b28d11d6bf6d566565` |
| `docs/INSTALLATIE.md` | nieuw | – | 1820 | `06f4d3fb0304fb38c5be581fcd713dd1a16416e21d642a80b6ec984e446f6dac` |
| `docs/RELEASE.md` | nieuw | gewijzigd | 1994 | `04d86a4e44bed1d58b06f41a612221813a69301fb758a10ef218e974159b7569` |
| `docs/SECURITY.md` | nieuw | gewijzigd | 5541 | `5db42264767780529deb616359ed12b48118d165d05d589f60845225295ace04` |
| `docs/SUPABASE.md` | nieuw | gewijzigd | 9278 | `e9af0bb0ac7c320d3a7c2a94a6c3dcd12c7fe7f35972accea22be2476877e4ef` |
| `docs/TESTING.md` | nieuw | gewijzigd | 3364 | `0ddd98bf1df285d4e0e8844c23d2ad5c7491938d0d85782c602603ae9be295ab` |
| `docs/patches/P1-startdata-anonimiseren.md` | nieuw | nieuw | 3640 | `5a55987cdd7c9fe3df023b1d30983bdf05326212210886613cf1b7f5b6121354` |
| `docs/patches/P2-supabase-verificatie.md` | nieuw | nieuw | 4153 | `9373a59089ade24641064424014ecc5492a598b6934275e2506bdcb7552f0881` |
| `docs/patches/P3-sync-veiligheidsrem.md` | nieuw | nieuw | 2585 | `2ca74dc9e968f5b4095f9a78203c71fc107b1c9367e26440d290b71e1733b23c` |
| `docs/patches/P4-ai-privacy.md` | nieuw | nieuw | 2917 | `35de0b30fea0a09bec5afd47175eb453ccf6778dc8eb4b9ab1c50b312f40b99e` |
| `docs/screenshots/wedstrijdblad-a4.png` | ongewijzigd | – | 114966 | `cb1ef832904d38639b8570c58e11780209cd3af0d1267f844efdff967560f4be` |
| `docs/screenshots/wedstrijdblad-iphone.png` | ongewijzigd | – | 106024 | `5a5ecb5e45e8b3dc0dd71d416c1dafe2691ca11d5b57b62eb20861da35ef21e6` |
| `docs/screenshots/wedstrijdblad-whatsapp.png` | ongewijzigd | – | 162086 | `56cbc0b925e8f9944d16a8bed54e6dffb98beac8bd22bf8f23c825306b5be3c6` |
| `harness.js` | gewijzigd | – | 3865 | `fdf4e9497f9d45b7340c95826e344a0fdabcfe97c95d8f9127db313aa40b29ee` |
| `historie-inventaris.test.js` | nieuw | nieuw | 3687 | `b02460eaafa5344de95b281591482eebd6abcbba92d331d63b2a943625d87e6d` |
| `icon-192.png` | ongewijzigd | – | 1913 | `c27bcc294fbbc5c2ce49c2c78e86e47c127aac5b5f7dfd7bf061df7fc59fb33d` |
| `icon-512.png` | ongewijzigd | – | 5380 | `9697ae498b18daa54376c67e3b7da2102373b801f6434f7315b5448cd3e96689` |
| `index.html` | gewijzigd | gewijzigd | 5291 | `5ccbd363351d9494979d7fbc67148792219626404e76b307ec2577e6ccb5add9` |
| `kennis.js` | ongewijzigd | – | 25534 | `f02880c17cc10648c32dc9dcf885d0d273c8b24bbd15ed5ec6879ffa19f37862` |
| `kennis.test.js` | ongewijzigd | – | 16444 | `fe2f1f1c82e9e59e71b6ca01256d48d58540291c0bad03a140219d1c708f8091` |
| `manifest.json` | gewijzigd | gewijzigd | 503 | `930d9bb60fb9fd1ea6daa6a09c1dda441b4d3810c436d0f510580ac70a808e92` |
| `package.json` | gewijzigd | gewijzigd | 304 | `ebe9f95d0b69bbce3a44ed2a37e016b028a32d7c669c3d11157dae41f9b17238` |
| `rekenregels.test.js` | nieuw | gewijzigd | 5870 | `3807f4d00de062393ea4333df145efc33378c879e28b43a33a0cd5cec0a390d6` |
| `release/TESTVERSLAG.md` | nieuw | gewijzigd | 4364 | `4e682bf042f147b0ad6a33377b4a054ff6d6719f83a1f60ac82dd96decbf6825` |
| `release/VERGELIJKINGSRAPPORT.md` | nieuw | nieuw | 3509 | `f6b537eaa88ecaa768ce325c5285457db80bc04a43c0218d223d6c766f7bee2b` |
| `sleutels.test.js` | nieuw | nieuw | 4168 | `cb37b1c76ebdc1b5a634db57d18b533e52e8e7269d262752f6afe17fd5e3b62e` |
| `startdata.test.js` | nieuw | nieuw | 4679 | `fea6cc0dc837dea2fed118eeb14cb632fd2620516e7a24ee5af0a772092481eb` |
| `static.test.js` | nieuw | gewijzigd | 4563 | `461dadaa18b5ccf7dfa338d02c40e646182d2c59f06ec62ecebdb77abfa825ae` |
| `style.css` | gewijzigd | – | 53114 | `5affc61d1633a3f4857e8bb7d9307cc203e3225fb68e6c11696ba9594360f518` |
| `supabase/proposals/0002_coach_knowledge_owner_only.rollback.sql` | nieuw | – | 719 | `02b51088ea5e33aafa5b50b7d62ed15855acacc032ca2e396e3b41a2914cb143` |
| `supabase/proposals/0002_coach_knowledge_owner_only.sql` | nieuw | – | 2098 | `015dd936e4be2e780f94c0b4a09ddfeba857f2e5a853cd247bfb354a9d579ca6` |
| `supabase/reference/0001_coach_data_auth.rollback.sql` | nieuw | – | 431 | `e84940b356421309f327ebada6e9d980f5f21d362ed1381a72f37d981b9cd538` |
| `supabase/reference/0001_coach_data_auth.sql` | nieuw | – | 3387 | `7bc96de608b1bd6df394cf9b27650103d6d9a972df4bd96b012bc90d3228808c` |
| `supabase/tests/00_supabase_stub.sql` | nieuw | – | 2020 | `141b81b11abf0ea1dd9e20fce168cb2d248f8063b44ca3e3a774fb83e67b6a4f` |
| `supabase/tests/10_coach_data_auth.test.sql` | nieuw | – | 3203 | `51d5317c5554ea81c626e518fec103032777d1236ebaa77783a48dee0e58a755` |
| `supabase/tests/20_storage_current.test.sql` | nieuw | – | 1346 | `b36f43dad037049314bd16fef31c4a6e5291ffda15527a19c2e33af0e114cb74` |
| `supabase/tests/30_storage_proposal.test.sql` | nieuw | – | 2236 | `b9519efd2074b324ec3a44cde52169c3e79d3a7bb38f1a1a4d081d3ed53a9bb1` |
| `supabase/tests/40_verify_scenario.sh` | nieuw | nieuw | 1049 | `deec27051c119f86d4c08db10e7f625e83e52b83fd7737b7b5bc4f604309d282` |
| `supabase/tests/run-local.sh` | nieuw | gewijzigd | 4647 | `e13aaca7f028640dcd989482a699557268dfefb3680629894a834c1e228f72fa` |
| `supabase/verify/verify-production.sql` | nieuw | gewijzigd | 9385 | `d45a134a800d329dec9b642cfe45add57928b3d06d91c0be26a8f073840aef9a` |
| `sw.js` | gewijzigd | gewijzigd | 1576 | `1b042cf4226b22b0b22bd8a9cf64474b60aceb484d5bae95f3df5fa7499d1b75` |
| `sync-veiligheid.test.js` | nieuw | nieuw | 9900 | `fbf6cd9e8bc6a20a1fcad3877324de86c5356a9f4498622058beb810a2161016` |
| `sync.test.js` | nieuw | – | 6662 | `44318c08e04fbefe21ae20f1d2ea084d10ac8eee77b392e277fe7bdb92f35aa1` |
| `tests/e2e/chromium.e2e.js` | nieuw | gewijzigd | 10198 | `7492f24c6f75b735a09e08286b64f4c9839b073e8b4820c22baf23069f074ff4` |
| `tests/fixtures/rekenregels-dataset.json` | nieuw | nieuw | 57044 | `fdfbcdfb29dc5e3d5b0fad6fcaeafa443a9f3e51eb934078656e91091d6eb8eb` |
| `tests/fixtures/rekenregels-golden.json` | nieuw | gewijzigd | 934 | `5a2576f07ddfa915c874594cbb07e37ed84b20ef1d3d3805f32297cedc0bcd38` |
| `tools/historie-inventaris.js` | nieuw | nieuw | 5712 | `f737934842064806a9551771e510c8049c2d37594abc7b1c32ea62fb21b69794` |
| `tools/maak-fictieve-startdata.js` | nieuw | nieuw | 5937 | `1cf1da352bc96676c9e952389d8f267aece506d4fe619495bf5cc4308e771ff3` |

Controleren na uitpakken: `sha256sum <bestand>` en vergelijken met de tabel.
