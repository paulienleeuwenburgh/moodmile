/**
 * Admin API endpoints.
 *
 * All routes require the X-Admin-Secret header to match the ADMIN_SECRET environment
 * variable. The secret is never included in any API response. If ADMIN_SECRET is not
 * configured, all admin routes return 501 Not Implemented.
 *
 * Authentication model:
 *   - ADMIN_SECRET is stored as an Azure Functions application setting (environment variable).
 *   - The header value is typed by the admin user into a password input in the admin UI;
 *     it is kept in React component state only and is never written to localStorage or cookies.
 *   - All traffic is HTTPS-only (enforced by Azure Static Web Apps), preventing interception.
 *   - This is a shared API key model suitable for "no Entra ID yet" phase. When Entra ID is
 *     added, replace requireAdminSecret() with token validation.
 *
 * Routes:
 *   DELETE /api/admin/suggestions
 *     Body: { campaignId, questionId, suggestionId, deletedBy?, deleteReason? }
 *     Soft-deletes a candidate. The suggestion row is kept; isDeleted is set to true.
 *     Existing vote rows are preserved — vote history remains explainable.
 *     The candidate no longer appears in GET /api/suggestions or rankings.
 *     Votes already cast for the candidate are NOT refunded to users' budgets.
 *
 *   POST /api/admin/suggestions/restore
 *     Body: { campaignId, questionId, suggestionId }
 *     Restores a soft-deleted candidate. Sets isDeleted = false and clears delete metadata.
 *     The candidate reappears with its original vote count intact.
 *     Voting resumes as normal; users who voted before deletion can vote again (or revoke).
 *
 *   DELETE /api/admin/campaigns/{campaignId}/votes
 *     Removes all vote rows for the campaign and resets every suggestion's vote counter to 0.
 *     Suggestions (including soft-deleted ones) are preserved.
 *
 *   DELETE /api/admin/campaigns/{campaignId}/suggestions
 *     Soft-deletes all active (non-deleted) suggestions for the campaign.
 *     Also removes all vote rows for the campaign and resets vote counters to 0.
 *     Rationale: keeping soft-deleted rows means vote rows still reference valid suggestion IDs,
 *     making historical data explainable. Hard deletion would leave orphaned vote rows.
 *
 *   POST /api/admin/campaigns/{campaignId}/reset
 *     Full campaign reset: removes all votes AND soft-deletes all suggestions.
 *     Campaign configuration (title, status, voting rules) is untouched.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  ensureTableExists,
  entityToSuggestion,
  getSuggestionsClient,
  getVotesClient,
  SuggestionEntity,
  VoteEntity,
  suggestionPartitionKey,
} from '../tableClient'
import { escapeODataString } from '../odata'

// ─── Auth helper ─────────────────────────────────────────────────────────────

function requireAdminSecret(request: HttpRequest): HttpResponseInit | null {
  const configured = process.env.ADMIN_SECRET
  if (!configured) {
    return {
      status: 501,
      jsonBody: { error: 'Admin functionality is not configured on this server.' },
    }
  }
  const provided = request.headers.get('x-admin-secret')
  if (!provided || provided !== configured) {
    return { status: 401, jsonBody: { error: 'Unauthorized' } }
  }
  return null
}

// ─── DELETE /api/admin/suggestions ───────────────────────────────────────────

async function deleteSuggestion(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const body = (await request.json()) as {
    campaignId?: string
    questionId?: string
    suggestionId?: string
    deletedBy?: string
    deleteReason?: string
  }
  const { campaignId, questionId, suggestionId, deletedBy, deleteReason } = body

  if (!campaignId || !questionId || !suggestionId) {
    return {
      status: 400,
      jsonBody: { error: 'campaignId, questionId, and suggestionId are required.' },
    }
  }

  const client = getSuggestionsClient()
  await ensureTableExists(client)
  const partitionKey = suggestionPartitionKey(campaignId, questionId)

  // Find the suggestion (including already-deleted ones to give a clear error)
  let found = false
  let alreadyDeleted = false
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: {
      filter: `PartitionKey eq '${escapeODataString(partitionKey)}' and RowKey eq '${escapeODataString(suggestionId)}'`,
    },
  })) {
    found = true
    alreadyDeleted = entity.isDeleted === true
    break
  }

  if (!found) {
    return { status: 404, jsonBody: { error: 'Suggestion not found.' } }
  }
  if (alreadyDeleted) {
    return { status: 409, jsonBody: { error: 'Suggestion is already deleted.' } }
  }

  await client.updateEntity(
    {
      partitionKey,
      rowKey: suggestionId,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: deletedBy ?? '',
      deleteReason: deleteReason ?? '',
    },
    'Merge',
  )

  return { status: 200, jsonBody: { success: true } }
}

// ─── POST /api/admin/suggestions/restore ─────────────────────────────────────

async function restoreSuggestion(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const body = (await request.json()) as {
    campaignId?: string
    questionId?: string
    suggestionId?: string
  }
  const { campaignId, questionId, suggestionId } = body

  if (!campaignId || !questionId || !suggestionId) {
    return {
      status: 400,
      jsonBody: { error: 'campaignId, questionId, and suggestionId are required.' },
    }
  }

  const client = getSuggestionsClient()
  await ensureTableExists(client)
  const partitionKey = suggestionPartitionKey(campaignId, questionId)

  // Verify the suggestion exists and is actually deleted
  let found = false
  let isDeleted = false
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: {
      filter: `PartitionKey eq '${escapeODataString(partitionKey)}' and RowKey eq '${escapeODataString(suggestionId)}'`,
    },
  })) {
    found = true
    isDeleted = entity.isDeleted === true
    break
  }

  if (!found) {
    return { status: 404, jsonBody: { error: 'Suggestion not found.' } }
  }
  if (!isDeleted) {
    return { status: 409, jsonBody: { error: 'Suggestion is not deleted.' } }
  }

  // Clear all soft-delete fields. Azure Table Storage Merge mode ignores missing properties,
  // so we must explicitly set them to empty strings / false to clear them.
  await client.updateEntity(
    {
      partitionKey,
      rowKey: suggestionId,
      isDeleted: false,
      deletedAt: '',
      deletedBy: '',
      deleteReason: '',
    },
    'Merge',
  )

  return { status: 200, jsonBody: { success: true } }
}

// ─── DELETE /api/admin/campaigns/{campaignId}/votes ──────────────────────────

async function resetCampaignVotes(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const campaignId = request.params.campaignId
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId is required.' } }
  }

  await doResetVotes(campaignId)
  return { status: 200, jsonBody: { success: true } }
}

// ─── DELETE /api/admin/campaigns/{campaignId}/suggestions ────────────────────

async function resetCampaignSuggestions(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const campaignId = request.params.campaignId
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId is required.' } }
  }

  // Soft-delete all suggestions, then remove all votes.
  await doSoftDeleteAllSuggestions(campaignId)
  await doResetVotes(campaignId)
  return { status: 200, jsonBody: { success: true } }
}

// ─── POST /api/admin/campaigns/{campaignId}/reset ────────────────────────────

async function fullCampaignReset(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const campaignId = request.params.campaignId
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId is required.' } }
  }

  await doSoftDeleteAllSuggestions(campaignId)
  await doResetVotes(campaignId)
  return { status: 200, jsonBody: { success: true } }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Remove all vote rows for a campaign and reset vote counters to 0 on all suggestions.
 * Vote rows are partitioned by "{campaignId}|{sessionId}", so we use a range scan.
 */
async function doResetVotes(campaignId: string): Promise<void> {
  const votesClient = getVotesClient()
  const suggestionsClient = getSuggestionsClient()
  await Promise.all([ensureTableExists(votesClient), ensureTableExists(suggestionsClient)])

  // Delete all vote rows for this campaign.
  // Votes are partitioned by "{campaignId}|{sessionId}" — different partition keys per session,
  // so batch operations cannot be used. Each row is deleted individually.
  const voteFilter = `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~'`
  const deletePromises: Promise<unknown>[] = []
  for await (const entity of votesClient.listEntities<VoteEntity>({
    queryOptions: { filter: voteFilter },
  })) {
    deletePromises.push(
      votesClient.deleteEntity(entity.partitionKey as string, entity.rowKey as string),
    )
  }
  await Promise.all(deletePromises)

  // Reset vote counters on all suggestions (including soft-deleted ones, for consistency).
  const suggestionFilter = `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~'`
  const resetPromises: Promise<unknown>[] = []
  for await (const entity of suggestionsClient.listEntities<SuggestionEntity>({
    queryOptions: { filter: suggestionFilter },
  })) {
    if ((entity.votes ?? 0) !== 0) {
      resetPromises.push(
        suggestionsClient.updateEntity(
          {
            partitionKey: entity.partitionKey as string,
            rowKey: entity.rowKey as string,
            votes: 0,
          },
          'Merge',
        ),
      )
    }
  }
  await Promise.all(resetPromises)
}

/**
 * Soft-delete all non-deleted suggestions for a campaign.
 * Deleted suggestions retain their row and vote count for audit purposes.
 */
async function doSoftDeleteAllSuggestions(campaignId: string): Promise<void> {
  const client = getSuggestionsClient()
  await ensureTableExists(client)

  const filter = `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~' and isDeleted ne true`
  const now = new Date().toISOString()
  const promises: Promise<unknown>[] = []

  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: { filter },
  })) {
    promises.push(
      client.updateEntity(
        {
          partitionKey: entity.partitionKey as string,
          rowKey: entity.rowKey as string,
          isDeleted: true,
          deletedAt: now,
          deletedBy: 'admin-reset',
          deleteReason: 'campaign reset',
        },
        'Merge',
      ),
    )
  }
  await Promise.all(promises)
}

// ─── GET /api/admin/suggestions?campaignId=X ─────────────────────────────────

/**
 * Returns all soft-deleted suggestions for a campaign.
 * Used by the admin UI to list restorable candidates.
 */
async function getDeletedSuggestions(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const authError = requireAdminSecret(request)
  if (authError) return authError

  const campaignId = request.query.get('campaignId')
  if (!campaignId) {
    return { status: 400, jsonBody: { error: 'campaignId query parameter is required.' } }
  }

  const client = getSuggestionsClient()
  await ensureTableExists(client)

  const filter = `PartitionKey ge '${escapeODataString(campaignId)}|' and PartitionKey lt '${escapeODataString(campaignId)}~' and isDeleted eq true`
  const deleted = []
  for await (const entity of client.listEntities<SuggestionEntity>({
    queryOptions: { filter },
  })) {
    deleted.push({
      ...entityToSuggestion(entity),
      isDeleted: true,
      deletedAt: entity.deletedAt,
      deletedBy: entity.deletedBy,
      deleteReason: entity.deleteReason,
    })
  }

  return {
    status: 200,
    jsonBody: deleted,
    headers: { 'Content-Type': 'application/json' },
  }
}

// ─── Route registrations ──────────────────────────────────────────────────────

app.http('adminGetDeletedSuggestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/suggestions',
  handler: getDeletedSuggestions,
})

app.http('adminDeleteSuggestion', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'admin/suggestions',
  handler: deleteSuggestion,
})

app.http('adminRestoreSuggestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/suggestions/restore',
  handler: restoreSuggestion,
})

app.http('adminResetCampaignVotes', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'admin/campaigns/{campaignId}/votes',
  handler: resetCampaignVotes,
})

app.http('adminResetCampaignSuggestions', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'admin/campaigns/{campaignId}/suggestions',
  handler: resetCampaignSuggestions,
})

app.http('adminFullCampaignReset', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/campaigns/{campaignId}/reset',
  handler: fullCampaignReset,
})
