# ElevenLabs Plans and API limits

What each ElevenLabs Plan allows, as it affects this app, and the errors each limit produces. ElevenLabs changes pricing and limits often: every fact carries its source, and the whole page was last checked on **2026-10-18**. Re-check the sources before relying on a number.

Facts marked **Verified live** come from calls this app made with real Free and Creator accounts on 2026-10-18. Where they contradict ElevenLabs' docs, the live result wins.

## Plans

| Plan | Price / month | API TTS characters / month | Custom voice slots | Monthly voice add/edit operations | Commercial use |
|---|---|---|---|---|---|
| Free | $0 | 10,000 | 3 | 55 (API reports 54) | No, and published content must credit ElevenLabs |
| Starter | $6 | 75,000 | 10 | 65 | Yes |
| Creator | $22 | 275,000 (API reports a 131,000 `character_limit`) | 30 | 95 | Yes |
| Pro | $99 | 1,238,000 | 160 | 290 | Yes |
| Scale | $299 | 3,738,000 | 660 | 1,040 | Yes |
| Business | $990 | 12,375,000 | 660 or 2,200 (sources disagree) | 1,040 | Yes |
| Enterprise | Custom | Custom | Custom | Custom | Yes |

- Characters: [pricing/api](https://elevenlabs.io/pricing/api). The main [pricing](https://elevenlabs.io/pricing) page counts "credits" instead and gives lower numbers; no page publishes the conversion. What an account really has is `character_limit` from `GET /v1/user/subscription`, which the app shows in the sidebar.
- Voice slots and operations: [voice slots help article](https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it.md).
- Licence and attribution: [terms of use](https://elevenlabs.io/terms-of-use), [publishing help article](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform).
- Going over quota: self-serve plans can top up with Pay As You Go (prepaid, from $5, top-ups expire after 12 months). Without balance, requests fail as soon as the quota runs out; there is no postpaid overage on new self-serve plans. [Pay As You Go](https://elevenlabs.io/docs/overview/administration/pay-as-you-go), [usage-based billing](https://elevenlabs.io/docs/help-center/account/general/what-is-usage-based-billing.md).

## Voices

- **Library Voices are not available via the API on the Free Plan.** Verified live: generating with a Library Voice on a Free account fails with `402 payment_required` / `paid_plan_required` ("Free users cannot use library voices via the API"), even when the voice is saved in that account. Default Voices work. [Voice Library](https://elevenlabs.io/docs/eleven-creative/voices/voice-library).
- **A Library Voice does not need to be saved before use.** Verified live: a Creator account generated with a Library Voice it had never saved, and ElevenLabs then saved it to the account on its own.
- **Library Voices and Default Voices do not use custom voice slots.** Verified live: a Creator account with 5 saved Library Voices reports `voice_slots_used: 0`. Slots are only used by voices made with Voice Design or Voice Cloning, which this app does not create. So the app never frees slots or deletes voices from the account. [Voice slots](https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it.md).
- **Voice ids are global.** Verified live: the same Default Voice or Library Voice has the same `voice_id` in every account.
- Saving or editing a voice uses one of the Plan's monthly voice add/edit operations.
- When an owner stops sharing a Library Voice, accounts that saved it keep it for the notice period (30 days to 2 years); it then disappears. `GET /v1/voices/{voice_id}` shows the date in `disable_at_unix`.
- Some Library Voices are paid-only or have a credit multiplier (a 2x voice costs twice the characters).

## TTS Models

| Model id | Characters per request | Notes |
|---|---|---|
| `eleven_v4` | 10,000 | ElevenLabs documents it only for Text to Dialogue. Verified live: works on `POST /v1/text-to-speech/{voice_id}` on Free and Creator. |
| `eleven_v4_turbo` | Not stated | Documented only for the Text to Dialogue websocket. Not yet verified on the TTS endpoint. |
| `eleven_v3` | 5,000 (another page says 3,000) | |
| `eleven_multilingual_v2` | 10,000 | Default model of the TTS endpoint. |

No Plan restricts which TTS Model can be used. Source: [models](https://elevenlabs.io/docs/overview/models), [changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28).

### Context (`previous_text` / `next_text`)

The app sends each Audio Part with unspoken context: a scene describing the bingo call, plus the other part. `eleven_v3` does not support it ("request stitching"), so the app sends v3 the bare text. ElevenLabs does not say whether context characters count against the quota; the `character-cost` response header tells. SSML `<break>` tags do not work in v3 or v4. Source: [TTS convert](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [request stitching](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching), [controls](https://elevenlabs.io/docs/best-practices/prompting/controls), 2026-10-18.

## Concurrent requests

| Plan | Multilingual v2 (and, to be safe, v3/v4) | Flash |
|---|---|---|
| Free | 2 | 4 |
| Starter | 3 | 6 |
| Creator | 5 | 10 |
| Pro | 10 | 20 |
| Scale / Business | 15 | 30 |
| Enterprise | Elevated | Elevated |

Going over the limit returns `429`. The app sends at most 2 requests at once (Word and Digit), so this only matters on the Free Plan. Source: [models](https://elevenlabs.io/docs/overview/models), [429 help article](https://elevenlabs.io/docs/help-center/technical/api-error-code-429).

## Audio formats

The app always requests `mp3_44100_128`, which every Plan allows. Higher formats need a higher Plan:

- `mp3_44100_192`: Creator or higher.
- `pcm_44100` / `wav_44100`: Pro or higher.

Source: [text-to-speech convert](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

## Free Plan abuse block

ElevenLabs may disable Free Plan usage permanently when it sees "unusual activity", typically from a shared IP (VPN, office, carrier). Only a paid Plan or another IP fixes it. The exact error code is not documented. [Help article](https://elevenlabs.io/docs/help-center/account/general/what-does-unusual-activity-detected-free-tier-usage-disabled-if-you-are-using-proxy-vpn-you-might-need-to-purchase-a-paid-plan-to-not-trigger-our-abuse-detectors-mean.md).

## API key permissions

ElevenLabs API keys can be restricted. The app needs:

| Permission | Used for |
|---|---|
| `text_to_speech` | Generating audio |
| `voices_read` | Listing Default Voices and Library Voices |
| `voices_write` | Saving Library Voices in the account (the app never deletes voices) |
| `user_read` | Showing the Plan and quota, and checking the key when an account is added |

Verified live: a key without `voices_read` gets `401 authentication_error` / `unauthorized` ("missing the permission voices_read"). When an account is added, the app requires `user_read` (`GET /v1/user/subscription`) and probes `voices_read` with `GET /v2/voices?page_size=1&voice_type=default` (no side effects). A missing `voices_read` saves the account with a warning. `text_to_speech` and `voices_write` are only named in the warning: checking them would spend characters or save a voice.

## Errors

Current shape ([errors](https://elevenlabs.io/docs/eleven-api/resources/errors)), verified live:

```json
{"detail": {"type": "payment_required", "code": "paid_plan_required", "message": "…", "status": "payment_required", "request_id": "…"}}
```

Switch on `detail.code`, falling back to the HTTP status. `detail.status` is legacy: in the current shape it repeats the type, not the specific code. Older help-center pages still show `{"detail": {"status": "…", "message": "…"}}`, and validation errors can come back as a `422` list.

| HTTP | `code` | Meaning for this app |
|---|---|---|
| 400 | `text_too_long`, `invalid_voice_settings`, `invalid_output_format`, `unsupported_model`, … | Bad request |
| 401 | `invalid_api_key`, `unauthorized` | Wrong key, or the key lacks a permission |
| 402 | `insufficient_credits` | Character quota used up |
| 402 | `paid_plan_required` | Library Voice used on the Free Plan (not in the official list; verified live) |
| 403 | `subscription_required`, `feature_not_available`, `voice_access_denied`, `model_access_denied` | The Plan does not allow it |
| 404 | `voice_not_found` | Voice no longer exists (e.g. its owner stopped sharing it) |
| 429 | `concurrent_limit_exceeded` | Too many requests at once: wait for the others to finish |
| 429 | `rate_limit_exceeded`, `system_busy` | Retry with backoff |
| 500 / 503 | `internal_error`, `service_unavailable`, `maintenance` | Retry later |

A `402` is not always quota: `paid_plan_required` and `insufficient_credits` share the status. `voice_limit_reached` is no longer in the official list; the app treats it as any other API error.
