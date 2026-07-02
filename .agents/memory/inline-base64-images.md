---
name: Inline base64 images & body limits
description: This app stores uploaded images as inline base64 data URLs, which interacts badly with default request body limits and silent-failing forms.
---

# Images are stored as inline base64 data URLs

Account (and potentially other) images are uploaded client-side via `FileReader.readAsDataURL` and sent/stored as a `data:image/...;base64,...` string in the `imageUrl` field — NOT object storage.

## Consequences to remember

- **Body limit:** a base64 image easily exceeds Express's default 100kb JSON limit, causing `POST`/`PATCH` to return **413**. The server sets `express.json({ limit: "10mb" })` / `express.urlencoded({ limit: "10mb" })` in `artifacts/api-server/src/app.ts`. Any new image-accepting endpoint must stay under that ceiling.
- **Why forms looked "broken":** mutation forms without an `onError` handler fail silently — the dialog only closes on `onSuccess`, so a rejected request looks like "clicking save does nothing." Always add `onError` (toast) to create/update forms.

**How to apply:** when adding image upload or a new create/update form, (1) confirm the body limit covers the payload, and (2) give the mutation an `onError` so failures surface instead of silently leaving the dialog open.
