import {
  getCampaignsClient,
  getQuestionsClient,
  ensureTableExists,
  type CampaignEntity,
  type QuestionEntity,
} from './tableClient'

const NINJA_CAMPAIGN: CampaignEntity = {
  partitionKey: 'campaign',
  rowKey: 'ninja-naming',
  title: 'These four ninjas need names',
  description: 'Help us name our four ninja mascots by suggesting and voting for your favorites.',
  status: 'active',
  allowSuggestions: true,
  maxVotesTotal: 4,
  maxVotesPerCategory: 1,
  maxVotesPerCandidate: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const NINJA_QUESTIONS: QuestionEntity[] = [
  {
    partitionKey: 'ninja-naming',
    rowKey: 'ninja-1',
    title: 'Ninja 1',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja1.png',
    sortOrder: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    partitionKey: 'ninja-naming',
    rowKey: 'ninja-2',
    title: 'Ninja 2',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja2.png',
    sortOrder: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    partitionKey: 'ninja-naming',
    rowKey: 'ninja-3',
    title: 'Ninja 3',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja3.png',
    sortOrder: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    partitionKey: 'ninja-naming',
    rowKey: 'ninja-4',
    title: 'Ninja 4',
    description: 'This ninja needs a name.',
    imageUrl: '/mascots/ninja4.png',
    sortOrder: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

/**
 * Seed the default ninja-naming campaign and its four questions into Azure Table Storage
 * if they do not already exist.
 *
 * Uses upsertEntity (merge) so the operation is safe to call multiple times and race
 * conditions between concurrent cold-starts will not cause errors.
 */
export async function seedDefaultCampaign(): Promise<void> {
  const campaignsClient = getCampaignsClient()
  const questionsClient = getQuestionsClient()

  await Promise.all([ensureTableExists(campaignsClient), ensureTableExists(questionsClient)])

  // Check whether the ninja-naming campaign already exists.
  let campaignExists = false
  try {
    await campaignsClient.getEntity('campaign', 'ninja-naming')
    campaignExists = true
  } catch {
    // 404 or any error means it doesn't exist yet; proceed with seeding.
  }

  if (!campaignExists) {
    // upsertEntity with 'Replace' mode is idempotent: safe if another instance races us here.
    await campaignsClient.upsertEntity(NINJA_CAMPAIGN, 'Replace')
    await Promise.all(NINJA_QUESTIONS.map((q) => questionsClient.upsertEntity(q, 'Replace')))
  }
}
