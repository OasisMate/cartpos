import ReceiveListForm from '@/components/purchases/ReceiveListForm'

export default function ReceivePurchaseListPage({ params }: { params: { id: string } }) {
  return <ReceiveListForm listId={params.id} />
}
