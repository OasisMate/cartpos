import type { PrismaClient } from '@prisma/client'

/** Full delete like domain deleteSale — removes stock lines, customer ledger, payments, lines, invoice */
export async function deleteInvoicePhysically(
  prisma: PrismaClient,
  invoiceId: string,
  shopId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    })

    if (!invoice || invoice.shopId !== shopId) {
      throw new Error(`Invoice ${invoiceId} not found or wrong shop`)
    }

    const lineIds = invoice.lines.map((line) => line.id)

    if (lineIds.length) {
      await tx.stockLedger.deleteMany({
        where: {
          refType: 'invoice_line',
          refId: { in: lineIds },
        },
      })
    }

    await tx.stockLedger.deleteMany({
      where: {
        refType: 'invoice_void',
        refId: invoice.id,
      },
    })

    await tx.customerLedger.deleteMany({
      where: {
        refId: invoice.id,
        refType: { in: ['invoice', 'invoice_void'] },
      },
    })

    await tx.payment.deleteMany({
      where: { invoiceId: invoice.id },
    })

    await tx.invoiceLine.deleteMany({
      where: { invoiceId: invoice.id },
    })

    await tx.invoice.delete({
      where: { id: invoice.id },
    })
  })
}
