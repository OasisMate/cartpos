import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic'

export default async function StockReportPage() {
    const user = await getCurrentUser()
    if (!user?.currentShopId) {
        redirect('/')
    }

    const shopId = user.currentShopId

    // Fetch products that track stock
    const products = await prisma.product.findMany({
        where: {
            shopId,
            trackStock: true,
        },
        select: {
            id: true,
            name: true,
            barcode: true,
            costPrice: true,
            price: true,
            unit: true,
        },
    })

    // Fetch stock levels from ledger
    const stockLevels = await prisma.stockLedger.groupBy({
        by: ['productId'],
        _sum: { changeQty: true },
        where: { shopId },
    })

    // Map stock levels to products
    const stockMap = new Map(stockLevels.map((s) => [s.productId, Number(s._sum.changeQty || 0)]))

    // Calculate values
    let totalAssetValue = 0
    let totalRetailValue = 0
    let totalItems = 0

    const reportData = products.map((product) => {
        const quantity = stockMap.get(product.id) || 0
        const costPrice = Number(product.costPrice || 0)
        const price = Number(product.price)
        const assetValue = quantity * costPrice
        const retailValue = quantity * price

        if (quantity > 0) {
            totalAssetValue += assetValue
            totalRetailValue += retailValue
            totalItems += quantity
        }

        return {
            ...product,
            quantity,
            assetValue,
            retailValue,
        }
    }).sort((a, b) => b.assetValue - a.assetValue) // Sort by highest value

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Stock Value Report</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Asset Value (Cost)</div>
                        <div className="text-2xl font-bold text-green-600">Rs.{totalAssetValue.toFixed(2)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Retail Value (Sales)</div>
                        <div className="text-2xl font-bold text-blue-600">Rs.{totalRetailValue.toFixed(2)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Items in Stock</div>
                        <div className="text-2xl font-bold">{totalItems}</div>
                    </div>
                </div>
            </div>

            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[hsl(var(--muted))]">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Product</th>
                                <th className="px-4 py-3 text-right font-medium">Quantity</th>
                                <th className="px-4 py-3 text-right font-medium">Cost Price</th>
                                <th className="px-4 py-3 text-right font-medium">Asset Value</th>
                                <th className="px-4 py-3 text-right font-medium">Retail Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]">
                            {reportData.map((item) => (
                                <tr key={item.id} className="hover:bg-[hsl(var(--muted))/50]">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{item.barcode || '-'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {item.quantity} {item.unit}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {item.costPrice ? `Rs.${Number(item.costPrice).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        Rs.{item.assetValue.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[hsl(var(--muted-foreground))]">
                                        Rs.{item.retailValue.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                                        No stock data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
