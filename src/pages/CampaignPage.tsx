import { useParams } from 'react-router-dom'
import App from '../App'

export function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  return <App campaignId={campaignId!} />
}
