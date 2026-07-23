# Image Management Guide

Images in this platform are stored as URL strings in Azure Table Storage. No code changes or redeployment are required to add or change images.

---

## Which entities can own images

| Entity | Field | Where it renders |
|---|---|---|
| **Campaign** | `bannerImageUrl` | Hero section (top of the campaign page) |
| **Question** (category) | `imageUrl` | Question card thumbnail and suggestion board header |
| **Suggestion** (candidate) | `imageUrl` | Candidate avatar in the suggestion board and leaderboard |

All image fields are **optional**. Missing values are handled gracefully — the UI renders a placeholder or simply omits the image element.

---

## Supported URL formats

| Format | Example | Notes |
|---|---|---|
| **HTTPS URL** | `https://myaccount.blob.core.windows.net/container/image.png` | Recommended for external images |
| **Relative path** | `/mascots/ninja1.png` | Serves from the app's `public/` folder |
| **Azure CDN** | `https://myendpoint.azureedge.net/image.png` | Same as HTTPS, CDN-cached |

**Not allowed:**
- `http://` — insecure; triggers mixed-content browser warnings
- `data:` — data URIs are not supported
- Any other scheme (e.g. `ftp://`, `javascript:`)

---

## How to add or change an image (without redeployment)

### Option A — Azure Portal

1. Open [Azure Portal](https://portal.azure.com) → your Storage Account → **Storage browser** → **Tables**.
2. Select the relevant table (`campaigns`, `questions`, or `suggestions`).
3. Find the row you want to update:
   - **Campaign banner**: `campaigns` table → `PartitionKey = 'campaign'`, `RowKey = <campaignId>`
   - **Question image**: `questions` table → `PartitionKey = <campaignId>`, `RowKey = <questionId>`
   - **Candidate image**: `suggestions` table → `PartitionKey = '<campaignId>|<questionId>'`, `RowKey = <suggestionId>`
4. Click **Edit entity**.
5. Add or update the `imageUrl` (or `bannerImageUrl`) field with the new URL.
6. Click **Update**.

The next page load will use the new image immediately — no restart required.

### Option B — Azure Storage Explorer

1. Open [Azure Storage Explorer](https://azure.microsoft.com/en-us/products/storage/storage-explorer/).
2. Connect to your storage account.
3. Navigate to **Tables** → select the relevant table.
4. Find and edit the row as described above.

### Option C — Azure CLI

```bash
# Update a campaign's banner image
az storage entity merge \
  --account-name <account> \
  --table-name campaigns \
  --entity PartitionKey=campaign RowKey=ninja-naming bannerImageUrl=https://example.com/banner.png

# Update a question's image
az storage entity merge \
  --account-name <account> \
  --table-name questions \
  --entity PartitionKey=ninja-naming RowKey=ninja-1 imageUrl=https://example.com/ninja1-new.png
```

---

## Using Azure Blob Storage for images

1. In your Azure Storage Account, create a **Blob container** (e.g. `campaign-assets`).
2. Set the container's **access level** to **Blob (anonymous read access for blobs only)**.
3. Upload your image file to the container.
4. Copy the blob URL (e.g. `https://<account>.blob.core.windows.net/campaign-assets/ninja1.png`).
5. Set this URL as the `imageUrl` field via any method above.

The API does not need the Azure Blob SDK. Images are served directly to browsers over HTTPS.

---

## Fallback behaviour

| Scenario | Behaviour |
|---|---|
| `bannerImageUrl` absent or empty | Hero section renders without a banner image |
| Question `imageUrl` absent | Question card renders without a thumbnail |
| Candidate `imageUrl` absent | Candidate row renders without an avatar |
| Invalid URL scheme | Image field is rejected at campaign creation/update time with a validation error |
